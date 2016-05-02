var _        = require('lodash'),
    humanize = require('humanize'),
    funcDone = require('async-done');
    //funcDone = require('../function-done');

var logTimeMap = new Map();
var logTime = function logTime (label, fn) {
  if (!_.isString(label)) {
    throw new Error('Label is required');
  }
  if (!_.isFunction(fn)) {
    throw new Error('Function is required');
  }


  var data = {
    start: {
      time: Date.now(),
      memory: process.memoryUsage()
    }
  };

  logTimeMap.set(label, data);

  funcDone(fn, function () {
    var data = logTimeMap.get(label);

    data.end = {
      time: Date.now(),
      memory: process.memoryUsage()
    };

    logTimeMap.delete(label);

    console.log([
      '',
      '=== '+ label +' ===',
      'time:              '+ humanize.numberFormat(data.end.time - data.start.time, 0, '.', ' ') +' ms',
      'memory rss:        '+ humanize.filesize(data.end.memory.rss - data.start.memory.rss, 1024, 3, '.', ' '),
      'memory heapTotal:  '+ humanize.filesize(data.end.memory.heapTotal - data.start.memory.heapTotal, 1024, 3, '.', ' '),
      'memory heapUsed:   '+ humanize.filesize(data.end.memory.heapUsed - data.start.memory.heapUsed, 1024, 3, '.', ' '),
    ].join('\n'), '\n');
  });
};

module.exports = logTime;