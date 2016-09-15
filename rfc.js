/*jslint indent: 2, maxlen: 80, continue: false, unparam: false, node: true */
/* -*- tab-width: 2 -*- */
'use strict';

var CF, PT, pathLib = require('path'), fs = require('fs');

function malf(why, filename) {
  throw new Error('internal cache malfunction: ' + why +
    ' for file "' + filename + '"');
}


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
  var cache = this.IMPL().cache, cEntry = cache[filename], data, err;
  if ((typeof deliver) !== 'function') {
    throw new Error("Won't try and read file without a receiver function " +
      "for its content! File name: " + filename);
  }
  if (!cEntry) {
    cache[filename] = { lastRead: 0, buf: null, err: null,
      subscribers: [ { enc: encoding, rcv: deliver } ] };
    return false;
  }
  if (cEntry.subscribers) {
    cEntry.subscribers.push({ enc: encoding, rcv: deliver });
    return true;
  }
  err = cEntry.err;
  data = cEntry.buf;
  if (!err) {
    if (!data) { malf('neither error nor data', filename); }
    try {
      data = CF.encodeBuffer(data, encoding);
    } catch (bufConvertErr) {
      err = bufConvertErr;
      data = null;
    }
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
    return deliver(new Error('Filename must be a non-empty string.'), null);
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
    filename));
};


PT.saveAndServe = function (filename, readErr, buf) {
  var cEntry = this.IMPL().cache[filename], subscr;
  if (!cEntry) { malf('no subscribers', filename); }
  subscr = cEntry.subscribers;
  delete cEntry.subscribers;
  cEntry.lastRead = Date.now();
  if ((!readErr) && (!Buffer.isBuffer(buf))) {
    readErr = 'File system read reported succeess but instead of a buffer, ' +
      'it gave ' + String(buf);
    readErr = new Error(readErr);
  }
  if (readErr) {
    cEntry.err = readErr;
    cEntry.buf = null;
  } else {
    cEntry.err = null;
    cEntry.buf = buf;
  }
  if (!subscr) { malf('no subscribers list', filename); }
  if (subscr.length < 1) { malf('empty subscribers list', filename); }
  subscr.forEach(setImmediate.bind(null,
    this.notifyOneCacheFileSubscriber.bind(this, filename, cEntry)));
  return;
};


PT.notifyOneCacheFileSubscriber = function (filename, cEntry, sub) {
  if (cEntry.err) { return sub.rcv(cEntry.err, null); }
  if (this.serveFromCache(filename, sub.enc, sub.rcv)) { return; }
  malf('delivery to subscriber failed', filename);
};
























module.exports = CF;
