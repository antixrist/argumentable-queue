var _            = require('lodash'),
    slice        = require('sliced'),
    Promise      = require('bluebird'),
    functionDone = require('./function-done'),
    nextTick     = require('next-tick'),
    Emitter      = require('emmiter')
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
  autoCleaning: true
};

var getMapKey = function (args) {
  return {
    args: args
  };
};

/**
 * @augments Emitter
 */
var Queue = function (fn, callback) {
  if (!(this instanceof Queue)) {
    return new Queue(fn, callback);
  }

  Emitter.extend(this);

  this.options = defaults;
  this.options = _.merge({}, this.options);
  this.fn      = fn;
  this.queue   = new Map;

  return this;
};

Queue.prototype.add = function () {
  var args = slice(arguments);
  this.emit.apply(this, ['add'].concat(args));
  this.queue.set.call(this.queue, getMapKey(args), {status: 'new'});

  return this;
};

Queue.prototype.has = function () {
  return this.queue.has.apply(this.queue, args);
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

Queue.prototype.statusOf = function () {

};

//Queue.prototype.size = function () {
//  return this.queue.size;
//};

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
