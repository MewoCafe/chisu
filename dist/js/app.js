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

  /* 舞台和弹层跟随可视区域；不强制滚动页面，以免与输入法相互拉扯。 */
  var fitFrame = 0, layoutTimer = null, lastWidth = 0, lastHeight = 0, viewportTallest = 0, layoutChanged = false;
  function fit() {
    var vv = W.visualViewport;
    var hgt = vv ? vv.height : W.innerHeight;
    var top = vv ? Math.max(0, vv.offsetTop) : 0;
    var width = vv ? vv.width : W.innerWidth;
    var root = document.documentElement;
    root.style.setProperty('--vh', Math.round(hgt) + 'px');
    root.style.setProperty('--viewport-top', Math.round(top) + 'px');
    root.style.setProperty('--input-max-height', Math.round(Math.max(64, Math.min(260, hgt * 0.32))) + 'px');
    if (Math.abs(width - lastWidth) > 80) viewportTallest = hgt;
    viewportTallest = Math.max(viewportTallest, hgt, W.innerHeight);
    root.classList.toggle('keyboard-open', viewportTallest - hgt > 100);
    root.classList.toggle('compact-viewport', hgt < 500);
    root.classList.toggle('tiny-viewport', hgt < 320);
    var resized = width !== lastWidth || Math.abs(hgt - lastHeight) > 1;
    layoutChanged = layoutChanged || resized;
    if (width !== lastWidth && W.ChisuChat) W.ChisuChat.resetCache();
    lastWidth = width; lastHeight = hgt;
    if (resized && U.keepInputVisible) {
      if (U.releaseFocusScroll) U.releaseFocusScroll();
      U.keepInputVisible();
    }
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      if (!St.S.ready) return;
      if (layoutChanged && current === 'chat') { W.ChisuChat.autosize(); W.ChisuChat.render(); }
      if (layoutChanged && current === 'library') W.ChisuLibrary.render();
      layoutChanged = false;
    }, 100);
  }
  function requestFit() {
    if (fitFrame) return;
    fitFrame = W.requestAnimationFrame(function () { fitFrame = 0; fit(); });
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
  var introGeneration = 0;
  function playIntro() {
    var el = $('#intro');
    el.classList.remove('hidden', 'gone', 'play');
    void el.offsetWidth;
    var generation = ++introGeneration;
    W.requestAnimationFrame(function () { W.requestAnimationFrame(function () { if (generation === introGeneration && !el.classList.contains('gone')) el.classList.add('play'); }); });
    $('#intro-date').textContent = ganzhi(new Date());
  }
  function leaveIntro() {
    var el = $('#intro');
    if (el.classList.contains('gone')) return;
    introGeneration++;
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

  function refreshFontLayout() {
    if (!St.S.ready) return;
    W.ChisuChat.resetCache();
    layoutChanged = true;
    requestFit();
  }

  function boot() {
    fit();
    U.installInputGuard();
    W.addEventListener('resize', requestFit);
    W.addEventListener('orientationchange', requestFit);
    if (W.visualViewport) {
      W.visualViewport.addEventListener('resize', requestFit);
      W.visualViewport.addEventListener('scroll', requestFit);
    }
    document.addEventListener('focusin', function () {
      requestFit();
      // 键盘 Tab 等非点击换焦点也只揭示一次，不在滚动过程中追逐输入框。
      W.requestAnimationFrame(function () { U.keepInputVisible(); });
    });
    document.addEventListener('scroll', function (e) { U.lockLayoutScroll(e.target); }, true);
    document.addEventListener('focusout', function () {
      requestFit();
      // 有些手机先派发失焦，键盘动画结束后才更新可视高度。
      clearTimeout(boot.focusTimer);
      boot.focusTimer = setTimeout(requestFit, 350);
    });
    W.addEventListener('pageshow', requestFit);
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
      W.ChisuAlmanac.init();
      W.ChisuUpdater.init();

      // 目录式与陈设式共用入口，换案后仍由同一书案接住点击。
      $('#home').addEventListener('click', function (e) {
        var t = e.target, routes = { 'tool-brush': 'chat', 'tool-paper': 'letters', 'tool-stone': 'settings', 'tool-ink': 'library', 'tool-lamp': 'roles' };
        while (t && t !== this) {
          if (t.id === 'desk-who') { W.ChisuRoles.quickSwitch(); return; }
          if (routes[t.id]) { if (t.id === 'tool-stone') W.ChisuDesk.inkPress(); go(routes[t.id]); return; }
          t = t.parentNode;
        }
      });
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
      // 远程字体迟于正文到达时，重新计算换行与分页，避免沿用回退字体的高度。
      if (document.fonts) {
        document.fonts.ready.then(refreshFontLayout);
        if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refreshFontLayout);
      }
    }).catch(function (e) { console.error(e); U.toast('展卷未成：' + (e && e.message)); });
  }

  W.ChisuApp = { go: go, view: function () { return current; }, replayIntro: playIntro, refreshAll: refreshAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
