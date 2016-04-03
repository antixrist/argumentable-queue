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
 * @property {string} key
 * @property {Number} index
 * @property {string} status='new'
 * @property {number} priority
 * @property {number} start
 * @property {number|undefined} end
 */


var STATUS_NEW = 'new';
var STATUS_PENDING = 'pending';
var STATUS_DONE = 'done';

var defaults = {
  throttle:        0,
  debounce:        0,
  concurrency:     1,
  eventful:        true,
  defaultPriority: 9999,

};

var log = function log () {
  return;
  console.log.apply(console, slice(arguments));
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
  this.priorities    = [];
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
 * @param {*} input
 * @returns {string}
 */
var hashTime = 0;
Queue.prototype.getKeyByArgs = function Queue$getKeyByArgs (input) {
  var tstart = Date.now();

  var hash = hashing(input, {
    unorderedArrays: true,
    //algorithm: 'md5',
    encoding: 'base64'
  });

  hashTime += Date.now() - tstart;

  return hash;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.add = function Queue$add () {
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

  log('add key', key, args);
  this.tasks[key] = {
    args:     args,
    key:      key,
    index:    this.index++,
    status:   STATUS_NEW,
    priority: this.options.defaultPriority,
    start:    void 0,
    end:      void 0
  };

  this._refreshPriority(this.tasks[key]);

  this.emit && nextTick(() => this.emit.apply(this, ['add'].concat(args)));

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
      key = this.getKeyByArgs(args),
      task = this.tasks[key] || null;

  log('setupTask key', key, args);

  if (task) {
    this.tasks[key] = _.merge(options, {
      args:   task.args,
      key:    key,
      status: task.status,
      index:  task.index,
      start:  task.start,
      end:    task.end
    });

    this._refreshPriority(this.tasks[key]);
  }

  return this;
};

/**
 * @param {Queue~task} task
 * @returns {Queue}
 * @private
 */
Queue.prototype._refreshPriority = function Queue$_addPriority (task) {
  var taskPriority = parseInt(task.priority, 10);

  if (!taskPriority) {
    task.priority = this.options.defaultPriority;
    taskPriority = task.priority;
  }

  this.priorities[taskPriority] = this.priorities[taskPriority] || [];
  this.priorities[taskPriority].push(task.key);

  return this;
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args = slice(arguments),
      key = this.getKeyByArgs(args);
  log('has hash', key, args);

  return this.tasks[key] || false;
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {
  var args = slice(arguments),
      key  = this.getKeyByArgs(args),
      task = this.tasks[key] || void 0;

  log('get key', this.getKeyByArgs(args), args);

  if (task) {
    return {
      key:      key,
      status:   task.status,
      priority: task.priority,
      index:    task.index,
      start:    task.start,
      end:      task.end
    };
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.delete = function Queue$delete () {
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

  log('delete key', key, args);

  var task = this.tasks[key];
  if (this.priorities[task.priority]) {
    _.remove(this.priorities[task.priority], key);

    if (!this.priorities[task.priority].length) {
      delete this.priorities[task.priority];
    }
  }
  delete this.tasks[key];

  this.emit && nextTick(() => this.emit.apply(this, ['delete'].concat(args)));

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {
  var self = this;
  this.emit && nextTick(function () {
    self.emit('clear');
  });
  this.tasks      = {};
  this.priorities = [];

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {
  var args = slice(arguments),
      task = this.tasks[this.getKeyByArgs(args)] || null;

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
      task = this.tasks[this.getKeyByArgs(args)] || null;

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
      task = this.tasks[this.getKeyByArgs(args)] || null;

  if (!!task) {
    return task.status == STATUS_PENDING;
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isDone = function Queue$isDone () {
  var args = slice(arguments),
      task = this.tasks[this.getKeyByArgs(args)] || null
  ;

  if (!!task) {
    return task.status == STATUS_DONE;
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
  console.log.apply(console, ['on add'].concat(args));
  console.log('q.get', q.get.apply(q, args));
  console.log('q.size', q.size);
  console.log('============');

  q.delete();
});
//q.on('delete', function () {
//  console.log.apply(console, ['delete'].concat(arguments));
//});


//return;
var number = 0;
var max = 10;

logTime(max +' iterable', function (cb) {
  var iterable = function iterable () {
    setImmediate(function () {
      number++;

      q.add({
        index: number
      }, 'qwe');

      q.setupTask({
        priority: q.options.defaultPriority - number
      }, { index: number }, 'qwe');

      if (number < max) {
        if (number % 100 == 0) {
          console.log(number);
        }
        iterable();
      } else {
        //q.tasks.forEach(function (value, key) {
        //  console.log('key:', key);
        //  console.log('value:', value);
        //  console.log('============');
        //});

        //console.log('q.tasks', q.tasks);

        console.log('hashTime', hashTime);

        console.log('q.size', q.size);
        q.clear();
        //console.log('q.tasks', q.tasks);

        cb();
      }
    });
  } ();
});



return;


var queue = new Queue(function (url) {
  return superagent.get(url).then(function (response) {
    collectUrls(response).forEach(queue);
  });
}, {config: 123});

queue('http://yandex.ru');
