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
  } else {
    this.NS_SEPARATOR =
    this._isListener =
    this._parseEventName =
    this._buildEventName =
    this.getListeners =
    this._parseListeners =
    this.on =
    this.bind =
    this.addListener =
    this.one =
    this.once =
    this.off =
    this.unbind =
    this.removeListener =
    this.emit =
    this.trigger =
    this.returnListenersResults = null;
  }

  return this.options;
};

/**
 * @param {*} input
 * @returns {string}
 */
  // todo: убрать подсчёт времени
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
 * @returns {Queue~task}
 */
Queue.prototype.add = function Queue$add () {
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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

  return this.getByKey(key);
};

/**
 * @param {{}} options
 * @param {...*}
 * @returns {Queue}
 */
Queue.prototype.setupTask = function Queue$setupTask (options) {
  var args = slice(arguments, 1),
      key = this.getKeyByArgs(args);

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
    var previousPriority = this.tasks[task.key].priority;
    this.tasks[task.key] = _.merge(options, {
      args:   task.args,
      key:    task.key,
      status: task.status,
      index:  task.index,
      start:  task.start,
      end:    task.end
    });

    this.tasks[task.key].priority = parseInt(this.tasks[task.key], 10);
    this.tasks[task.key].priority = this.tasks[task.key].priority || this.options.defaultPriority;

    this._updatePrioritiesByTask(this.tasks[task.key], previousPriority);
  }

  return this;
};

/**
 * @param {Queue~task} task
 * @param {Number} [previousPriority]
 * @returns {Queue}
 * @private
 */
Queue.prototype._updatePrioritiesByTask = function Queue$_updatePrioritiesByTask (task, previousPriority) {
  this.priorities[task.priority] = this.priorities[task.priority] || [task.key];

  if (!!previousPriority && previousPriority != task.priority && this.priorities[previousPriority]) {
    var index = this.priorities[previousPriority].indexOf(task.key);
    if (index >= 0) {
      this.priorities[previousPriority].splice(index, 1);
    }
  }

  return this;
};

/**
 * @param {...*}
 * @returns {boolean}
 */
Queue.prototype.has = function Queue$has () {
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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
  var args = slice(arguments),
      key = this.getKeyByArgs(args);

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


Queue.prototype.next = function Queue$next () {
  var task = this._getPrimaryTask();


};

/**
 * @private
 * @returns {Queue~task}
 */
Queue.prototype._getPrimaryTask = function Queue$_getPrimaryTask () {
  var primaryPriority = _.min(_.keys(this.priorities));


};

Queue.prototype._getFirstTaskByPriority = function Queue$_getFirstTaskByPriority (priority) {
  if (_.isArray(this.priorities[priority])) {
    return _.find(this.priorities[priority], (key) => this.byKeyIsNew(key));
  }

  return void 0;
};

Queue.prototype.dequeue = function Queue$dequeue () {
  var firstPriority = this._getFirstPriority();


};


/**
 * @returns {Number}
 * @private
 */
Queue.prototype._getFirstPriority = function Queue$_getFirstPriority () {
  var priorities = _.keys(this.priorities);
  var firstPriority = _.min(priorities);

  if (_.isArray(firstPriority) && firstPriority.length) {
    return firstPriority;
  }

  delete this.priorities[firstPriority];

  return this._getFirstPriority();
};


Queue.prototype.run = function Queue$run () {
  var firstPriority = this._getFirstPriority();

};






module.exports = Queue;



//return;


var q = new Queue(function () {
  console.log.apply(console, ['add new task with args:'].concat(arguments));
});

q.setOptions({
  defaultPriority: 9000
});

q.on('add', function (task) {
  var args = slice(arguments);
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
