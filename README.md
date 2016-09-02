
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
```


License
-------
ISC
