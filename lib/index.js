'use strict';

var _            = require('lodash'),
    slice        = require('sliced'),
    extend       = require('extend'),
    Emmiter      = require('emmiter'),
    hashing      = require('object-hash'),
    keypather    = require('keypather')(),
    functionDone = require('async-done')
  ;

/**
 * @typedef {{}} Queue~task
 * @property {[]} args
 * @property {string} key
 * @property {Number} index
 * @property {string} status='new'
 * @property {number} priority
 * @property {number|undefined} start
 * @property {number|undefined} end
 * @property {number|undefined} time
 * @property {Queue~task} prevs
 */

var defaults = {
  throttle:        0, // or function
  debounce:        0, // or function
  concurrency:     1, // or function
  eventful:        true,
  defaultPriority: 9999,
  ctx:             null,
  history:         false
};

var _result = function (obj, keypath, ctx) {
  var prop = keypather.get(obj, keypath);

  if (_.isFunction(prop)) {
    return prop.call(ctx || null);
  }

  return prop;
};

var methods = {};

/**
 * @this {Queue}
 * @param {Queue~task} task
 * @param {{}} data
 * @returns {Queue}
 */
methods.update = function Queue$update (task, data) {
  data = _.isPlainObject(data) ? data : {};

  if (this.isTask(task)) {
    delete task.prevs;
    task.prevs = extend({}, task);

    this.tasks[task.key] = extend(this.tasks[task.key], data);
    task = this.tasks[task.key];

    // validate priority
    task.priority = parseInt(task.priority, 10);
    task.priority = (_.isNumber(task.priority))
      ? task.priority
      : task.prevs.priority || this.options.defaultPriority;

    methods.refreshPrioritiesByTask.call(this, task);

    this.emit && this.emit.call(this, 'task:update', task);
  }

  return this;
};

/**
 * @this {Queue}
 * @param {Queue~task} task
 * @returns {Queue}
 */
methods.refreshPrioritiesByTask = function Queue$refreshPrioritiesByTask (task) {
  if (this.isTask(task)) {
    this.priorities[task.priority] = this.priorities[task.priority] || [];
    this.priorities[task.priority].push(task.key);

    var priorityOld = keypather.get(task, 'prevs.priority');
    if (priorityOld && priorityOld != task.priority && this.priorities[priorityOld]) {
      // удаляет из массива этот ключ
      _.pull(this.priorities[priorityOld], task.key);

      methods.tidyPriorities.call(this);
    }
  }

  return this;
};

/**
 * @this {Queue}
 * @returns {Queue}
 */
methods.tidyPriorities = function Queue$tidyPriorities () {
  _.each(_.keys(this.priorities), (priority) => {
    if (!this.priorities[priority].length) {
      delete this.priorities[priority];
    }
  });

  methods.refreshLeadPriority.call(this);

  return this;
};

/**
 * @this {Queue}
 * @returns {Number}
 */
methods.refreshLeadPriority = function Queue$refreshLeadPriority () {
  this.leadPriority = _.min(_.keys(this.priorities).concat(this.options.defaultPriority));

  return this.leadPriority;
};

/**
 * @this {Queue}
 * @param {Queue~task} task
 * @returns {boolean}
 */
methods.delete = function Queue$delete (task) {
  if (this.isTask(task)) {
    methods.deleteTaskFromPriorities.call(this, task);
    this.tasks[task.key] = null;
    delete this.tasks[task.key];

    return true;
  }

  return false;
};

/**
 * @this {Queue}
 * @params {Queue~task} task
 */
methods.deleteTaskFromPriorities = function Queue$deleteTaskFromPriorities (task) {
  if (this.isTask(task) && this.priorities[task.priority]) {
    _.pull(this.priorities[task.priority], task.key);
    // обновляем очереди по приоритету
    methods.tidyPriorities.call(this);
  }
};

/**
 * @this {Queue}
 * @param {Queue~task} task
 * @returns {string|undefined}
 */
methods.getStatus = function Queue$getStatus (task) {
  if (this.isTask(task)) {
    return task.status;
  }

  return void 0;
};

/**
 * @this {Queue}
 * @returns {Queue}
 */
methods.next = function Queue$next () {
  if (this.isPaused() || !!this.waitingForNextTaskTimeout) { return this; }

  this.nextTask = this.nextTask || methods.findNextTask.call(this);

  if (this.nextTask) {
    if (methods.nextTaskAllowed.call(this)) {
      let key = this.nextTask.key;
      this.nextTask = null;
      methods.runTask.call(this, this.getByKey(key));
    } else if (!this.waitingForNextTaskTimeout) {
      let waitingTime = methods.getTimeForNextTask.call(this);
      if (waitingTime) {
        this.waitingForNextTaskTimeout = setTimeout(() => {
          this.waitingForNextTaskTimeout = false;
          methods.next.call(this);
        }, waitingTime);
      }
    }
  } else if (!this.inProgressCount) {
    this.emit && this.emit('empty');
  }

  return this;
};

/**
 * @this {Queue}
 * @returns {boolean}
 */
methods.nextTaskAllowed = function Queue$nextTaskAllowed () {
  return (
    this.inProgressCount < methods.getConcurrency.call(this, true) &&
    !methods.getTimeForNextTask.call(this, true)
  );
};

/**
 * @this {Queue}
 * @params {boolean} [forceCache=false]
 * @returns {number}
 */
methods.getConcurrency = function Queue$getConcurrency (forceCache) {
  if (typeof this.concurrencyCache == 'undefined' || !!forceCache) {
    this.concurrencyCache = _result(this.options, 'concurrency', this);
    this.concurrencyCache = (_.isNumber(this.concurrencyCache = parseInt(this.concurrencyCache, 10)) && this.concurrencyCache > 0)
      ? this.concurrencyCache
      : 1;
  }

  return this.concurrencyCache;
};

/**
 * @this {Queue}
 * @params {boolean} [forceCache=false]
 * @returns {number}
 */
methods.getTimeForNextTask = function Queue$getTimeForNextTask (forceCache) {
  if (typeof this.timeForNextTaskCache == 'undefined' || !!forceCache) {
    this.timeForNextTaskCache = methods.calcTimeForNextTask.call(this)
  }

  return this.timeForNextTaskCache;
};

/**
 * @this {Queue}
 * @returns {number}
 */
methods.calcTimeForNextTask = function Queue$calcTimeForNextTask () {
  var now      = Date.now();
  var throttle = _result(this.options, 'throttle', this);
  var debounce = _result(this.options, 'debounce', this);
  throttle     = (_.isNumber(throttle = parseInt(throttle, 10)) && throttle > 0) ? throttle : 0;
  debounce     = (_.isNumber(debounce = parseInt(debounce, 10)) && debounce > 0) ? debounce : 0;

  var byThrottle = (throttle && this.lastTimeStart) ? throttle - (now - this.lastTimeStart) : 0;
  //var byDebounce = (debounce && this.lastTimeFinished) ? debounce - (now - this.lastTimeFinished) : 0;

  var c = require('chalk');

  var byDebounce = 0;

  if (debounce) {
    if (this.lastTimeFinished) {
      byDebounce = debounce - (now - this.lastTimeFinished);
    }

    //let concurrency = methods.getConcurrency.call(this);
    //if ((this.finishedCount || this.inProgressCount) && this.inProgressCount < concurrency) {
    //  console.log(c.inverse('bump'), this.inProgressCount);
    //  console.log('concurrency - this.inProgressCount', concurrency - this.inProgressCount);
    //  console.log('debounce / (concurrency - this.inProgressCount)', debounce / (concurrency - this.inProgressCount));
    //  byDebounce = debounce / (concurrency - this.inProgressCount);
    //}
  }

  //var byDebounce = debounce && (function () {
  //  //var timeForEqual = self.lastTimeFinished || self.lastTimeStart || 0;
  //  //return debounce + (now - timeForEqual);
  //
  //  if ((now - self.lastTimeFinished) < debounce) {
  //    return debounce + (now - self.lastTimeFinished);
  //  }
  //
  //  return 0;
  //})();

  // маленький хак, чтобы набить очередь.
  // иначе, по факту, в один момент времени будет выполняться только одна задача
  //if (byDebounce > 0 && this.inProgressCount <= methods.getConcurrency.call(this)) {
  //  byDebounce = (debounce && this.lastTimeStart) ? debounce - (now - this.lastTimeStart) : 0;
  //}

  //console.log('inProgress:', c.inverse(this.inProgressCount), '; concurrency:', c.inverse(methods.getConcurrency.call(this)));

  var times = [byThrottle, byDebounce];

  console.log('times', times);

  // возвращаем максимально оставшееся
  var delay = _.max(_.map(times, function (time) {
    // отрицательные значения не возвращаем
    return (time < 0) ? 0 : time;
  }));

  console.log('delay', c.blue(delay));

  return delay;
};

/**
 * @this {Queue}
 * @returns {?Queue~task}
 */
methods.findNextTask = function Queue$findNextTask () {
  var priorityQueue;
  var self = this;
  var taskKey = null, task = null;

  if (!!this.priorities[this.leadPriority]) {
    priorityQueue = this.priorities[this.leadPriority];
    taskKey = _.find(priorityQueue, function (_taskKey) {
      var _task = self.getByKey(_taskKey);
      return !!(self.isTask(_task) && _task.status == Queue.STATUS_NEW);
    });

    // если тасков со статусом `new` и этим приоритетом нету,
    if (!taskKey) {
      // обновляем очереди по приоритету (там же обновится и `this.leadPriority`, и удалятся пустые приоритеты (проверки на _isNew там нет!))
      methods.tidyPriorities.call(this);
    }
  } else {
    methods.tidyPriorities.call(this);
  }

  if (taskKey) {
    task = this.getByKey(taskKey);
  } else if (!!this.priorities[this.leadPriority] && this.priorities.length > 1) {
    // рекурсивно ищем таск по новой
    task = methods.findNextTask.call(this);
  }

  return task;
};

/**
 * @this {Queue}
 * @param {string} taskKey
 * @returns {Function}
 */
var taskRunner = function Queue$taskRunner (taskKey) {
  var self = this;

  return function (done) {
    var task = self.tasks[taskKey];
    self.emit && self.emit.call(self, 'task:start', self.getByKey(task.key));

    return self.fn.apply(self.options.ctx || null, task.args.concat(done));
  };
};

/**
 * @this {Queue}
 * @param {string} taskKey
 * @returns {Function}
 */
var taskRunnerCallback = function Queue$taskRunnerCallback (taskKey) {
  var self = this;

  return function (err, result) {
    var now                = Date.now();
    var task               = self.getByKey(taskKey);
    task.end               = now;
    task.time              = task.end - task.start;
    task.status            = Queue.STATUS_FINISHED;
    self.lastTimeFinished  = now;

    ++self.finishedCount;
    --self.inProgressCount;

    if (!self.options.history) {
      methods.delete.call(self, task);
    } else {
      methods.deleteTaskFromPriorities.call(self, task);
    }

    self.emit && self.emit.call(self, 'task:done', err,
      (typeof result != 'undefined') ? result : void 0,
      task
    );

    console.log('call "next"');
    methods.next.call(self);
  };
};

/**
 * @this {Queue}
 * @param {Queue~task} task
 */
methods.runTask = function Queue$runTask (task) {
  var self = this;
  var now = Date.now();
  task.start         = now;
  task.status        = Queue.STATUS_PENDING;
  self.lastTimeStart = now;
  self.inProgressCount++;

  functionDone(taskRunner.call(this, task.key), taskRunnerCallback.call(this, task.key));
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

  this.fn         = fn;
  this.tasks      = {};
  this.priorities = {};
  this.options    = defaults;
  this.setOptions(options || {});

  this.paused           = false;
  this.index            = 0;
  this.finishedCount    = 0;
  this.inProgressCount  = 0;
  this.nextTask         = null;
  this.leadPriority     = this.options.defaultPriority;
  this.lastTimeStart    = 0;
  this.lastTimeFinished = 0;

  this.waitingForNextTaskTimeout = false;

  return this;
};

Queue.STATUS_NEW      = 'new';
Queue.STATUS_PENDING  = 'pending';
Queue.STATUS_FINISHED = 'finished';

/**
 * @param {{}} options
 * @returns {{}}
 */
Queue.prototype.setOptions = function Queue$setOptions (options) {
  options = _.isPlainObject(options) ? options : {};
  this.options = extend({}, this.options, options);

  this.options.eventful        = !!this.options.eventful;
  this.options.history         = !!this.options.history;
  this.options.ctx             = _.isObjectLike(this.options.ctx) ? this.options.ctx : defaults.ctx;
  this.options.defaultPriority = _.isNumber(this.options.defaultPriority)
    ? this.options.defaultPriority
    : defaults.defaultPriority;
  methods.refreshLeadPriority.call(this);

  if (this.options.eventful) {
    Emmiter.patch(this);
  } else {
    Emmiter.destroy(this);
  }

  return this.options;
};

/**
 * @param {*} task
 * @returns {boolean}
 */
Queue.prototype.isTask = function Queue$isTask (task) {
  return !!(task && task.key);
};

/**
 * @param {*} input
 * @returns {string}
 */
Queue.prototype.getKeyFromArgs = function Queue$getKeyByArgs (input) {
  return hashing(input, {
    unorderedArrays: true,
    //algorithm: 'md5',
    encoding: 'base64'
  });
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.add = function Queue$add () {
  var self = this;
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyFromArgs(args);

  this.tasks[key] = {
    args:     args,
    key:      key,
    index:    ++this.index,
    status:   Queue.STATUS_NEW,
    priority: this.options.defaultPriority,
    // todo: start -> startedAt && end -> finishedAt
    start:    void 0,
    end:      void 0,
    time:     void 0
  };

  var task = this.tasks[key];

  methods.refreshPrioritiesByTask.call(this, task);

  this.emit && this.emit.call(this, 'task:add', task);

  methods.next.call(this);

  return this;
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.update = function Queue$update (options) {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  args = slice(args, 1);
  var key = this.getKeyFromArgs(args);

  return this.updateByKey(key, options || {});
};

/**
 * @param {string} key
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.updateByKey = function Queue$byKeyUpdate (key, options) {
  var task = this.getByKey(key);

  return methods.update.call(this, task, options || {});
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyFromArgs(args);

  return this.hasByKey(key);
};

/**
 * @param {string} key
 * @returns {boolean}
 */
Queue.prototype.hasByKey = function Queue$hasByKey (key) {
  return !!this.getByKey(key);
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key  = this.getKeyFromArgs(args);

  return this.getByKey(key);
};

/**
 * @param {string} key
 * @returns {Queue~task}
 */
Queue.prototype.getByKey = function Queue$getByKey (key) {
  return this.tasks[key] || void 0;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.delete = function Queue$delete () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyFromArgs(args);

  return this.deleteByKey(key);
};

/**
 * @param {string} key
 * @returns {Queue}
 */
Queue.prototype.deleteByKey = function Queue$deleteByKey (key) {
  var task = this.getByKey(key);

  if (methods.delete.call(this, task)) {
    this.emit && this.emit.call(this, 'task:delete', task);
  }

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {
  this.tasks      = {};
  this.priorities = {};
  methods.tidyPriorities.call(this);

  this.emit && this.emit('clear');

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.getStatus = function Queue$getStatus () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyFromArgs(args);

  return this.getStatusByKey(key);
};

/**
 * @param {string} key
 * @returns {string|undefined}
 */
Queue.prototype.getStatusByKey = function Queue$getStatusByKey (key) {
  var task = this.getByKey(key);

  return methods.getStatus.call(this, task);
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
  methods.next.call(this);

  return this;
};

/**
 * @returns {boolean}
 */
Queue.prototype.isPaused = function Queue$isPaused () {
  return this.paused;
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

Object.defineProperty(Queue.prototype, 'stats', {
  get: function () {
    var stat = _.countBy(this.tasks, (task) => this.getStatusByKey(task.key));

    stat.all                    = this.size;
    stat[Queue.STATUS_NEW]      = stat[Queue.STATUS_NEW] || 0;
    stat[Queue.STATUS_PENDING]  = stat[Queue.STATUS_PENDING] || 0;
    stat[Queue.STATUS_FINISHED] = stat[Queue.STATUS_FINISHED] || 0;

    return stat;
  }
});

module.exports = Queue;
