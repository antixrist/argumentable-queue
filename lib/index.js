var _            = require('lodash'),
    slice        = require('sliced'),
    extend       = require('extend'),
    Promise      = require('bluebird'),
    functionDone = require('./function-done'),
    logTime      = require('./log-time'),
    nextTick     = require('next-tick'),
    Emmiter      = require('emmiter'),
    hashing      = require('object-hash'),
    keypather    = require('keypather')(),
    mem          = require('mem')
  ;


var MemStorage = function MemStorage (data) {
  this.data = _.isPlainObject(data) ? data : {};
};
MemStorage.prototype.set = function (key, value) {
  this.data[key] = value;
};
MemStorage.prototype.get = function (key) {
  return this.data[key] || void 0;
};
MemStorage.prototype.has = function () {
  return typeof this.data[key] != 'undefined';
};

var memOptions = {
  cacheKey: function () {
    var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}

    return hashing(args, {
      unorderedArrays: true,
      //algorithm: 'md5',
      encoding: 'base64'
    });
  },
  cache: new MemStorage
};

/**
 * @typedef {{}} Queue~task
 * @property {[]} args
 * @property {string} key
 * @property {Number} index
 * @property {string} status='new'
 * @property {number} priority
 * @property {number} start
 * @property {number|undefined} end
 * @property {Queue~task} prevs
 */


var STATUS_NEW     = 'new';
var STATUS_PENDING = 'pending';
var STATUS_DONE    = 'done';

var defaults = {
  throttle:        0,
  debounce:        0,
  concurrency:     1,
  eventful:        true,
  defaultPriority: 9999
};

var log = function log () {
  return;
  console.log.apply(console, slice(arguments));
};

var _result = function (obj, keypath, ctx) {
  var prop = keypather.get(obj, keypath);

  if (_.isFunction(prop)) {
    return prop.call(ctx || null);
  }

  return prop;
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

  this.fn            = fn;
  this.tasks         = {};
  this.priorities    = {};
  this.options       = defaults;
  this.setOptions(options || {});

  this.paused        = false;
  this.index         = 0;
  this.finishedCount = 0;

  this.lastTaskTimes = {
    start: null,
    stop: null
  };
  this.activedCount = 0;

  return this;
};

/**
 * @param {{}} options
 * @returns {{}}
 */
Queue.prototype.setOptions = function Queue$setOptions (options) {
  options = _.isPlainObject(options) ? options : {};
  this.options = _.merge({}, this.options, options);

  if (!!this.options.eventful) {
    Emmiter.patch(this);
  } else {
    Emmiter.dispatch(this);
  }

  return this.options;
};

/**
 * @param {*} input
 * @returns {string}
 */
Queue.prototype.getKeyByArgs = function Queue$getKeyByArgs (input) {
  return hashing(input, {
    unorderedArrays: true,
    //algorithm: 'md5',
    encoding: 'base64'
  });
};

/**
 * @param {...*}
 * @returns {Queue~task}
 */
Queue.prototype.add = function Queue$add () {
  var self = this;
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  this.tasks[key] = {
    args:     args,
    key:      key,
    index:    ++this.index,
    status:   STATUS_NEW,
    priority: this.options.defaultPriority,
    start:    void 0,
    end:      void 0
  };

  this._updatePrioritiesByTask(this.tasks[key]);

  this.emit && this.emit.apply(this, ['add', this.getByKey(key)]);

  self.next();

  return this.getByKey(key);
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.setupTask = function Queue$setupTask (options) {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  args = slice(args, 1);
  var key = this.getKeyByArgs(args);

  return this.byKeySetupTask(key, options || {});
};

/**
 * @param {string} key
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.byKeySetupTask = function Queue$byKeySetupTask (key, options) {
  var task = this.tasks[key || ''] || null;

  return this._setupTask(task, options || {});
};

/**
 * @param {Queue~task} task
 * @param {{}} options
 * @returns {Queue}
 */
Queue.prototype._setupTask = function Queue$_setupTask (task, options) {
  options = _.isPlainObject(options) ? options : {};

  if (task) {
    delete task.prevs;
    task.prevs = extend({}, task);

    this.tasks[task.key] = extend({}, options, {
      args:   task.args,
      key:    task.key,
      status: task.status,
      index:  task.index,
      start:  task.start,
      end:    task.end
    });

    task = this.tasks[task.key];

    // validate priority
    task.priority = parseInt(task.priority, 10);
    task.priority = (_.isNumber(task.priority))
      ? task.priority
      : task.prevs.priority || this.options.defaultPriority;

    this._updatePrioritiesByTask(task);
  }

  return this;
};

/**
 * @param {Queue~task} task
 * @param {Number} [previousPriority]
 * @returns {Queue}
 * @private
 */
Queue.prototype._updatePrioritiesByTask = function Queue$_updatePrioritiesByTask (task) {
  this.priorities[task.priority] = this.priorities[task.priority] || [];
  this.priorities[task.priority].push(task.key);

  var priorityOld = keypather(task, 'prevs.priority');
  if (priorityOld && priorityOld != task.priority && this.priorities[priorityOld]) {
    var index = this.priorities[priorityOld].indexOf(task.key);
    if (index >= 0) {
      this.priorities[priorityOld].splice(index, 1);

      if (!this.priorities[priorityOld].length) {
        delete this.priorities[priorityOld];
      }
    }
  }

  if (!!priorityOld && priorityOld != task.priority && this.priorities[priorityOld]) {
  }

  return this;
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.tasks[key] || false;
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key  = this.getKeyByArgs(args),
      task = this.tasks[key] || void 0;

  if (task) {
    return {
      key:      key,
      args:     task.args,
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
 * @param {string} key
 * @returns {Queue~task}
 */
Queue.prototype.getByKey = function Queue$getByKey (key) {
  var task = this.tasks[key] || void 0;

  if (task) {
    return {
      key:      task.key,
      args:     task.args,
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
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.byKeyDelete(key);
};

/**
 * @param {string} key
 * @returns {Queue}
 */
Queue.prototype.byKeyDelete = function Queue$byKeyDelete (key) {
  var task = this.tasks[key || ''] || null;

  return this._delete(task);
};

/**
 * @param {Queue~task} task
 * @returns {Queue}
 */
Queue.prototype._delete = function Queue$_delete (task) {
  if (task) {
    if (this.priorities[task.priority]) {
      _.remove(this.priorities[task.priority], task.key);

      if (!this.priorities[task.priority].length) {
        delete this.priorities[task.priority];
      }
    }
    delete this.tasks[task.key];

    this.emit && this.emit.apply(this, ['delete', this.getByKey(task.key)]);
  }

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {
  this.emit && this.emit('clear');
  this.tasks      = {};
  this.priorities = [];

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.byKeyStatusOf(key);
};

/**
 * @param {string} key
 * @returns {string|undefined}
 */
Queue.prototype.byKeyStatusOf = function Queue$byKeyStatusOf (key) {
  var task = this.tasks[key || ''] || null;

  return this._statusOf(task);
};

/**
 * @param {Queue~task} task
 * @returns {string|undefined}
 */
Queue.prototype._statusOf = function Queue$_statusOf (task) {
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
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.byKeyIsNew(key);
};

/**
 * @param {string} key
 * @returns {boolean|undefined}
 */
Queue.prototype.byKeyIsNew = function Queue$byKeyIsNew (key) {
  var task = this.tasks[key || ''] || null;

  return this._isNew(task);
};

/**
 * @param {Queue~task} task
 * @returns {boolean|undefined}
 */
Queue.prototype._isNew = function Queue$_isNew (task) {
  if (!!task) {
    return task.status == STATUS_NEW;
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {boolean|undefined}
 */
Queue.prototype.isPending = function Queue$isPending () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.byKeyIsPending(key);
};

/**
 * @param {string} key
 * @returns {boolean|undefined}
 */
Queue.prototype.byKeyIsPending = function Queue$byKeyIsPending (key) {
  var task = this.tasks[key || ''] || null;

  return this._isPending(task);
};

/**
 * @param {Queue~task} task
 * @returns {boolean|undefined}
 */
Queue.prototype._isPending = function Queue$_isPending (task) {
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
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.byKeyIsDone(key);
};

/**
 * @param {string} key
 * @returns {boolean|undefined}
 */
Queue.prototype.byKeyIsDone = function Queue$byKeyIsDone (key) {
  var task = this.tasks[key || ''] || null;

  return this._isDone(task);
};

/**
 * @param {Queue~task} task
 * @returns {boolean|undefined}
 */
Queue.prototype._isDone = function Queue$_isDone (task) {
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


/**
 *
 */
Queue.prototype.next = function Queue$next () {

  //nextTick(function () {
  //
  //});

  if (this._nextTaskAllowed()) {
    /** @type {Queue~task} */
    var task = this._getNextPrimaryTask(true);
    if (!task) {
      this.emit && this.emit('empty');
    } else {
      this._runTask(task);
    }
  }
};

/**
 * @returns {number}
 */
Queue.prototype._getTimeForNextTask = function Queue$_getTimeForNextTask () {
  var time;
  var now = Date.now();

  // кэшируем вычисление оставшегося времени сроком на это же оставшееся время
  if (!!this.calcTimeForNextTaskLastTime && now - this.calcTimeForNextTaskLastTime < this.calcTimeForNextTaskValue) {
    time = this.calcTimeForNextTaskValue;
  } else {
    time = this._calcTimeForNextTask();
    this.calcTimeForNextTaskValue    = time;
    this.calcTimeForNextTaskLastTime = now;
  }

  return time;
};

/**
 * @returns {number}
 */
Queue.prototype._calcTimeForNextTask = function Queue$_calcTimeForNextTask () {
  var throttle = _result(this.options, 'throttle', this);
  var debounce = _result(this.options, 'debounce', this);
  throttle     = (_.isNumber(throttle = parseInt(throttle, 10)) && throttle >= 0) ? throttle : 0;
  debounce     = (_.isNumber(debounce = parseInt(debounce, 10)) && debounce >= 0) ? debounce : 0;

  var now = Date.now();
  var times = [
    now - this.lastTaskTimes.start - throttle,
    now - this.lastTaskTimes.stop - debounce
  ];

  // возвращаем максимально оставшееся
  return _.max(_.map(times, function (time) {
    // отрицательное время не возвращаем
    return (time < 0) ? 0 : time;
  }));
};

/**
 * @returns {boolean}
 */
Queue.prototype._nextTaskAllowed = function Queue$_nextTaskAllowed () {
  if (this.paused) { return false; }

  var throttle    = _result(this.options, 'throttle', this);
  var debounce    = _result(this.options, 'debounce', this);
  var concurrency = _result(this.options, 'concurrency', this);

  throttle    = (_.isNumber(throttle = parseInt(throttle, 10)) && throttle >= 0) ? throttle : 0;
  debounce    = (_.isNumber(debounce = parseInt(debounce, 10)) && debounce >= 0) ? debounce : 0;
  concurrency = (_.isNumber(concurrency = parseInt(concurrency, 10)) && concurrency >= 0) ? concurrency : 1;

  var now = Date.now();
  if (this.activedCount >= concurrency ||
    this.lastTaskTimes.start && (now - this.lastTaskTimes.start) >= throttle ||
    this.lastTaskTimes.stop  && (now - this.lastTaskTimes.stop)  >= debounce
  ) {
    return false;
  }

  return true;
};

/**
 * @param {Queue~task} task
 * @private
 */
Queue.prototype._runTask = function Queue$_runTask (task) {
  //functionDone();
};

/**
 * @param {boolean} [pull]
 * @private
 * @returns {?Queue~task}
 */
Queue.prototype._getNextPrimaryTask = function Queue$_getNextPrimaryTask (pull) {
  var self = this;
  var priorities = _.keys(this.priorities);

  if (priorities.length) {
    var primaryPriority = _.min(priorities);
    var primaryTask     = _.find(this.priorities[primaryPriority], function (taskKey) {
      return self._isNew(self.tasks[taskKey]);
    });

    if (!primaryTask) {
      delete this.priorities[primaryPriority];

      return this._getNextPrimaryTask();
    }

    if (pull) {
      _.remove(this.priorities[primaryPriority], function (taskKey) {
        return taskKey == primaryTask.key;
      });
    }

    return primaryTask;
  }

  return null;
};

/**
 * @returns {Queue}
 */
Queue.prototype.pause = function Queue$pause () {
  this.paused = true;

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.resume = function Queue$resume () {
  this.paused = false;

  return this;
};






module.exports = Queue;



//return;


var q = new Queue(function () {
  console.log.apply(console, ['add new task with args:'].concat(arguments));
});

q.setOptions({
  defaultPriority: 9000,
  concurrency: function () {
    console.log('concurrency this instanceof Queue', this instanceof Queue);
    return '10';
  },
  throttle: function () {
    console.log('throttle this instanceof Queue', this instanceof Queue);
    return 200 + ' ';
  },
  debounce: ' '+ 300
});



q._nextTaskAllowed();



return;

q.on('add', function (task) {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  console.log('on add', task);
  //console.log('q.get', q.getByKey(task.key));
  //console.log('q.size', q.size);
  console.log('============');

  //q.delete();
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

        console.log('q.tasks', q.tasks);
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
