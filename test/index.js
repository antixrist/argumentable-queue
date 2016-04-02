var _         = require('lodash'),
    slice     = require('sliced'),
    hash      = require('object-hash'),
    logTime   = require('../lib/log-time');

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

})({qwe: 123}, 'zxc', function (err, res) {
  console.log('its callback');
});
