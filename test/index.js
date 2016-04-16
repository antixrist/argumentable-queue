var Queue   = require('../lib'),
    logTime = require('../lib/log-time');

var q = new Queue(function () {
  console.log.apply(console, ['run task with args:'].concat(arguments));

  return true;
});

q.setOptions({
  defaultPriority: 9000,
  concurrency: function () {
    return '10';
  },
  throttle: function () {
    return 200 + ' ';
  },
  debounce: ' '+ 300
});

q.on('add', function (task) {
  console.log('on add', task);
  console.log('============');
});

q.on('done', function (err, result, task) {
  console.log('on done', arguments);
  console.log('============');
});

q.on('empty', function () {
  console.log('on empty. size:', this.size);
});


var number = 0;
var max = 1;

var iterable = function iterable () {
  setImmediate(function () {
    number++;

    q.add({index: number});
    console.log('========================');

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
var Promise = require('bluebird');


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
