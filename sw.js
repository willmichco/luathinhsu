/*
 * Service worker: tải nhanh khi quay lại trang và đọc được khi không có mạng.
 *  - Tệp có mã phiên bản (?v=…: CSS, JS, dữ liệu điều luật), phông chữ, hình ảnh: không bao giờ đổi nội dung
 *    → lấy thẳng từ bộ nhớ đệm, không chờ mạng.
 *  - Trang HTML, data/toc.json, data/meta.json: ưu tiên mạng để luôn mới; mạng chậm quá NET_WAIT ms thì dùng bản đã lưu.
 *  - Dữ liệu điều luật nằm ở bộ nhớ đệm riêng (DATA), không bị xóa khi phát hành phiên bản giao diện mới;
 *    ứng dụng báo mã phiên bản dữ liệu hiện hành để xóa các bản cũ.
 */
var VERSION = 'blhs-20261021b';
var DATA = 'blhs-data';
var NET_WAIT = 3000;
var SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/app.css?v=20261021b', 'assets/js/lx-core.js?v=20261021b', 'assets/js/app.js?v=20261021b',
  'assets/js/tools.js?v=20261021b', 'assets/js/search-engine.js?v=20261021b', 'assets/js/search-worker.js?v=20261021b',
  'assets/img/logo.webp', 'assets/img/trong-dong.svg', 'assets/img/favicon-32.png', 'assets/img/icon-192.png',
  'assets/fonts/be-vietnam-pro-400.woff2', 'assets/fonts/be-vietnam-pro-500.woff2',
  'assets/fonts/be-vietnam-pro-600.woff2', 'assets/fonts/be-vietnam-pro-700.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== DATA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Ứng dụng gửi mã phiên bản dữ liệu hiện hành → xóa dữ liệu điều luật của phiên bản cũ
self.addEventListener('message', function (e) {
  var v = e.data && e.data.type === 'data-version' && e.data.v;
  if (!v) return;
  e.waitUntil(caches.open(DATA).then(function (c) {
    return c.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { var m = /[?&]v=([^&]+)/.exec(k.url); return m && m[1] !== v; }).map(function (k) { return c.delete(k); }));
    });
  }));
});

function put(name, req, res) {
  if (res && res.ok) { var copy = res.clone(); caches.open(name).then(function (c) { c.put(req, copy); }); }
  return res;
}
// Ưu tiên mạng; quá thời gian chờ hoặc mất mạng thì dùng bản đã lưu (nếu có), nếu không vẫn chờ mạng
function networkFirst(req, name, fallback) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var finish = function (res) { if (!done && res) { done = true; resolve(res); } return !!res; };
    var cached = function () { return caches.match(req); };
    var timer = setTimeout(function () { cached().then(finish); }, NET_WAIT);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      finish(put(name, req, res));
    }).catch(function (err) {
      clearTimeout(timer);
      cached().then(function (hit) {
        if (finish(hit)) return;
        (fallback ? caches.match(fallback) : Promise.resolve(null)).then(function (fb) { if (!finish(fb) && !done) { done = true; reject(err); } });
      });
    });
  });
}
function cacheFirst(req, name) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) { return put(name, req, res); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var p = url.pathname, versioned = /[?&]v=/.test(url.search);
  if (req.mode === 'navigate') e.respondWith(networkFirst(req, VERSION, 'index.html'));
  else if (/\/data\/.+\.json$/.test(p)) e.respondWith(versioned ? cacheFirst(req, DATA) : networkFirst(req, DATA));
  else if (versioned || /\.(woff2|png|webp|svg|jpg)$/.test(p)) e.respondWith(cacheFirst(req, VERSION));
  else e.respondWith(networkFirst(req, VERSION));
});
