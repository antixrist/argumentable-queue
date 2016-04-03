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

/**
 * @typedef {{}} Queue~task
 * @property {[]} args
 * @property {Number} index
 * @property {string} status='new'
 * @property {number} priority
 * @property {number} start
 * @property {number|undefined} end
 */

var defaults = {
  throttle:        0,
  debounce:        0,
  concurrency:     1,
  eventful:        true,
  defaultPriority: 9999,
  storeFinished:   true
};

/**
 * @param {*} input
 * @returns {string}
 */
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
  this.tasks         = {};
  this.priorities    = {};
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

  var hash         = getHash(args);
  this.tasks[hash] = {
    args:     args,
    index:    this.index++,
    status:   'new',
    priority: this.options.defaultPriority,
    start:    0,
    end:      void 0
  };

  this._addPriority(hash, this.tasks[hash]);

  this.lastAdded = hash;

  return this;
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.setupTask = function Queue$setupTask (options) {
  options = _.isPlainObject(options) ? options : {};
  var args = slice(arguments, 1),
      hash = getHash(args),
      task;

  if (this.tasks[hash]) {
    task             = this.tasks[hash];
    this.tasks[hash] = _.merge(this.tasks[hash], options, {
      args: task.args,
      status: task.status,
      index: task.index,
      start: task.start,
      end: task.end
    });
  }

  this._addPriority(hash, this.tasks[hash]);

  return this;
};

/**
 * @param {string} taskHash
 * @param {Queue~task} task
 * @returns {Queue}
 * @private
 */
Queue.prototype._addPriority = function Queue$_addPriority (taskHash, task) {
  var taskPriority = parseInt(task.priority, 10);

  if (!taskPriority) {
    taskPriority = this.options.defaultPriority;
    task.priority = this.options.defaultPriority;
  }

  var priority = _.find(this.priorities, function (item) {
    return item.priority == taskPriority;
  });

  if (!priority) {
    this.priorities.push({
      priority: taskPriority,
      tasks: [taskHash]
    });

    this.priorities = _.sortBy(this.priorities, 'priority');
  } else {
    priority.tasks.push(taskHash);
  }

  return this;
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args = slice(arguments),
      task = this.tasks[getHash(args)] || null;

  return !!task;
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {
  var args = slice(arguments),
      task = this.tasks[getHash(args)] || void 0;

  return task;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.delete = function Queue$delete () {
  var args = slice(arguments);
  this.emit && this.emit.apply(this, ['delete'].concat(args));

  delete this.tasks[getHash(args)];

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {
  this.emit && this.emit('clear');
  this.tasks = {};

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {
  var args = slice(arguments),
      task = this.tasks[getHash(args)] || null;

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
      task = this.tasks[getHash(args)] || null;

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
      task = this.tasks[getHash(args)] || null;

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
      task = this.tasks[getHash(args)] || null
  ;

  if (!!task) {
    return task.status != 'new' && task.status != 'pending';
  }

  return void 0;
};

Object.defineProperty(Queue.prototype, 'size', {
  get: function () {
    return _.size(this.tasks);
  }
});
Object.defineProperty(Queue.prototype, 'length', {
  get: function () {
    return _.size(this.tasks);
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
      //q.tasks.forEach(function (value, key) {
      //  console.log('key:', key);
      //  console.log('value:', value);
      //  console.log('============');
      //});

      console.timeEnd(max);

      console.log('q.size', q.size);

      for(var key of q.tasks.keys()) {
        q.tasks.delete(key);
      }

      console.log('q.tasks', q.tasks);
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
