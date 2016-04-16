'use strict';

var _            = require('lodash'),
    slice        = require('sliced'),
    extend       = require('extend'),
    Emmiter      = require('emmiter'),
    hashing      = require('object-hash'),
    keypather    = require('keypather')(),
    functionDone = require('./function-done')
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

var STATUS_NEW     = 'new';
var STATUS_PENDING = 'pending';
var STATUS_DONE    = 'done';

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
  this.runnedCount   = 0;
  this.nextTask      = null;
  this.leadPriority  = this.options.defaultPriority;

  this.lastTaskTimes = {
    start: 0,
    end:  0
  };
  this.waitingForNextTask = false;
  this.timeForNextTaskCache = void 0;
  this.concurrencyCache     = void 0;

  return this;
};

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
  this._refreshLeadPriority();

  if (this.options.eventful) {
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
Queue.prototype.add = function Queue$add () {//console.log.apply(console, ['= add'].concat(arguments));
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
    end:      void 0,
    time:     void 0
  };

  this._refreshPrioritiesByTask(this.tasks[key]);

  this.emit && this.emit.call(this, 'task:add', this.getByKey(key));

  self._next();

  return this.getByKey(key);
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.update = function Queue$update (options) {
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  args = slice(args, 1);
  var key = this.getKeyByArgs(args);

  return this.byKeyUpdate(key, options || {});
};

/**
 * @param {string} key
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.byKeyUpdate = function Queue$byKeyUpdate (key, options) {
  var task = this.tasks[key || ''] || null;

  return this._update(task, options || {});
};

/**
 * @param {Queue~task} task
 * @param {{}} options
 * @returns {Queue}
 */
Queue.prototype._update = function Queue$_update (task, options) {
  options = _.isPlainObject(options) ? options : {};

  if (task) {
    delete task.prevs;
    task.prevs = extend({}, task);

    this.tasks[task.key] = extend({
      priority: task.priority
    }, options, {
      args:   task.args,
      key:    task.key,
      status: task.status,
      index:  task.index,
      start:  task.start,
      end:    task.end,
      time:   task.time
    });

    task = this.tasks[task.key];

    // validate priority
    task.priority = parseInt(task.priority, 10);
    task.priority = (_.isNumber(task.priority))
      ? task.priority
      : task.prevs.priority || this.options.defaultPriority;

    this._refreshPrioritiesByTask(task);

    this.emit && this.emit.call(this, 'task:update', this.getByKey(task.key));
  }

  return this;
};

/**
 * @param {Queue~task} task
 * @returns {Queue}
 * @private
 */
Queue.prototype._refreshPrioritiesByTask = function Queue$_refreshPrioritiesByTask (task) {
  this.priorities[task.priority] = this.priorities[task.priority] || [];
  this.priorities[task.priority].push(task.key);

  var priorityOld = keypather.get(task, 'prevs.priority');
  if (priorityOld && priorityOld != task.priority && this.priorities[priorityOld]) {
    // удаляет из массива этот ключ
    _.pull(this.priorities[priorityOld], task.key);

    this._tidyPriorities();
  }

  return this;
};

/**
 * @private
 * @returns {Queue}
 */
Queue.prototype._tidyPriorities = function Queue$_tidyPriorities () {//console.log.apply(console, ['= _tidyPriorities'].concat(arguments));
  _.each(_.keys(this.priorities), (priority) => {
    if (!this.priorities[priority].length) {
      delete this.priorities[priority];
    }
  });

  this._refreshLeadPriority();

  return this;
};

/**
 * @private
 * @returns {Number}
 */
Queue.prototype._refreshLeadPriority = function Queue$_refreshLeadPriority () {//console.log.apply(console, ['= _refreshLeadPriority'].concat(arguments));
  this.leadPriority = _.min(_.keys(this.priorities).concat(this.options.defaultPriority));

  return this.leadPriority;
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {//console.log.apply(console, ['= has'].concat(arguments));
  var args; for (var i = arguments.length, a = args = new Array(i); i--; a[i] = arguments[i]) {}
  var key = this.getKeyByArgs(args);

  return this.tasks[key] || false;
};

/**
 * @param {...*}
 * @returns {*}
 */
Queue.prototype.get = function Queue$get () {//console.log.apply(console, ['= get'].concat(arguments));
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
      end:      task.end,
      time:     task.time
    };
  }

  return void 0;
};

/**
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.delete = function Queue$delete () {//console.log.apply(console, ['= delete'].concat(arguments));
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

  if (this._delete(task)) {
    this.emit && this.emit.call(this, 'task:delete', task);
  }

  return this;
};

/**
 * @private
 * @param {Queue~task} task
 * @returns {boolean}
 */
Queue.prototype._delete = function Queue$_delete (task) {
  if (task) {
    delete this.tasks[task.key];
    this._deleteTaskFromPriorities(task);

    return true;
  }

  return false;
};

/**
 * @private
 * @params {Queue~task} task
 */
Queue.prototype._deleteTaskFromPriorities = function Queue$_deleteTaskFromPriorities (task) {
  if (task && this.priorities[task.priority]) {
    _.pull(this.priorities[task.priority], task.key);
    // обновляем очереди по приоритету
    this._tidyPriorities();
  }
};

/**
 * @returns {Queue}
 */
Queue.prototype.clear = function Queue$clear () {//console.log.apply(console, ['= clear'].concat(arguments));
  this.tasks      = {};
  this.priorities = {};
  this._tidyPriorities();

  this.emit && this.emit('clear');

  return this;
};

/**
 * @param {...*}
 * @returns {string|undefined}
 */
Queue.prototype.statusOf = function Queue$statusOf () {//console.log.apply(console, ['= statusOf'].concat(arguments));
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
Queue.prototype.isNew = function Queue$isNew () {//console.log.apply(console, ['= isNew'].concat(arguments));
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
Queue.prototype.isPending = function Queue$isPending () {//console.log.apply(console, ['= isPending'].concat(arguments));
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
Queue.prototype.isDone = function Queue$isDone () {//console.log.apply(console, ['= isDone'].concat(arguments));
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
 * @returns {Queue}
 */
Queue.prototype.pause = function Queue$pause () {//console.log.apply(console, ['= pause'].concat(arguments));
  this.paused = true;

  return this;
};

/**
 * @returns {Queue}
 */
Queue.prototype.resume = function Queue$resume () {//console.log.apply(console, ['= resume'].concat(arguments));
  this.paused = false;
  this._next();

  return this;
};

/**
 * @returns {boolean}
 */
Queue.prototype.isPaused = function Queue$isPaused () {//console.log.apply(console, ['= isPaused'].concat(arguments));
  return this.paused;
};

/**
 * @private
 * @returns {Queue}
 */
Queue.prototype._next = function Queue$_next () {
  console.log('===');
  console.log('= _next()');
  console.log('  this.waitingForNextTask', !!this.waitingForNextTask);

  if (this.isPaused() || !!this.waitingForNextTask) { return this; }

  this.nextTask = this.nextTask || this._findNextTask();
  var allowed   = this._nextTaskAllowed();
  //console.log('  _nextTaskAllowed()', allowed);
  //console.log('next task', task);
  //console.log('this.nextTask', this.nextTask);

  if (this.nextTask) {
    if (allowed) {
      this._runTask(this.tasks[this.nextTask.key]);
      this.nextTask = null;
    } else if (!this.waitingForNextTask) {
      let waitingTime = this._getTimeForNextTask();
      if (!waitingTime) {

      } else {
        console.log('wait time:', waitingTime);
        this.waitingForNextTask = setTimeout(() => {
          //console.log('- "waiting for next stop"');
          this.waitingForNextTask = false;
          this._next();
        }, waitingTime);
      }
    }
  } else if (!this.runnedCount) {
    this.emit && this.emit('empty');
  }

  return this;

  //if (allowed) {
  //  if (this.nextTask) {
  //    // обнуляем кэш возможно сложных внешних вычислений
  //    //this.timeForNextTaskCache = void 0;
  //    //this.concurrencyCache = void 0;
  //
  //    this._runTask(this.tasks[this.nextTask.key]);
  //    this.nextTask = null;
  //  } else if (!this.runnedCount) {
  //    this.emit && this.emit('empty');
  //  }
  //} else if (!this.waitingForNextTask && this.nextTask) {
  //  this.waitingForNextTask = true;
  //  let waitingTime = this._getTimeForNextTask();// + 10;
  //  console.log('- "waiting for next start". waitingTime:', waitingTime);
  //  setTimeout(() => {
  //    console.log('- "waiting for next stop"');
  //    this.waitingForNextTask = false;
  //    this._next();
  //  }, waitingTime);
  //}
  //
  //return this;
};

/**
 * @returns {boolean}
 */
Queue.prototype._nextTaskAllowed = function Queue$_nextTaskAllowed () {
  var concurrency = this._getConcurrency();
  var timeForNextTask = this._getTimeForNextTask();

  //console.log('  timeForNextTask', timeForNextTask);

  return (
    this.runnedCount < concurrency &&
    !timeForNextTask
  );
};

/**
 * @returns {number}
 */
Queue.prototype._getConcurrency = function Queue$_getConcurrency () {//console.log.apply(console, ['= _getConcurrency'].concat(arguments));
  return _result(this.options, 'concurrency', this);

  return (typeof this.concurrencyCache != 'undefined')
    ? this.concurrencyCache
    : (this.concurrencyCache = _result(this.options, 'concurrency', this));
};

/**
 * @returns {number}
 */
Queue.prototype._getTimeForNextTask = function Queue$_getTimeForNextTask () {//console.log.apply(console, ['= _getTimeForNextTask'].concat(arguments));
  return this._calcTimeForNextTask();

  return (typeof this.timeForNextTaskCache != 'undefined')
    ? this.timeForNextTaskCache
    : (this.timeForNextTaskCache = this._calcTimeForNextTask());

  // todo: удалить
  var time;
  var now = Date.now();

  // кэшируем вычисление оставшегося времени сроком на это же оставшееся время
  if (!!this.calcTimeForNextTaskLastTime && now - this.calcTimeForNextTaskLastTime < this.calcTimeForNextTaskValue) {
    time = this.calcTimeForNextTaskValue;
  } else {
    // потому что в этой функции _могут быть_ долгие внешние вычисления
    time = this._calcTimeForNextTask();
    this.calcTimeForNextTaskValue    = time;
    this.calcTimeForNextTaskLastTime = now;
  }

  return time;
};

/**
 * @returns {number}
 */
Queue.prototype._calcTimeForNextTask = function Queue$_calcTimeForNextTask () {//console.log.apply(console, ['= _calcTimeForNextTask'].concat(arguments));
  var now      = Date.now();
  var throttle = _result(this.options, 'throttle', this);
  var debounce = _result(this.options, 'debounce', this);
  throttle     = (_.isNumber(throttle = parseInt(throttle, 10)) && throttle >= 0) ? throttle : 0;
  debounce     = (_.isNumber(debounce = parseInt(debounce, 10)) && debounce >= 0) ? debounce : 0;

  var times = [];
  times.push(this.lastTaskTimes.start ? throttle - (now - this.lastTaskTimes.start) : 0);
  times.push(this.lastTaskTimes.end   ? debounce - (now - this.lastTaskTimes.end)   : 0);

  // возвращаем максимально оставшееся
  return _.max(_.map(times, (time) => {
    // отрицательное время не возвращаем
    return (time < 0) ? 0 : time;
  }));
};

/**
 * @private
 * @returns {?Queue~task}
 */
Queue.prototype._extractNextTask = function Queue$_extractNextTask () {//console.log.apply(console, ['= _extractNextTask'].concat(arguments));
  var task = this._findNextTask();

  // если таск для постановку на выполнение найден,
  if (task) {
    // то всё хорошо. просто удалим его из приоритетной очереди
    this._extractTask(task);
  }

  return task;
};

/**
 * @private
 * @params {Queue~task} task
 * @returns {?Queue~task}
 */
Queue.prototype._extractTask = function Queue$_extractTask (task) {//console.log.apply(console, ['= _extractTask'].concat(arguments));
  if (task) { this._deleteTaskFromPriorities(task); }

  return task;
};

/**
 * @private
 * @returns {?Queue~task}
 */
Queue.prototype._findNextTask = function Queue$_findNextTask () {//console.log.apply(console, ['= _findNextTask'].concat(arguments));
  console.log('= _findNextTask()');
  var priorityQueue;
  var taskKey = null;

  if (!!this.priorities[this.leadPriority]) {
    priorityQueue = this.priorities[this.leadPriority];
    taskKey = _.find(priorityQueue, (_taskKey) => {
      return this._isNew(this.tasks[_taskKey]);
    });

    // если тасков со статусом `new` и этим приоритетом нету,
    if (!taskKey) {
      // то удаляем очередь с этим приоритетом (ибо в ней всё-равно для постановки в очередь ничего нету)
      //delete this.priorities[this.leadPriority];
      // обновляем очереди по приоритету (там же обновится и `this.leadPriority`, и удалятся пустые приоритеты (проверки на _isNew там нет!))
      this._tidyPriorities();
    }
  } else {
    this._tidyPriorities();
  }

  if (!taskKey && !!this.priorities[this.leadPriority]) {
    // рекурсивно ищем таск по новой
    taskKey = this._findNextTask();
  }

  return taskKey ? this.getByKey(taskKey) : null;
};

/**
 * @param {Queue~task} task
 * @private
 */
Queue.prototype._runTask = function Queue$_runTask (task) {
  var self = this;
  var now = Date.now();
  task.start               = now;
  task.status              = STATUS_PENDING;
  self.lastTaskTimes.start = now;
  self.runnedCount++;

  console.log('= _runTask()', this.runnedCount, this.finishedCount);

  functionDone(function (done) {
    self.emit && self.emit.call(self, 'task:start', self.getByKey(task.key));

    return self.fn.apply(self.options.ctx || null, task.args.concat(done));
  }, (function (taskKey) {
    return function (err, result) {
      //console.log('= functionDone done', taskKey);
      //console.log('self.tasks', self.tasks);

      var now                = Date.now();
      var task               = self.tasks[taskKey];
      task.end               = now;
      task.time              = task.end - task.start;
      task.status            = STATUS_DONE;
      self.lastTaskTimes.end = now;

      ++self.finishedCount;
      --self.runnedCount;

      var deleted = false;
      if (!self.options.history) {
        deleted = true;
        self._delete(task);
      } else {
        self._deleteTaskFromPriorities(task);
      }

      self.emit && self.emit.call(self,
        'task:done',
        err,
        (typeof result != 'undefined') ? result : void 0,
        (deleted) ? task : self.getByKey(task.key)
      );

      self._next();
    };
  })(task.key));
};

module.exports = Queue;
