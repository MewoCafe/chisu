/* 尺素 · 离线卷与发布同步。应用资源缓存与本机卷宗分开。 */
var VERSION = 'chisu-v3.1.2';
var FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/scenes.css', 'css/views.css', 'css/book.css', 'css/almanac.css', 'css/seals.css', 'css/fonts.css',
  'js/core.js', 'js/util.js', 'js/state.js', 'js/engine.js', 'js/ink.js', 'js/desk.js', 'js/chat.js', 'js/call.js',
  'js/letters.js', 'js/library.js', 'js/roles.js', 'js/keepalive.js', 'js/settings.js', 'js/app.js', 'js/updater.js', 'js/almanac-core.js', 'js/almanac.js', 'vendor/lunar.js', 'data/eras.json',
  'assets/seals/qi.svg', 'assets/seals/an.svg', 'assets/seals/su.svg', 'assets/seals/zha.svg',
  'assets/seals/rim.svg', 'assets/seals/rim-ink.svg', 'assets/seals/rim-muted.svg', 'assets/seals/solid.svg', 'assets/seals/wear.svg',
  'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/badge-96.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.addAll(FILES.map(function (path) { return new Request(new URL(path, self.location.href).href, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('chisu-v') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  }).then(function (clients) { clients.forEach(function (client) { client.postMessage({ type: 'CHISU_UPDATE_READY', version: VERSION.slice(7) }); }); }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'CHISU_GET_VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION.slice(7) });
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/release\.json$/.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(function () { return new Response('{"offline":true}', { status: 503, headers: { 'Content-Type': 'application/json' } }); }));
    return;
  }
  var navigation = req.mode === 'navigate' || /\/$|\/index\.html$/.test(url.pathname);
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return fetch(req, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) cache.put(navigation ? new URL('index.html', self.location.href).href : url.origin + url.pathname, res.clone());
      return res;
    }).catch(function () {
      return cache.match(navigation ? new URL('index.html', self.location.href).href : req, { ignoreSearch: true }).then(function (hit) {
        return hit || new Response('此页资料尚未收入离线卷，请连网后再展。', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      });
    });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    if (self.clients.openWindow) return self.clients.openWindow('./');
  }));
});
