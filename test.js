/*jslint indent: 2, maxlen: 80, continue: false, unparam: false, node: true */
/* -*- tab-width: 2 -*- */
'use strict';

function readmeDemo(require) {
  var test = require('./test.js'),
    ReadFileCache = require('readfile-cache-pmb'),
    cache = new ReadFileCache();

  test.then(function readme1(next) {

    cache.readFile('README.md', function (err, text) {
      test.eq(err, null);
      var lines = text.split(/\n/);
      test.eq(text[0], '\uFEFF');
      test.expect(lines.indexOf('```javascript') > 8);
      test.expect(lines[3].startsWith('Cache buffers from'));
      next();
    });

  }).then(function packageJson1(next) {

    cache.readFile('package.json', 'JSON', function (err, data) {
      test.eq(err, null);
      test.eq(data.name, "readfile-cache-pmb");
      test.eq(data.scripts.test, "nodejs test.js");
      next();
    });

  }).then(function fileDescriptorNumber(next) {

    cache.readFile(3, test.expectErrorInvalidFileName(next));

  });

  test.then(function shorthand(next) {

    var readFileC = require('readfile-cache-pmb').rf(),
      // ^-- create new cache and return a bound-to-it version of its .readFile
      customFsRead = function (fn, enc, cb) { cb(fn.substr(-4) + '|' + enc); };

    test.eq((typeof readFileC), 'function');
    test.expect(readFileC.c instanceof ReadFileCache);
    test.expect(readFileC.c !== cache);    // make sure its _another_ cache

    readFileC.c.fsReadFileFunc = customFsRead;

    readFileC('404.asc', 'ascii', function (err, data) {
      test.expect((err === '.asc|null') || err);
      // ^- not '.asc|ascii', because .readFile always requests a buffer
      //    from the file system function, and handles encoding itself.
      test.eq(data, null);
      next();
    });

  });
  // demo end

  return cache;
}


var EX = module.exports, pathLib = require('path'), taskQ = [],
  D = require('lib-demo-util-160404')(module),
  RFCache = require('readfile-cache-pmb');

EX.testNames = [
  'readme1',
  'packageJson1',
  'fileDescriptorNumber',
  'shorthand',
  'real404txt1',
  'useCustomFs1',
  'custom404bin1',
  'custom404html1',
  'readme2',
  'packageJson2',
  'readSameFileAtSameTime',
];

EX.eq = function (a, b) {
  D.result = a;
  D.expect('===', b);

  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch (uneq) {
    uneq.message = uneq.message.replace(/\s+(deepStrictEqual)/, '\n$1');
    throw uneq;
  }
};

EX.expectErrorInvalidFileName = function (next) {
  return function (err, data) {
    EX.eq(err.message.match(/(must be)\b[\s\S]* string/i)[1], 'must be');
    EX.eq(data, null);
    next();
  };
};

EX.then = function (func) {
  taskQ.push(func);
  return EX;
};

EX.collectArgs = function (dest) {
  return function () { dest.push(Array.prototype.slice.call(arguments)); };
};

EX.cache = readmeDemo(function (mod) { return this[mod](); }.bind({
  'readfile-cache-pmb': function () { return RFCache; },
  './test.js': function () { return EX; },
}));

EX.cache.debugLog = console.log.bind(console, 'D:');
EX.rf = EX.cache.readFile.bind(EX.cache);

taskQ.done = [];
taskQ.next = function () {
  var nxt = taskQ.shift();
  if (!nxt) { return; }
  console.log('begin task', nxt.name);
  nxt(function done(err) {
    if (err) { return console.error('task fail:', nxt.name, err); }
    console.log('task done:', nxt.name);
    taskQ.done.push(nxt.name);
    return taskQ.next();
  });
};

process.on('exit', function checkLostCallbacks(retval) {
  if (retval !== 0) { return 'Let node print its exception'; }
  if (taskQ.length) {
    console.error('leftover tasks:',
      taskQ.map(function (func) { return func.name; }));
    process.exit(3);
  }
  EX.eq(taskQ.done, EX.testNames);
});


EX.then(function real404txt1(next) {
  EX.rf('404.txt', function (err, data) {
    EX.eq(((err instanceof Error) ? '-ERR' : err), '-ERR');
    EX.eq(data, null);
    next();
  });
});


function customFileRead(fn, enc, done) {
  fn = pathLib.basename(fn);
  customFileRead.history.push(fn + '|' + enc);
  var data = customFileRead[fn];
  EX.eq(enc, null);
  if (!data) { return done(new Error('404: ' + fn)); }
  // console.dir({ fn: fn, data: data });
  return done(null, Buffer.from(data));
}
customFileRead.history = [];
customFileRead['404.bin'] = [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0xC0, 0xFF, 0xEE];
EX.then(function useCustomFs1(next) {
  EX.cache.fsReadFileFunc = customFileRead;
  next();
});


EX.then(function custom404bin1(next) {
  EX.rf('404.bin', 'hex', function (err, data) {
    EX.eq(err, null);
    EX.eq(data, 'deadbeef' + '00' + 'c0ffee');
    next();
  });
});

EX.then(function custom404html1(next) {
  EX.rf('404.html', 'buffer', function (err, data) {
    EX.eq(((err instanceof Error) ? '-ERR' : err), '-ERR');
    EX.eq(data, null);
    next();
  });
});

EX.then(function readme2(next) {
  EX.rf('README.md', 'UTF-8-noBOM', function (err, text) {
    EX.eq(err, null);
    // ^-- because it was cached when we used the default file system read
    EX.eq(text[0], '\n');
    EX.eq(text.split(/\n/)[3].match(/buf\w+/)[0], 'buffers');
    next();
  });
});

EX.then(function packageJson2(next) {
  EX.rf('package.json', 'buffer', function (err, data) {
    EX.eq(err, null);
    EX.eq(data[0], '{'.charCodeAt(0));
    next();
  });
});



EX.then(function readSameFileAtSameTime(next) {
  var fsReads = [], rcv = [];
  fsReads.collect = EX.collectArgs(fsReads);

  EX.cache.fsReadFileFunc = EX.collectArgs(fsReads);

  rcv.collect = EX.collectArgs(rcv);
  EX.rf('all@once.txt', 'buffer', rcv.collect);
  EX.rf('all@once.txt', 'json', rcv.collect);
  EX.rf('all@once.txt', 'UTF-8', rcv.collect);
  EX.eq(EX.deepTypes(fsReads), 1);

  setTimeout(next, 10);
});





















taskQ.next();
