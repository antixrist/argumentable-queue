'use strict';

//var domain   = require('domain');
var eos      = require('end-of-stream');
//var nextTick = require('next-tick');
var nextTick = require('setasap');
var co       = require('co-with-promise');
var once     = require('once');
var exhaust  = require('stream-exhaust');
//var Promise  = require('bluebird');
var slice    = require('sliced');

var eosConfig = {
  error: false
};

/**
 * @param {Function} fn
 * @param {Function} cb
 * @returns {Promise}
 */
function functionDone(fn, cb) {
  cb = once(cb || function () {});

  nextTick(asyncRunner);

  var resolve, reject;
  return new Promise(function (_resolve, _reject) {
    resolve = _resolve;
    reject = _reject;
  });

  function done() {
    var args = slice(arguments);
    if (args[0]) {
      reject(args[0]);
    } else {
      resolve.apply(null, slice(args));
    }

    return cb.apply(null, arguments);
  }

  function onSuccess(result) {
    return done(null, result);
  }

  function onError(error) {
    return done(error);
  }

  function asyncRunner() {
    var result = fn(done);

    function onNext(state) {
      onNext.state = state;
    }

    function onCompleted() {
      return onSuccess(onNext.state);
    }

    if (result) {
      if (typeof result.on === 'function') {
        // stream
        // todo: return stream instead promise
        eos(exhaust(result), eosConfig, done);
        return;
      }

      if (typeof result.subscribe === 'function') {
        // rx
        result.subscribe({
          next:        onNext,
          error:       onError,
          complete:    onCompleted,
          onNext:      onNext,
          onError:     onError,
          onCompleted: onCompleted
        });
        return;
      }

      if (typeof result.then === 'function') {
        // promise
        result.then(onSuccess, onError);
        return;
      }

      if (typeof result.next === 'function' && typeof result.throw === 'function') {
        // generator

        co(result).then(onSuccess, onError);
        return;
      }
    }

    if (typeof result != 'undefined') {
      // sync
      onSuccess(result);
    }
  }

}

module.exports = functionDone;
