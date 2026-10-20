/* 尺素 · 总调度：视口、展卷与收卷、开场。 */
(function (W) {
  'use strict';
  if (!W.__chisuOK) return;
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine;
  var $ = U.$;
  var current = 'home', moving = false;

  var enterers = {
    chat: function () { W.ChisuChat.enter(); },
    letters: function () { W.ChisuLetters.enter(); },
    library: function () { W.ChisuLibrary.enter(); },
    roles: function () { W.ChisuRoles.enter(); },
    settings: function () { W.ChisuSettings.enter(); },
    home: function () { W.ChisuDesk.refresh(); }
  };

  /* 视口：旧内核无 dvh，以 innerHeight 定高；键盘弹出时随之收缩。 */
  function fit() {
    var vv = W.visualViewport;
    var hgt = vv ? vv.height : W.innerHeight;
    document.documentElement.style.setProperty('--vh', Math.round(hgt) + 'px');
    if (vv && vv.offsetTop) W.scrollTo(0, 0);
  }

  function show(name) {
    U.$$('.view').forEach(function (v) { v.classList.toggle('active', v.id === name); });
    current = name;
    if (enterers[name]) enterers[name]();
  }

  function go(name) {
    if (moving || name === current) return Promise.resolve();
    var from = current, toEl = $('#' + name), fromEl = $('#' + from);
    if (!toEl) return Promise.resolve();
    moving = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (from === 'chat') W.ChisuChat.closeDrawer();
    var pre = (from === 'home' && name === 'chat') ? W.ChisuDesk.pickBrush() : Promise.resolve();
    return pre.then(function () {
      var cls;
      if (from === 'home') cls = 'unfold-in';
      else if (name === 'home') cls = null;
      else cls = 'fade-in';
      if (name === 'home') {
        fromEl.classList.add('fold-out');
        show('home');
        return U.after(fromEl, 420).then(function () { fromEl.classList.remove('fold-out'); });
      }
      toEl.classList.add(cls);
      show(name);
      return U.after(toEl, cls === 'unfold-in' ? 520 : 240).then(function () { toEl.classList.remove(cls); });
    }).then(function () { moving = false; }, function (e) { moving = false; console.error(e); show(name); });
  }

  /* —— 开场 —— */
  var STEM = '甲乙丙丁戊己庚辛壬癸', BR = '子丑寅卯辰巳午未申酉戌亥';
  function ganzhi(d) {
    var y = d.getFullYear(), m = d.getMonth() + 1;
    var season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
    return STEM.charAt((y - 4) % 10) + BR.charAt((y - 4) % 12) + ' · ' + season;
  }
  function playIntro() {
    var el = $('#intro');
    el.classList.remove('hidden', 'gone', 'play');
    void el.offsetWidth;
    el.classList.add('play');
    $('#intro-date').textContent = ganzhi(new Date());
  }
  function leaveIntro() {
    var el = $('#intro');
    if (el.classList.contains('gone')) return;
    el.classList.add('gone');
    St.S.settings.introSeen = true; St.save('settings');
    setTimeout(function () { el.classList.add('hidden'); }, 950);
    W.ChisuKeep.applyAudio(false);
  }

  function refreshAll() {
    W.ChisuSettings.applyLook();
    W.ChisuChat.resetCache();
    W.ChisuDesk.refresh();
    if (enterers[current]) enterers[current]();
    E.schedule();
  }

  function boot() {
    fit();
    W.addEventListener('resize', function () { fit(); clearTimeout(boot.t); boot.t = setTimeout(function () { W.ChisuChat.resetCache(); if (current === 'chat') W.ChisuChat.render(); if (current === 'library') W.ChisuLibrary.render(); }, 150); });
    if (W.visualViewport) W.visualViewport.addEventListener('resize', fit);
    document.addEventListener('touchmove', function (e) {
      // 整页不滚动：只放行可滚的局部容器
      var t = e.target;
      while (t && t !== document.body) {
        if (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1) {
          var cs = W.getComputedStyle(t);
          if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) return;
        }
        t = t.parentNode;
      }
      e.preventDefault();
    }, { passive: false });

    St.load().then(function () {
      W.ChisuSettings.init();
      W.ChisuChat.init(); W.ChisuCall.init(); W.ChisuLetters.init();
      W.ChisuLibrary.init(); W.ChisuRoles.init(); W.ChisuKeep.init();

      $('#tool-brush').addEventListener('click', function () { go('chat'); });
      $('#tool-paper').addEventListener('click', function () { go('letters'); });
      $('#tool-stone').addEventListener('click', function () { W.ChisuDesk.inkPress(); go('settings'); });
      $('#tool-ink').addEventListener('click', function () { go('library'); });
      $('#tool-lamp').addEventListener('click', function () { go('roles'); });
      $('#desk-who').addEventListener('click', function () { W.ChisuRoles.quickSwitch(); });
      U.$$('[data-home]').forEach(function (b) { b.addEventListener('click', function () { go('home'); }); });

      $('#intro-enter').addEventListener('click', leaveIntro);
      $('#intro-skip').addEventListener('click', leaveIntro);
      // 安卓返回键：先收浮层，再归案
      W.history.replaceState({ chisu: 1 }, '');
      W.history.pushState({ chisu: 2 }, '');
      W.addEventListener('popstate', function () {
        var handled = U.closeTopSheet();
        if (!handled && W.ChisuCall.active()) { W.ChisuCall.close(); handled = true; }
        if (!handled && current !== 'home') { go('home'); handled = true; }
        // 已在书案且无可收之物：放行，让返回键离开
        if (handled) W.history.pushState({ chisu: 2 }, ''); else W.history.back();
      });

      W.ChisuDesk.refresh();
      setInterval(function () { if (!document.hidden) { W.ChisuDesk.refresh(); if (current === 'chat') W.ChisuChat.status(); } }, 60000);
      W.addEventListener('pagehide', St.flush);
      document.addEventListener('visibilitychange', function () { if (document.hidden) St.flush(); });
      playIntro();
      E.process();
    }).catch(function (e) { console.error(e); U.toast('展卷未成：' + (e && e.message)); });
  }

  W.ChisuApp = { go: go, view: function () { return current; }, replayIntro: playIntro, refreshAll: refreshAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
