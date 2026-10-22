/* 尺素 · 新卷：核对版号，待编辑收妥与本机存妥后换卷。 */
(function (W) {
  'use strict';
  var U = W.ChisuUtil, St = W.ChisuState, VERSION = '3.1.2';
  var checking = null, nextVersion = '', reloadTimer = null, refreshing = false, lastCheck = 0, notice = null;
  function newer(a, b) {
    if (!/^\d+\.\d+\.\d+$/.test(a)) return false;
    var x = a.split('.'), y = b.split('.');
    for (var i = 0; i < 3; i++) { if (+x[i] !== +y[i]) return +x[i] > +y[i]; }
    return false;
  }
  function busy() {
    var active = document.activeElement;
    if (document.hidden || !St.S.ready || refreshing) return true;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
    if (document.querySelector('.sheet-layer.open,#call.open')) return true;
    if ((St.S.pending || []).length) return true;
    return U.$$('textarea,input[type="text"]').some(function (el) {
      return !!el.getClientRects().length && el.tagName === 'TEXTAREA' && !!el.value.trim();
    });
  }
  function showNotice() {
    if (notice) return;
    notice = U.h('div', { class: 'update-note', role: 'status' }, [
      U.h('span', { text: '新卷 ' + nextVersion + ' 已备' }),
      U.h('button', { type: 'button', text: '换新卷', onclick: function () {
        if (busy()) { U.toast('请先落笔、收妥编辑并候回笔毕，再换新卷。'); return; }
        replace();
      } })
    ]);
    document.body.appendChild(notice);
  }
  function replace() {
    if (!nextVersion || busy()) return;
    refreshing = true; clearTimeout(reloadTimer);
    St.prepareReload().then(function (saved) {
      if (!saved) { refreshing = false; U.toast('本机尚未存妥，请先誊出卷宗；暂不换卷。'); return; }
      var url = new URL(W.location.href); url.searchParams.set('v', nextVersion);
      W.location.replace(url.href);
    }).catch(function () { refreshing = false; U.toast('本机尚未存妥，暂不换卷。'); });
  }
  function queue(version) {
    if (!newer(version, VERSION)) return;
    nextVersion = version; showNotice(); clearTimeout(reloadTimer);
    function attempt() { if (!busy()) replace(); else reloadTimer = setTimeout(attempt, 2000); }
    reloadTimer = setTimeout(attempt, 2000);
  }
  function registration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  }
  function askVersion(worker) {
    if (!worker || !W.MessageChannel) return Promise.resolve('');
    return new Promise(function (resolve) {
      var channel = new W.MessageChannel(), done = false;
      function finish(v) { if (done) return; done = true; channel.port1.close(); resolve(v); }
      channel.port1.onmessage = function (e) { finish(e.data && e.data.version || ''); };
      worker.postMessage({ type: 'CHISU_GET_VERSION' }, [channel.port2]);
      setTimeout(function () { finish(''); }, 1200);
    });
  }
  function check(manual) {
    if (checking) return checking;
    lastCheck = Date.now();
    checking = fetch('release.json?t=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('offline'); return res.json();
    }).then(function (release) {
      if (!release || !/^\d+\.\d+\.\d+$/.test(release.version || '')) throw new Error('bad release');
      return registration().then(function (reg) {
        if (reg) {
          reg.addEventListener('updatefound', function () {
            var worker = reg.installing;
            if (worker) worker.addEventListener('statechange', function () { if (worker.state === 'activated') askVersion(reg.active).then(queue); });
          });
          return reg.update().then(function () { return askVersion(reg.active); }).then(function (active) {
            if (newer(release.version, VERSION)) {
              if (active === release.version) queue(active);
              if (manual) U.toast('正在取新卷；存妥后自动换新。');
              return 'updating';
            }
            if (manual) U.toast('已是新卷 · ' + VERSION); return 'latest';
          });
        }
        if (newer(release.version, VERSION)) { queue(release.version); return 'updating'; }
        if (manual) U.toast('已是新卷 · ' + VERSION); return 'latest';
      });
    }).catch(function () { if (manual) U.toast('暂未连通，现卷仍可照常使用。'); return 'offline'; }).then(function (result) { checking = null; return result; });
    return checking;
  }
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'CHISU_UPDATE_READY') queue(e.data.version); });
      navigator.serviceWorker.addEventListener('controllerchange', function () { askVersion(navigator.serviceWorker.controller).then(queue); });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastCheck > 60000) check(false); });
    W.addEventListener('online', function () { check(false); });
    setTimeout(function () { check(false); }, 1000);
    setInterval(function () { if (!document.hidden) check(false); }, 10 * 60000);
  }
  W.ChisuUpdater = { init: init, check: check, version: VERSION, newer: newer, busy: busy };
})(window);
