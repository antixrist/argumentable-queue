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



(function () {
  var args = slice(arguments);

  function test () {
    return {
      args: slice(arguments)
    };
  }

  console.log('test.apply(null, args)', test.apply(null, args));

  console.log('test', test.apply(null, args) === test.apply(null, args));

})({qwe: 123});



return;
var defaults = {
  throttle: 0,
  debounce: 0,
  concurrency: 1,
  emmitable: true,
  defaultPriority: 9999,
  storeFinished: true
};

/**
 * todo: getMapKey каждый раз возвращает новый объект, что ломает всю концепцию
 */
var getMapKey = function getMapKey (args) {
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

  this.fn      = fn;
  this.queue   = new Map;
  this.index   = 0;
  this.options = defaults;
  this.setOptions(options || {});

  return this;
};

/**
 * @param {{}} options
 * @returns {{}}
 */
Queue.prototype.setOptions = function Queue$setOptions (options) {
  options = _.isPlainObject(options) ? options : {};
  this.options = _.merge({}, this.options, options);

  if (this.options.emmitable) {
    Emmiter.extend(this);
  }

  return this.options;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.add = function Queue$add () {
  var args = slice(arguments);
  this.emit && this.emit.apply(this, ['add'].concat(args));

  this.queue.set.call(this.queue, getMapKey(args), {
    index: this.index++,
    status: 'new',
    priority: this.options.defaultPriority,
    start: 0,
    end: void 0
  });

  return this;
};


/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.tunableAdd = function Queue$tunableAdd (options) {
  options = _.isPlainObject(options) ? options : {};

  var args = slice(arguments, 1);
  this.emit && this.emit.apply(this, ['add'].concat(args));

  this.queue.set.call(this.queue, getMapKey(args), _.merge({
    priority: this.options.defaultPriority
  }, options, {
    index: this.index++,
    status: 'new',
    start: 0,
    end: void 0
  }));

  return this;
};

/**
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args = slice(arguments);

  return this.queue.has(getMapKey(args));
};

Queue.prototype.get = function Queue$get () {
  var args = slice(arguments);

  return this.queue.get(getMapKey(args));
};

Queue.prototype.delete = function Queue$delete () {
  var args = slice(arguments);
  console.log.apply(console, ['delete'].concat(args));
  this.emit && this.emit.apply(this, ['delete'].concat(args));

  this.queue.delete(getMapKey(args));

  return this;
};

Queue.prototype.clear = function Queue$clear () {
  this.emit && this.emit('clear');
  this.queue.clear();

  return this;
};

/**
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {
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
Queue.prototype.isNew = function Queue$isNew () {
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
Queue.prototype.isPending = function Queue$isPending () {
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
Queue.prototype.isDone = function Queue$isDone () {
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



//return;


var q = new Queue(function () {
  console.log.apply(console, ['add new task with args:'].concat(arguments));
});

q.setOptions({
  defaultPriority: 9000
});

q.on('add', function () {
  var args = slice(arguments);
  console.log.apply(console, ['add'].concat(args));
  console.log('q.has', q.has.apply(q, args));
  console.log('q.size', q.size);
});
//q.on('delete', function () {
//  console.log.apply(console, ['delete'].concat(arguments));
//});



var number = 0;
var max = 1000;

console.time(max);

var iterable = function iterable () {
  setImmediate(function () {
    q.tunableAdd({
      priority: q.options.defaultPriority - number
    }, {
      index: number
    }, 'qwe');

    if (number < max) {
      iterable();
    } else {
      //q.queue.forEach(function (value, key) {
      //  console.log('key:', key);
      //  console.log('value:', value);
      //  console.log('============');
      //});

      console.timeEnd(max);

      console.log('q.size', q.size);

      for(var key of q.queue.keys()) {
        q.queue.delete(key);
      }

      console.log('q.queue', q.queue);
    }

    number++;
  });
} ();



return;


var queue = new Queue(function (url) {
  return superagent.get(url).then(function (response) {
    collectUrls(response).forEach(queue);
  });
}, {config: 123});

queue('http://yandex.ru');
