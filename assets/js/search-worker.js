/*
 * Luồng tìm kiếm nền: nạp toàn văn một lần, quét trong vài chục mili-giây
 * mà không làm đứng giao diện đọc.
 */
'use strict';
importScripts('lx-core.js?v=20261014c', 'search-engine.js?v=20261014c');

var engine = new self.LXEngine();
var pending = null;

self.onmessage = function (e) {
  var m = e.data;
  if (m.type === 'init') init(m);
  else if (m.type === 'search') {
    if (engine.ready) reply(m);
    else pending = m;                 // chỉ giữ yêu cầu mới nhất
  }
};

function reply(m) {
  var r = engine.run(m.q);
  r.type = 'result';
  r.id = m.id;
  self.postMessage(r);
}

function init(m) {
  var done = 0, total = m.chapters.length;
  Promise.all(m.chapters.map(function (id) {
    return fetch(m.base + id + '.json?v=' + m.v)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (arr) {
        done++;
        self.postMessage({ type: 'progress', done: done, total: total });
        return arr;
      });
  })).then(function (lists) {
    var n = engine.load(m.titles, lists);
    self.postMessage({ type: 'ready', n: n });
    if (pending) { reply(pending); pending = null; }
  }).catch(function (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
  });
}
