//require('fs').writeFileSync(require('path').join(__dirname, 'tmp.txt'), (new Array(1000000)).join('*'));
//return;

var Queue   = require('../lib'),
    _       = require('lodash'),
    nextTick = require('next-tick'),
    Promise = require('bluebird'),
    logTime = require('../lib/log-time'),
    chalk   = require('chalk'),
    blue = chalk.blue,
    green = chalk.green
;


var q = new Queue(function (obj, done) {
  //console.log('========= QUEUE fn =========');
  //console.log.apply(console, ['args:'].concat(arguments));
  //console.log('========= //QUEUE fn =========');

  //done(new Error('From callback'));

  //setTimeout(done, 700);

  //setTimeout(function () {
  //  done();
  //  //done(null, obj);
  //}, 700);

  return Promise
    .resolve()
    //.delay(_.random(500, 1000))
    .delay(3000)
    //.then(function () {
    //  //return Promise.reject(new Error('From promise'));
    //  throw new Error('its error');
    //})
    .then(function () {
      return obj;
    })
  ;
});

q.setOptions({
  //history: true,
  defaultPriority: 9000,
  concurrency: function () {
    return 5;
  },
  //throttle: function () {
  //  return 30 + ' ';
  //},
  debounce: function () {
    return 2000;
    return _.random(300, 1200);
  }
});

//q.on('task:add', function (task) {
//  //console.log('add');
//  //console.log('========= EVENT: task:add =========');
//  //console.log.apply(console, ['args:'].concat(arguments));
//  //console.log('========= //EVENT: task:add =========');
//});

q.on('task:start', function (task) {
  //if (task.args[0].index == 5) {
  //  console.log('5 task', task == _task);
  //  console.log('5 task', task.args == _task.args);
  //}

  console.log(blue('['+ task.start +']'), '#'+ blue(task.index));
  //console.log('inProgress:', chalk.inverse(q.inProgressCount) +';', 'in queue:', chalk.inverse(_.size(q.tasks)));
  //console.log('========= EVENT: task:start =========');
  //console.log('task', task);
  //console.log('========= //EVENT: task:start =========');
  //task = null;
});

q.on('task:done', function (/*err, result, task*/) {
  //console.log(green('['+ q.lastTaskTimes.end +']'), '#'+ blue(task.index));
//  //if (task.index % 100 == 0) {
//    console.log('#'+ task.index +';', 'time:', task.time);
    console.log(
      'in progress:', blue(this.inProgressCount) +';',
      'in queue:', blue(this.size) +';',
      'finished:', blue(this.finishedCount)
    );
//  //}
////  console.log('========= EVENT: task:done =========');
////  console.log('err, result', err, result);
////  console.log('task.time', task.time);
////  ////console.log('q.tasks', q.tasks);
////  ////console.log('q.priorities', q.priorities);
////  console.log('========= //EVENT: task:done =========');
//  task = null;
});

//q.on('empty', function () {
//  console.log('========= EVENT: empty =========');
//  console.log('finished:', blue(this.finishedCount));
//  console.log('========= //EVENT: empty =========');
//});


var number = 0;
var batch = 0;
var max = 100;

var getBigData = function getBigData () {
  //return [];
  return (new Array(1000000)).join('*');
};

var i;
var action = function () {
  var _batch = batch || 1;

  //var taskData = {index: ++number, arr: getBigData()};

  for (i=0; i < _batch; i++) {
    q.add({index: ++number, arr: getBigData()});
  }
  //q.add({index: ++number});
  //q.add({index: ++number});
  //q.add({index: ++number});
  //q.add({index: ++number});
  //console.log('========================');

  //q.update({
  //  //priority: q.options.defaultPriority - number
  //}, { index: number }, 'qwe');

  if (number < max) {
    //if (number == 5) {
    //  _task = q.get(taskData);
    //}
    //if (number % 100 == 0) {
    //  console.log(number);
    //}
    iterable();
  } else {
    //q.tasks.forEach(function (value, key) {
    //  console.log('key:', key);
    //  console.log('value:', value);
    //  console.log('============');
    //});

    //console.log('q.tasks', q.tasks);
    //q.clear();
    //console.log('q.tasks', q.tasks);

    //cb();
  }
};
function iterable () {
  setImmediate(action);
}
iterable();


return;


var queue = new Queue(function (url) {
  return superagent.get(url).then(function (response) {
    collectUrls(response).forEach(queue);
  });
}, {config: 123});

queue('http://yandex.ru');



















return;



var assert = require('assert');
//var Promise = require('bluebird');


describe("Mocha Async Test", function(){
  var q = new Queue(function () {

  }, {

  });


  beforeEach(function(done){
    setTimeout(function(){

      // complete the async beforeEach
      done();
    }, 1500);
  });

  it("flag should be true", function(){
    assert(flag === true);
  });
});



return;

//var _         = require('lodash'),
//    slice     = require('sliced'),
//    hash      = require('object-hash'),
//    logTime   = require('../lib/log-time');
//
//
//var calcTimeForNextTaskLastTime = null;
//var calcTimeForNextTaskValue    = null;
//
//var calcTimeForNextTask = function calcTimeForNextTask () {
//  return 1000;
//};
//
//var getTimeForNextTask = function getTimeForNextTask () {
//  var time;
//  var now = Date.now();
//
//  // кэшируем вычисление оставшегося времени
//  if (!!calcTimeForNextTaskLastTime && now - calcTimeForNextTaskLastTime < calcTimeForNextTaskValue) {
//    console.log('cached');
//    time = calcTimeForNextTaskValue;
//  } else {
//    console.log('recalc');
//    time = calcTimeForNextTask();
//    calcTimeForNextTaskValue    = time;
//    calcTimeForNextTaskLastTime = now;
//  }
//
//  return time;
//};
//
//setInterval(function () {
//  getTimeForNextTask();
//}, 200);
//
//
//
//
//
//
//
//
//return;
//
//(function () {
//  var args = slice(arguments);
//  var arr = [];
//
//  logTime('hashing', function () {
//    var hashValue;
//
//    hashValue = {
//      index: 1,
//      args: args
//    };
//    //hashValue = Immutable.List();
//
//    console.log('hashValue', hashValue);
//    console.log('hash', hash(hashValue));
//
//    return true;
//  });
//
//  return;
//
//  arr.push({
//    index: 1,
//    args: args
//  });
//
//  var returnArgs = function returnArgs () {
//    return slice(arguments);
//  };
//
//  console.log(_.find(arr, {args: returnArgs(args)}));
//
//})({qwe: 123, method: function () { return null; }}, 'zxc', function (err, res) {
//  console.log('its callback');
//});
