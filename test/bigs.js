var memwatch = require('memwatch-next');

var sleep = function sleep (time) {
  var tstart = Date.now();
  while(Date.now() - tstart < parseInt(time, 10)) {}
};

var iterator = function iterator (cb) {
  var data = [];
  var max = 500;

  var i = 0;
  while (i < max) {
    //console.log('add', i);
    data.push((new Array(1000000)).join('*'));
    i++;

    sleep(10);
  }

  console.log('length:', data.length);

  while(i-- > 0) {
    //console.log('remove', i);
    data[i] = null;
    data.splice(i, 1);

    if (i % 50 == 0) {
      console.time('gc');
      memwatch.gc();
      console.timeEnd('gc');
    }

    sleep(50);
  }

  console.log('length:', data.length);

  cb();
};

iterator(function () {
  console.log('waiting...');
  setTimeout(function () { console.log('done'); }, 10000);
});
