/*jslint indent: 2, maxlen: 80, continue: false, unparam: false, node: true */
/* -*- tab-width: 2 -*- */
'use strict';

function usageDemo(require) {
  var test = require('./test.js'),
    ReadFileCache = require('readfile-cache-pmb'),
    cache = new ReadFileCache();

  test.then(function readme1(next) {

    cache.readFile('README.md', function (err, text) {
      test.expect(err === null);
      var lines = text.split(/\n/);
      test.expect(text[0] === '\uFEFF');
      test.expect(lines.indexOf('```javascript') > 8);
      test.expect(lines[3].startsWith('Cache buffers from'));
      next();
    });

  }).then(function packageJson1(next) {

    cache.readFile('package.json', 'JSON', function (err, data) {
      test.expect(err === null);
      test.expect(data.name === "readfile-cache-pmb");
      test.expect(data.scripts.test === "nodejs test.js");
      next();
    });

  }).then(function fileDescriptorNumber(next) {

    cache.readFile(3, function (err, data) {
      test.expect(err.message.match(/must be\b[\s\S]* string/i) && true);
      test.expect(data === undefined);
      next();
    });

  });
  return cache;
}


var EX = module.exports, pathLib = require('path'), taskQ = [],
  cache = require('readfile-cache-pmb'),
  eq = require('assert').deepStrictEqual;

EX.testNames = [
  'readme1',
  'packageJson1',
  'fileDescriptorNumber',
  'real404txt1',
  'custom404txt1',
  'custom404html1',
  'readme2',
  'packageJson2',
];

EX.expect = eq.bind(null, true);

EX.then = function (func) {
  taskQ.push(func);
  return EX;
};

cache = usageDemo(function (mod) { return this[mod](); }.bind({
  'readfile-cache-pmb': function () { return cache; },
  './test.js': function () { return EX; },
}));

cache.debugLog = console.log.bind(console, 'D:');

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
  eq(taskQ.done, EX.testNames);
});


function customFileRead(fn, enc, done) {
  fn = pathLib.basename(fn);
  var data = customFileRead[fn];
  eq(enc, null);
  if (!data) { return done(new Error('404: ' + fn)); }
  // console.dir({ fn: fn, data: data });
  data = new Buffer(data);
  return done(null, data);
}
customFileRead['404.txt'] = [0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0xC0, 0xFF, 0xEE];

EX.then(function real404txt1(next) {
  cache.readFile('404.txt', function (err, data) {
    eq(((err instanceof Error) ? '-ERR' : err), '-ERR');
    eq(data, undefined);

    cache.fsReadFileFunc = customFileRead;

    next();
  });
});


EX.then(function custom404txt1(next) {
  cache.readFile('404.txt', Buffer, function (err, data) {
    eq(err, null);
    eq(((data instanceof Buffer) ? 'buffer' : data), 'buffer');
    eq(data.slice(0, 2), new Buffer([0xDE, 0xAD]));
    next();
  });
});

EX.then(function custom404html1(next) {
  cache.readFile('404.html', Buffer, function (err, data) {
    eq(((err instanceof Error) ? '-ERR' : err), '-ERR');
    eq(data, undefined);
    next();
  });
});

EX.then(function readme2(next) {
  cache.readFile('README.md', 'UTF-8-noBOM', function (err, text) {
    eq(err, null);  // it was cached when we used the default file system read
    eq(text[0], '\n');
    eq(text.split(/\n/)[3].match(/buf\w+/)[0], 'buffers');
    next();
  });
});

EX.then(function packageJson2(next) {
  cache.readFile('package.json', Buffer, function (err, data) {
    eq(err, null);
    eq(data[0], '{'.charCodeAt(0));
    next();
  });
});





















taskQ.next();
