var slice     = require('sliced'),
    Immutable = require('immutable');

(function () {
  var args = slice(arguments);
  var map = new Map();
  var imMap = Immutable.Map();

  imMap = imMap.set(Immutable.List(args), 'listofone');

  console.log('imMap.get(Immutable.List(args))', imMap.get(Immutable.List(args)));

  var getMapKey = function (args) {
    return new Set(args);
  };

  map.set(getMapKey(args), 'asd');

  console.log('getMapKey(args)', getMapKey(args));
  console.log('getMapKey(args) == getMapKey(args)', getMapKey(args) == getMapKey(args));
  console.log('Object.is(getMapKey(args), getMapKey(args))', Object.is(getMapKey(args), getMapKey(args)));
  console.log('map.get(getMapKey(args))', map.get(getMapKey(args)));

  function test () {
    var _args = slice(arguments);
    return map.get(getMapKey(_args));
  }

  console.log('test.apply(null, args)', test.apply(null, args));

  console.log('test.apply(null, args) === test.apply(null, args)', test.apply(null, args) === test.apply(null, args));

})({qwe: 123}, 'zxc', function (err, res) {
  console.log('its callback');
});
