/*jslint indent: 2, maxlen: 80, continue: false, unparam: false, node: true */
/* -*- tab-width: 2 -*- */
'use strict';

var CF, PT, pathLib = require('path'), fs = require('fs');


CF = function ReadFileCache() {
  if (!(this instanceof ReadFileCache)) { return new ReadFileCache(); }
  var impl = { cache: {} };
  this.IMPL = function () { return impl; };
};
PT = CF.prototype;


CF.rf = function () {
  var cache = new CF(), rf;
  rf = function readFileWithCache() {
    return cache.readFile.apply(cache, arguments);
  };
  rf.c = cache;
  return rf;
};


CF.encodeBuffer = function (buf, enc) {
  var lcEnc = (((typeof enc) === 'string')
    && enc.toLowerCase().replace(/\-/g, ''));
  switch (lcEnc || enc) {
  case undefined:
    throw new Error('Internal error: No encoding given! No default?');
  case null:
  case Buffer:
  case 'buffer':
    return buf;
  case JSON:
  case 'json':
  case 'utf8nobom':
    buf = buf.toString('utf-8');
    if (buf[0] === '\uFEFF') { buf = buf.slice(1); }
    break;
  }
  switch (lcEnc || enc) {
  case JSON:
  case 'json':
    return JSON.parse(buf);
  }
  return buf.toString(enc);  // (enc) ignored if buf already is a string.
};


PT.toString = function () {
  return '['.concat(this.constructor.name, ' ', this.name, ']');
};


PT.defaultEncoding = 'utf-8';
PT.fsReadFileFunc = fs.readFile.bind(fs);
PT.debugLog = function (msg) { return msg; };


PT.serveFromCache = function (filename, encoding, deliver) {
  var data = this.IMPL().cache[filename], err = null;
  if ((typeof deliver) !== 'function') {
    throw new Error("Won't try and read file without a delivery function " +
      "to receive its content! File name: " + filename);
  }
  if (!data) { return false; }
  try {
    data = CF.encodeBuffer(data, encoding);
  } catch (bufConvertErr) {
    err = bufConvertErr;
    data = null;
  }
  if (!filename) {
    this.debugLog('serving from cache:', filename,
      String(err || '(no error)'), String(data).length);
  }
  setImmediate(function readFileCache_nowServing() { deliver(err, data); });
  return true;
};


PT.readFile = function (filename, encoding, deliver) {
  switch (encoding && typeof encoding) {
  case undefined:
  case '':
    encoding = this.defaultEncoding;
    break;
  case 'function':
    if (!deliver) {
      deliver = encoding;
      encoding = PT.defaultEncoding;
      switch (deliver) {
      case JSON:
      case Buffer:
        deliver = null;
        break;
      }
    }
    break;
  }
  if ((filename && typeof filename) !== 'string') {
    return deliver(new Error('Filename must be a non-empty string.'));
  }
  switch (filename) {
  case '-':
    filename = 0;
    break;
  default:
    filename = pathLib.resolve(filename);
  }
  if (this.serveFromCache(filename, encoding, deliver)) { return; }
  return this.fsReadFileFunc(filename, null, this.saveAndServe.bind(this,
    filename, encoding, deliver));
};


PT.saveAndServe = function (filename, encoding, deliver, readErr, buf) {
  if (readErr) { return deliver(readErr); }
  this.IMPL().cache[filename] = buf;
  buf.lastRead = Date.now();
  if (this.serveFromCache(filename, encoding, deliver)) { return; }
  return deliver(new Error('cache malfunction'));
};
























module.exports = CF;
