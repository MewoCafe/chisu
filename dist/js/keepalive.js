/* 尺素 · 守灯（保活）、信使（系统通知）、悬浮信笺、离线与安装。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine;
  var $ = U.$;
  var lock = null, audio = null, installEvt = null, swReg = null;

  /* —— 夜不熄灯：屏幕常亮 —— */
  function wakeSupported() { return !!(navigator.wakeLock && navigator.wakeLock.request); }
  function applyWake() {
    if (!St.S.settings.wakeLock) { if (lock) { try { lock.release(); } catch (e) { /* */ } lock = null; } return; }
    if (!wakeSupported() || document.hidden || lock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l; l.addEventListener('release', function () { lock = null; });
    }, function () { /* 低电量或未获准 */ });
  }

  /* —— 静音续航：循环一段无声音频，让浏览器把页面当作「播放中」，后台计时不被冻结 —— */
  function silentWav() {
    var rate = 8000, n = rate; // 1 秒
    var buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function s(o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    s(36, 'data'); v.setUint32(40, n, true);
    for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return W.URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function applyAudio(fromGesture) {
    if (!St.S.settings.silentAudio) { if (audio) { audio.pause(); } return; }
    if (!audio) {
      audio = new Audio(silentWav());
      audio.loop = true; audio.volume = 0.01;
      audio.setAttribute('playsinline', '');
    }
    var p = audio.play();
    if (p && p.catch) p.catch(function () { if (fromGesture) U.toast('需轻触一下页面，方能守灯。'); });
    if (navigator.mediaSession && W.MediaMetadata) {
      try { navigator.mediaSession.metadata = new W.MediaMetadata({ title: '尺素 · 守灯中', artist: St.currentRole().name + ' 候笔' }); } catch (e) { /* */ }
    }
  }

  /* —— 信使：系统通知 —— */
  function notifySupported() { return 'Notification' in W; }
  function askNotify() {
    if (!notifySupported()) return Promise.resolve('unsupported');
    if (W.Notification.permission === 'granted') return Promise.resolve('granted');
    return new Promise(function (resolve) {
      var r = W.Notification.requestPermission(resolve);
      if (r && r.then) r.then(resolve);
    });
  }
  function sendNotice(title, body, tag) {
    if (!St.S.settings.notify || !notifySupported() || W.Notification.permission !== 'granted') return;
    var opt = { body: body, tag: tag || 'chisu', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', renotify: true, data: { url: location.href.split('#')[0] } };
    if (swReg && swReg.showNotification) swReg.showNotification(title, opt).catch(function () { /* */ });
    else try { new W.Notification(title, opt); } catch (e) { /* 安卓需借 SW */ }
  }

  /* —— 悬浮信笺：不在共书页时，新回笔从右侧探出 —— */
  var floatTimer;
  function floatNote(role, text) {
    if (!St.S.settings.floatNote) return;
    var el = $('#float-note');
    $('#fn-name').textContent = role.name;
    $('#fn-text').textContent = text.slice(0, 14);
    el.dataset.role = role.id;
    el.classList.add('show');
    clearTimeout(floatTimer);
    floatTimer = setTimeout(function () { el.classList.remove('show'); }, 7000);
  }
  function initFloat() {
    var el = $('#float-note'), sy = null, top0 = 0, moved = false;
    el.addEventListener('touchstart', function (e) { sy = e.touches[0].clientY; top0 = el.offsetTop; moved = false; clearTimeout(floatTimer); }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (sy == null) return;
      var dy = e.touches[0].clientY - sy;
      if (Math.abs(dy) > 6) moved = true;
      var max = el.parentNode.clientHeight - el.offsetHeight - 10;
      el.style.top = Math.max(10, Math.min(max, top0 + dy)) + 'px'; el.style.bottom = 'auto';
    }, { passive: true });
    el.addEventListener('touchend', function () { sy = null; floatTimer = setTimeout(function () { el.classList.remove('show'); }, 5000); });
    el.addEventListener('click', function () {
      if (moved) { moved = false; return; }
      el.classList.remove('show');
      var r = St.roleById(el.dataset.role);
      if (r && r.id !== St.S.settings.currentRole) { St.S.settings.currentRole = r.id; St.save('settings'); W.ChisuChat.resetCache(); W.ChisuDesk.refresh(); }
      W.ChisuApp.go('chat');
    });
  }

  function previewOf(m) {
    if (m.kind === 'img') return '寄来一幅画';
    if (m.kind === 'stk') return '钤来一枚印';
    return m.text || '';
  }

  function onArrive(d, letter) {
    var role = St.roleById(d.roleId);
    if (!role) return;
    var text = letter ? '来书一封' : previewOf(d.msg);
    if (document.hidden) sendNotice(role.name + (letter ? ' 来书' : ' 回笔'), text, 'chisu-' + role.id);
    else if (W.ChisuApp.view() !== 'chat' || role.id !== St.S.settings.currentRole || W.ChisuCall.active()) floatNote(role, text);
  }

  /* —— 离线（Service Worker）与安装 —— */
  function initSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(function (reg) { swReg = reg; }, function () { /* */ });
    navigator.serviceWorker.ready.then(function (reg) { swReg = reg; });
  }

  function init() {
    initSW();
    initFloat();
    W.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { applyWake(); E.process(); W.ChisuDesk.refresh(); }
    });
    // 首次轻触后启动守灯（浏览器要求用户手势才能播放）
    document.addEventListener('click', function once() { applyAudio(false); document.removeEventListener('click', once, true); }, true);
    E.on('message', function (d) { onArrive(d, false); });
    E.on('letter', function (d) { onArrive(d, true); });
    applyWake();
  }

  function install() {
    if (!installEvt) return Promise.resolve(false);
    installEvt.prompt();
    return installEvt.userChoice.then(function (c) { installEvt = null; return c.outcome === 'accepted'; });
  }

  W.ChisuKeep = {
    init: init, applyWake: applyWake, applyAudio: applyAudio, askNotify: askNotify, sendNotice: sendNotice,
    wakeSupported: wakeSupported, notifySupported: notifySupported, canInstall: function () { return !!installEvt; }, install: install,
    standalone: function () { return (W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  };
})(window);
