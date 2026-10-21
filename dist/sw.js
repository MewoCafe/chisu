/* 尺素 · 离线：同源静态文件先取网络、断网取缓存；通知点击回到页面。 */
var VERSION = 'chisu-v3.0.6';
var FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/scenes.css', 'css/views.css', 'css/fonts.css',
  'js/core.js', 'js/util.js', 'js/state.js', 'js/engine.js', 'js/ink.js', 'js/desk.js', 'js/chat.js', 'js/call.js',
  'js/letters.js', 'js/library.js', 'js/roles.js', 'js/keepalive.js', 'js/settings.js', 'js/app.js',
  'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/badge-96.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // 先取网络（更新即时生效），断网时取缓存
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return fetch(req).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function () {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) { return hit || cache.match('index.html'); });
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
