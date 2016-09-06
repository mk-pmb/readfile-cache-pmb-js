
readfile-cache-pmb
===================
Cache buffers from fs.readFile, deliver as needed.

  * If an encoding is requested. convert and deliver as string.
    * Supported encodings include `utf-8-no-bom`, `utf8noBOM`,
      `JSON`, `json`, `buffer`, and the defaults.
    * If encoding  is `undefined` or omitted, it defaults to UTF-8.
      Give `null` or `buffer` if you want a buffer.
  * Magic filenames (prepend `./` to avoid):
    * `-` = stdin
  * Want to read from something other than your file system?
    Just set `cache.fsReadFileFunc` to your reader function.


Usage
-----
from [test.js](test.js):
```javascript
  var test = require('./test.js'),
    ReadFileCache = require('readfile-cache-pmb'),
    cache = new ReadFileCache();

  test.then(function readme1(next) {

    cache.readFile('README.md', function (err, text) {
      test.expect(err === null);
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
      test.eq(data, undefined);
      next();
    });

  });
```


License
-------
ISC
