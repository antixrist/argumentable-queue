require('es6-collections');
var _            = require('lodash'),
    slice        = require('sliced'),
    Promise      = require('bluebird'),
    functionDone = require('./function-done'),
    nextTick     = require('next-tick'),
    Emmiter      = require('emmiter')
  ;

(function () {
  return;

var veryBig = function (number) {
  number = number || 1000;

  return new Array(number).join('*');
};

var range = 5000;
var myFunc = function (number, callback) {
  console.log('run myFunc', number);
  number = number || 100;

  var r = veryBig(number * 1000 + 1);
  var returnedValue = ['returned value: ' + number, veryBig(number * 1000 + 1)];

  return new Promise(function (resolve, reject) {
  //setImmediate(function () {
  //  console.log('immediate');
    functionDone(function (cb) {
      var timeout       = range - number;
      //var returnedValue = ['returned value: '+ number, r];

      //return returnedValue;

      //$timeout(cb, timeout, returnedValue);
      //return;

      //setTimeout(function () {
      //  cb(null, returnedValue);
      //}, timeout);
      //return;

      //setTimeout(function () {
      //  cb(returnedValue);
      //}, timeout);
      //return;

      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(returnedValue);
        }, timeout);
      });

      //return new Promise(function (resolve, reject) {
      //  setTimeout(function () {
      //    reject(returnedValue);
      //  }, timeout);
      //});

    }, function (err, result) {
      if (err) {
        //console.log('error in cb!', err);
        reject(err);
      } else {
        //console.log('done in cb!', result[0], '; count:', result[1].length);
        resolve(result);
      }
    //}, callback);
    });
  });
};


//myFunc();
//%OptimizeFunctionOnNextCall(myFunc);
//myFunc();
//printStatus(myFunc);
//
//
//return;


var func = function (number) {
  myFunc(
    number
    ,function (err, result) {
      if (err) {
        console.log('error in cb!', err);
        //reject(err);
      } else {
        console.log('done in cb!', result[0], '; count:', result[1].length);
        //resolve(result);
      }
    }
  )
    .then(function (result) {
      console.log('done in promise!', result[0], ' count:', result[1].length);
    })
    .catch(function (err) {
      console.log('error in promise!', err);
    })
  ;
};

console.log('range', range);
var number = 0;

var iterable = function () {
  setImmediate(function () {
    func(++number);

    if (number < range) {
      iterable();
    }
  });
};

iterable();

return;


_.range(1, range + 1).forEach(function (number, index) {
  myFunc(
    number,
    function (err, result) {
      if (err) {
        console.log('error in cb!', err);
        //reject(err);
      } else {
        console.log('done in cb!', result[0], '; count:', result[1].length);
        //resolve(result);
      }
    }
  )
    .then(function (result) {
      console.log('done in promise!', result[0], ' count:', result[1].length);
    })
    .catch(function (err) {
      console.log('error in promise!', err);
    })
  ;
});

return;


})();


var defaults = {
  throttle: 0,
  debounce: 0,
  concurrency: 1,
  emmitable: true,
  defaultPriority: 9999,
  storeFinished: true
};

var getMapKey = function (args) {
  return {
    args: args
  };
};


/**
 * @param {Function} fn
 * @param {{}} [options]
 * @returns {Queue}
 * @constructor
 * @augments Emmiter
 */
var Queue = function (fn, options) {
  if (!(this instanceof Queue)) {
    return new Queue(fn, options || {});
  }

  Emmiter.extend(this);

  this.fn      = fn;
  this.queue   = new Map;
  this.options = defaults;
  this.setOptions(options || {});

  return this;
};

/**
 * @param {{}} options
 * @returns {{}}
 */
Queue.prototype.setOptions = function (options) {
  options = _.isPlainObject(options) ? options : {};
  return this.options = _.merge({}, this.options, options);
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.add = function () {
  var args = slice(arguments);
  this.emit.apply(this, ['add'].concat(args));
  this.queue.set.call(this.queue, getMapKey(args), {
    status: 'new',
    priority: this.options.defaultPriority
  });

  return this;
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.tunableAdd = function (options) {
  options = _.isPlainObject(options) ? options : {};

  var args = slice(arguments, 1);
  this.emit.apply(this, ['add'].concat(args));
  this.queue.set.call(this.queue, getMapKey(args), _.merge({
    priority: this.options.defaultPriority
  }, options, {
    status: 'new'
  }));

  return this;
};

Queue.prototype.has = function () {
  var args = slice(arguments);

  return this.queue.has.apply(this.queue, getMapKey(args));
};

Queue.prototype.get = function () {
  var args = slice(arguments);

  return this.queue.get.apply(this.queue, getMapKey(args));
};

Queue.prototype.delete = function () {
  var args = slice(arguments);
  this.emit.apply(this, ['delete'].concat(args));
  this.queue.delete.call(this.queue, getMapKey(args));

  return this;
};

Queue.prototype.clear = function () {
  this.emit('clear');
  this.queue.clear();

  return this;
};

/**
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function () {
  var args = slice(arguments);

  if (this.queue.has(getMapKey(args))) {
    return this.queue.get(getMapKey(args)).status;
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isNew = function () {
  var args = slice(arguments);

  if (this.queue.has(getMapKey(args))) {
    return this.queue.get(getMapKey(args)).status == 'new';
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isPending = function () {
  var args = slice(arguments);

  if (this.queue.has(getMapKey(args))) {
    return this.queue.get(getMapKey(args)).status == 'pending';
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isFinished = function () {
  var task,
      args = slice(arguments);

  if (this.queue.has(getMapKey(args))) {
    task = this.queue.get(getMapKey(args));
    return task.status != 'new' && task.status != 'pending';
  }

  return void 0;
};

Object.defineProperty(Queue.prototype, 'size', {
  get: function () {
    return this.queue.size;
  }
});

module.exports = Queue;


var q = new Queue();

q.on('add', function () {
  console.log.apply(console, ['add'].concat(arguments));
});
q.on('delete', function () {
  console.log.apply(console, ['delete'].concat(arguments));
});



var number = 0;
var max = 100;

var iterable = function iterable () {
  setImmediate(function () {
    number++;

    q.add({index: number}, 'qwe');

    if (number < max) {
      iterable();
    } else {
      q.queue.forEach(function (value, key) {
        console.log('key:', key);
        console.log('value:', value);
        console.log('============');
      });

      console.log('q.size', q.size);

      for(var key of q.queue.keys()) {
        q.queue.delete(key);
      }

      console.log('q.queue', q.queue);
    }
  });
} ();



return;


var queue = new Queue(function (url) {
  return superagent.get(url).then(function (response) {
    collectUrls(response).forEach(queue);
  });
}, {config: 123});

queue('http://yandex.ru');
