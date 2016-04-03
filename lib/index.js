require('es6-collections');
var _            = require('lodash'),
    slice        = require('sliced'),
    Promise      = require('bluebird'),
    functionDone = require('./function-done'),
    logTime      = require('./log-time'),
    nextTick     = require('next-tick'),
    Emmiter      = require('emmiter'),
    hashing      = require('object-hash')
  ;

var defaults = {
  throttle:        0,
  debounce:        0,
  concurrency:     1,
  eventful:        true,
  defaultPriority: 9999,
  storeFinished:   true
};

/**
 * todo: getMapKey каждый раз возвращает новый объект, что ломает всю концепцию
 */
var getMapKey = function getMapKey (args) {
  return {
    args: args
  };
};

var getHash = function (input) {
  return hashing(input);
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

  this.emit          = null;
  this.fn            = fn;
  this.queue         = {};
  this.index         = 0;
  this.finishedCount = 0;
  this.options       = defaults;
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

  if (this.options.eventful) {
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

  var hash = getHash(args);
  this.queue[hash] = {
    args:     args,
    index:    this.index++,
    status:   'new',
    priority: this.options.defaultPriority,
    start:    0,
    end:      void 0
  };

  this.lastAdded = hash;

  return this;
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.setupTask = function Queue$setupItem (options) {
  options = _.isPlainObject(options) ? options : {};
  var args = slice(arguments, 1),
      hash = getHash(args),
      task;

  if (this.queue[hash]) {
    task = this.queue[hash];
    this.queue[hash] = _.merge(this.queue[hash], options, {
      args: task.args,
      status: task.status,
      index: task.index,
      start: task.start,
      end: task.end
    });
  }

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
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || null;

  return !!task;
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || void 0;

  return task;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.delete = function Queue$delete () {
  var args = slice(arguments);
  this.emit && this.emit.apply(this, ['delete'].concat(args));

  delete this.queue[getHash(args)];

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {
  this.emit && this.emit('clear');
  this.queue = {};

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || null;

  if (!!task) {
    return task.status;
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isNew = function Queue$isNew () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || null;

  if (!!task) {
    return task.status == 'new';
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isPending = function Queue$isPending () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || null;

  if (!!task) {
    return task.status == 'pending';
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isDone = function Queue$isDone () {
  var args = slice(arguments),
      task = this.queue[getHash(args)] || null
  ;

  if (!!task) {
    return task.status != 'new' && task.status != 'pending';
  }

  return void 0;
};

Object.defineProperty(Queue.prototype, 'size', {
  get: function () {
    return _.size(this.queue);
  }
});
Object.defineProperty(Queue.prototype, 'length', {
  get: function () {
    return _.size(this.queue);
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
