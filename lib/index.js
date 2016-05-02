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

// todo: подумать над асинхронщиной
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
 * @returns {Queue~task|undefined}
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
  } else {
    task = void 0;
  }

  return task;
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
    this.emit && this.emit('drain');
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

var sleep = function sleep (time) {
  var tstart = Date.now();
  while(Date.now() - tstart < parseInt(time, 10)) {}
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

  var byThrottle = (throttle && this.lastStartedAt) ? throttle - (now - this.lastStartedAt) : 0;
  byThrottle = _.clamp(byThrottle, 0, Infinity);
  //var byDebounce = (debounce && this.lastFinishedAt) ? debounce - (now - this.lastFinishedAt) : 0;

  var c = require('chalk');

  var byDebounce = 0;
  if (debounce) {
    let stats = this.stats;
    console.log(`finished: ${c.green(stats[Queue.STATUS_FINISHED])}`, `pending: ${c.green(stats[Queue.STATUS_PENDING])}`);
    if (!stats[Queue.STATUS_FINISHED] && !stats[Queue.STATUS_PENDING]) {
      // самый первый таск
      byDebounce = 0;
    } else if (!stats[Queue.STATUS_FINISHED] && stats[Queue.STATUS_PENDING]) {
      // самая первая пачка тасков (количество которых <= this.options.concurrency).
      // т.к. завершившихся ещё нет, то считаем задержку от времени _старта_ последнего
      byDebounce = debounce - (now - this.lastStartedAt);
    } else if (stats[Queue.STATUS_FINISHED] && !stats[Queue.STATUS_PENDING]) {
      // все таски в очереди уже завершены.
      // считаем задержку по классической схеме - от времени _завершения_ последнего таска
      byDebounce = debounce - (now - this.lastFinishedAt);
    } else if (stats[Queue.STATUS_FINISHED] && stats[Queue.STATUS_PENDING]) {
      // работа в самом разгаре - есть и завершённые, и в ожидании.
      //
      let concurrency = methods.getConcurrency.call(this);
      let pendingCount = this.inProgressCount;
      let newCount = stats[Queue.STATUS_NEW].length;
      let missing = (newCount < concurrency ? newCount : concurrency) - pendingCount;

      console.log('missing', c.blue(missing));

      byDebounce = debounce - (now - this.lastFinishedAt);
    }


    // если "ожидающих" тасков нет
    //if (!stats[Queue.STATUS_PENDING]) {
    //  byDebounce = 0;
    //} else {
      // если нету ни одного завершённого таска,
      // значит считаем от времени старта последнего
    //  let compareTime = (this.finishedCount ? this.lastFinishedAt : this.lastStartedAt);
    //  byDebounce = debounce - (now - compareTime);
    //

      // если
      //if (missing) {
      //  byDebounce = debounce / missing;
      //  sleep(byDebounce);
      //  byDebounce = 0;
      //} else {
      //
      //}
    //}

    //if (byDebounce && missing && this.finishedCount) {
    //  byDebounce = debounce / missing;
    //  console.log('byDebounce', byDebounce);
    //
    //  sleep(byDebounce);
    //  byDebounce = 0;
    //
    //}

    byDebounce = _.clamp(byDebounce, 0, Infinity);
  }

  //var byDebounce = debounce && (function () {
  //  //var timeForEqual = self.lastFinishedAt || self.lastStartedAt || 0;
  //  //return debounce + (now - timeForEqual);
  //
  //  if ((now - self.lastFinishedAt) < debounce) {
  //    return debounce + (now - self.lastFinishedAt);
  //  }
  //
  //  return 0;
  //})();

  // маленький хак, чтобы набить очередь.
  // иначе, по факту, в один момент времени будет выполняться только одна задача
  //if (byDebounce > 0 && this.inProgressCount <= methods.getConcurrency.call(this)) {
  //  byDebounce = (debounce && this.lastStartedAt) ? debounce - (now - this.lastStartedAt) : 0;
  //}

  //console.log('inProgress:', c.inverse(this.inProgressCount), '; concurrency:', c.inverse(methods.getConcurrency.call(this)));

  var times = [byThrottle, byDebounce];
  console.log('times:', times);

  // возвращаем максимально оставшееся
  var delay = _.max(times);
  console.log('delay:', c.blue(delay));

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
      return !!(self.isTask(_task) && methods.getStatus.call(self, _task) == Queue.STATUS_NEW);
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
methods.taskRunnerFactory = function Queue$taskRunnerFactory (taskKey) {
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
methods.taskRunnerCallbackFactory = function Queue$taskRunnerCallbackFactory (taskKey) {
  var self = this;

  return function (err, result) {
    var now                = Date.now();
    var task               = self.getByKey(taskKey);
    task.end               = now;
    task.time              = task.end - task.start;
    task.status            = Queue.STATUS_FINISHED;
    self.lastFinishedAt  = now;

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
  self.lastStartedAt = now;
  self.inProgressCount++;

  functionDone(
    methods.taskRunnerFactory.call(this, task.key),
    methods.taskRunnerCallbackFactory.call(this, task.key)
  );
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
  this.lastStartedAt    = 0;
  this.lastFinishedAt = 0;

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
 * @returns {Queue~task}
 */
Queue.prototype.push =
Queue.prototype.add = function Queue$add () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyFromArgs(args);

  let task = this.getByKey(key);
  if (this.isTask(task)) {
    this.emit && this.emit('task:duplicate', task);
  } else {
    // todo: task as a class with methods `getStatus`, `isNew`, `isPending`, `isFinished`, etc
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

    task = this.tasks[key];
    methods.refreshPrioritiesByTask.call(this, task);

    this.emit && this.emit.call(this, 'task:add', task);

    methods.next.call(this);
  }

  return task;
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue~task|undefined}
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
 * @returns {Queue~task|undefined}
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
 * @returns {Queue~task|undefined}
 */
Queue.prototype.get = function Queue$get () {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key  = this.getKeyFromArgs(args);

  return this.getByKey(key);
};

/**
 * @param {string} key
 * @returns {Queue~task|undefined}
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

Object.defineProperties(Queue.prototype, /** @lends Queue.prototype */{
  size: {
    /**
     * @this Queue
     * @returns {number}
     */
    get: function () { return _.size(this.tasks) }
  },
  length: {
    /**
     * @this Queue
     * @returns {number}
     */
    get: function () { return _.size(this.tasks) }
  },
  stats: {
    /**
     * @this Queue
     * @returns {{}}
     * */
    get: function () {
      var self = this;
      var stat = _.countBy(this.tasks, (task) => self.getStatusByKey(task.key));

      stat.size = self.size;
      stat[Queue.STATUS_NEW]      = stat[Queue.STATUS_NEW] || 0;
      stat[Queue.STATUS_PENDING]  = stat[Queue.STATUS_PENDING] || 0;
      stat[Queue.STATUS_FINISHED] = stat[Queue.STATUS_FINISHED] || 0;

      Object.defineProperties(stat, {
        size: { get: () => self.size },
        length: { get: () => self.size },
        totalTime: {
          /** @returns {Number|undefined} */
          get: function () {
            return (!self.options.history) ? void 0 : _.reduce(self.tasks, (time, task) => {
              return (self.getStatusByKey(task.key) == Queue.STATUS_FINISHED) ? time + task.time : time;
            }, 0);
          }
        },
        avgTime: {
          /** @returns {Number|undefined} */
          get: function () {
            var retVal = void 0;

            if (self.options.history) {
              let avg = _.reduce(self.tasks, (avg, task) => {
                if (self.getStatusByKey(task.key) == Queue.STATUS_FINISHED) {
                  avg.count += 1;
                  avg.totalTime += task.time;
                }

                return avg;
              }, {count: 0, totalTime: 0});

              retVal = (avg.count) ? avg.totalTime / avg.count : 0;
            }

            return retVal;
          }
        }
      });

      return stat;
    }
  }
});

module.exports = Queue;
