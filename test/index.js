var _         = require('lodash'),
    slice     = require('sliced'),
    hash      = require('object-hash'),
    logTime   = require('../lib/log-time');


var calcTimeForNextTaskLastTime = null;
var calcTimeForNextTaskValue    = null;

var calcTimeForNextTask = function calcTimeForNextTask () {
  return 1000;
};

var getTimeForNextTask = function getTimeForNextTask () {
  var time;
  var now = Date.now();

  // кэшируем вычисление оставшегося времени
  if (!!calcTimeForNextTaskLastTime && now - calcTimeForNextTaskLastTime < calcTimeForNextTaskValue) {
    console.log('cached');
    time = calcTimeForNextTaskValue;
  } else {
    console.log('recalc');
    time = calcTimeForNextTask();
    calcTimeForNextTaskValue    = time;
    calcTimeForNextTaskLastTime = now;
  }

  return time;
};

setInterval(function () {
  getTimeForNextTask();
}, 200);








return;

(function () {
  var args = slice(arguments);
  var arr = [];

  logTime('hashing', function () {
    var hashValue;

    hashValue = {
      index: 1,
      args: args
    };
    //hashValue = Immutable.List();

    console.log('hashValue', hashValue);
    console.log('hash', hash(hashValue));

    return true;
  });

  return;

  arr.push({
    index: 1,
    args: args
  });

  var returnArgs = function returnArgs () {
    return slice(arguments);
  };

  console.log(_.find(arr, {args: returnArgs(args)}));

})({qwe: 123, method: function () { return null; }}, 'zxc', function (err, res) {
  console.log('its callback');
});
