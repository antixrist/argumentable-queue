var Queue   = require('../lib'),
    Promise = require('bluebird'),
    logTime = require('../lib/log-time');

var q = new Queue(function (obj, done) {
  //console.log('========= QUEUE fn =========');
  //console.log.apply(console, ['args:'].concat(arguments));
  //console.log('========= //QUEUE fn =========');

  //done(new Error('From callback'));

  return Promise
    .delay(500)
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
  history: true,
  defaultPriority: 9000,
  concurrency: function () {
    return '10';
  },
  //throttle: function () {
  //  return 200 + ' ';
  //},
  //debounce: ' '+ 300
});

//q.on('task:add', function (task) {
//  console.log('========= EVENT: task:add =========');
//  console.log.apply(console, ['args:'].concat(arguments));
//  console.log('========= //EVENT: task:add =========');
//});

//q.on('task:start', function (task) {
//  console.log('========= EVENT: task:start =========');
//  console.log.apply(console, ['args:'].concat(arguments));
//  //console.log('q.byKeyStatusOf(task.key)', q.byKeyStatusOf(task.key));
//  console.log('========= //EVENT: task:start =========');
//});

var time = Date.now();
q.on('task:done', function (err, result, task) {
  console.log('========= EVENT: task:done =========');
  console.log('err, result', err, result);
  console.log('task.time', task.time, '; index:', result.index);
  console.log('elapsed time', Date.now() - time);
  console.log('runnedCount', this.runnedCount);
  time = Date.now();
  //console.log.apply(console, ['args:'].concat(arguments));
  ////console.log('q.tasks', q.tasks);
  ////console.log('q.priorities', q.priorities);
  console.log('========= //EVENT: task:done =========');
});

q.on('empty', function () {
  console.log('========= EVENT: empty =========');
  console.log('size:', this.size);
  console.log('finishedCount:', this.finishedCount);
  console.log('========= //EVENT: empty =========');
});


var number = 0;
var max = 20;

var iterable = function iterable () {
  setImmediate(function () {
    number++;

    q.add({index: number});
    //q.add({index: ++number});
    //q.add({index: ++number});
    //q.add({index: ++number});
    //q.add({index: ++number});
    //console.log('========================');

    //q.update({
    //  //priority: q.options.defaultPriority - number
    //}, { index: number }, 'qwe');

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
      //q.clear();
      //console.log('q.tasks', q.tasks);

      //cb();
    }
  });
} ();


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
