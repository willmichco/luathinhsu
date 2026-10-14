/*
 * Service worker: cho phép mở trang và đọc các điều đã tải khi không có mạng.
 *  - Khung ứng dụng (HTML/CSS/JS): ưu tiên mạng, dự phòng bằng bộ nhớ đệm → luôn nhận bản mới khi online.
 *  - Phông chữ, hình ảnh: ưu tiên bộ nhớ đệm.
 *  - Dữ liệu điều luật (data/*.json): trả ngay bản đã lưu, đồng thời cập nhật ngầm.
 */
var VERSION = 'blhs-20261014c';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/app.css?v=20261014c', 'assets/js/lx-core.js?v=20261014c', 'assets/js/app.js?v=20261014c',
  'assets/js/tools.js?v=20261014c', 'assets/js/search-engine.js?v=20261014c', 'assets/js/search-worker.js?v=20261014c',
  'assets/img/logo.webp', 'assets/img/trong-dong.svg', 'assets/img/favicon-32.png', 'assets/img/icon-192.png',
  'assets/fonts/be-vietnam-pro-400-normal-vietnamese.woff2', 'assets/fonts/be-vietnam-pro-400-normal-latin.woff2',
  'assets/fonts/be-vietnam-pro-600-normal-vietnamese.woff2', 'assets/fonts/be-vietnam-pro-600-normal-latin.woff2',
  'assets/fonts/be-vietnam-pro-700-normal-vietnamese.woff2', 'assets/fonts/be-vietnam-pro-700-normal-latin.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match('index.html'); });
  });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: false }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var p = url.pathname;
  if (/\/data\/(toc|meta)\.json$/.test(p)) e.respondWith(networkFirst(req));
  else if (/\/data\/.+\.json$/.test(p)) e.respondWith(staleWhileRevalidate(req));
  else if (/\.(woff2|png|webp|svg|jpg)$/.test(p)) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});
