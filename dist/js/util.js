/* 尺素 · 通用工具：DOM、存储、图片压缩、浮层。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore;

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 只揭示当前输入框所在的滚动容器，不移动整个页面。 */
  function lockLayoutScroll(target) {
    var nodes = target ? [target] : $$('.stage,#app,.view,.sheet-layer,.sheet,#call');
    nodes.forEach(function (el) {
      var cl = el.classList;
      if (!cl || !(el.id === 'app' || el.id === 'call' || cl.contains('stage') || cl.contains('view') || cl.contains('sheet-layer') || cl.contains('sheet'))) return;
      if (el.scrollTop) el.scrollTop = 0;
      if (el.scrollLeft) el.scrollLeft = 0;
    });
  }
  function keepInputVisible() {
    lockLayoutScroll();
    var input = document.activeElement;
    if (!input || !/^(INPUT|TEXTAREA|SELECT)$/.test(input.tagName) || input.type === 'file') return;
    var parent = input.parentNode;
    while (parent && parent !== document.body) {
      var cs = W.getComputedStyle(parent);
      if (/(auto|scroll)/.test(cs.overflowY) && parent.scrollHeight > parent.clientHeight + 1) {
        var box = parent.getBoundingClientRect(), field = input.getBoundingClientRect();
        var top = box.top + parent.clientTop + 12, bottom = box.top + parent.clientTop + parent.clientHeight - 12;
        if (field.height <= bottom - top) {
          if (field.bottom > bottom) parent.scrollTop += field.bottom - bottom;
          else if (field.top < top) parent.scrollTop -= top - field.top;
        }
      }
      parent = parent.parentNode;
    }
  }
  function focusInput(input) {
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    keepInputVisible();
  }
  function blurWithin(container) {
    var active = document.activeElement;
    if (active && container.contains(active) && active.blur) active.blur();
  }

  /* —— 存储：IndexedDB 优先，失败退回 localStorage —— */
  var DB_NAME = 'chisu', STORE = 'kv', dbp = null;
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      if (!W.indexedDB) return resolve(null);
      var req;
      try { req = W.indexedDB.open(DB_NAME, 1); } catch (e) { return resolve(null); }
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
      setTimeout(function () { resolve(null); }, 4000);
    });
    return dbp;
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      if (!db) return lsGet(key);
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
          r.onsuccess = function () { resolve(r.result === undefined ? lsGet(key) : r.result); };
          r.onerror = function () { resolve(lsGet(key)); };
        } catch (e) { resolve(lsGet(key)); }
      });
    });
  }
  function idbSet(key, val) {
    return openDB().then(function (db) {
      if (!db) return lsSet(key, val);
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(val, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = tx.onabort = function () { resolve(lsSet(key, val)); };
        } catch (e) { resolve(lsSet(key, val)); }
      });
    });
  }
  function lsGet(key) {
    try { var v = W.localStorage.getItem('chisu3-' + key); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
  }
  function lsSet(key, val) {
    try { W.localStorage.setItem('chisu3-' + key, JSON.stringify(val)); return true; }
    catch (e) { toast('本机纸已用尽，请先誊出卷宗留底。'); return false; }
  }

  var timers = {};
  function saveLater(key, getter, delay) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () { delete timers[key]; idbSet(key, getter()); }, delay == null ? 250 : delay);
  }
  function flushAll(map) {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); delete timers[k]; if (map[k]) idbSet(k, map[k]()); });
  }

  /* —— 图片压缩：长边 ≤ max，优先 webp，GIF 原样保留（限大小） —— */
  var webpOK = (function () {
    try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; }
  })();
  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error('此图未能读取。')); };
      fr.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('此图未能读取。')); };
      img.src = src;
    });
  }
  function compressImage(file, opts) {
    opts = opts || {};
    var max = opts.max || 1080, quality = opts.quality || 0.8;
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('请呈图片。'));
    if (file.type === 'image/gif') {
      if (file.size > (opts.gifLimit || 2 * 1024 * 1024)) return Promise.reject(new Error('动图需小于 2 MB。'));
      return readAsDataURL(file);
    }
    var url = W.URL.createObjectURL(file);
    return loadImage(url).then(function (img) {
      W.URL.revokeObjectURL(url);
      var w = img.naturalWidth, hgt = img.naturalHeight;
      var scale = Math.min(1, max / Math.max(w, hgt));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(hgt * scale));
      var cv = document.createElement('canvas');
      if (opts.square) { var e = Math.min(w, hgt); cw = ch = Math.min(opts.square, e); }
      cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#f3f1eb'; ctx.fillRect(0, 0, cw, ch);
      if (opts.square) {
        var edge = Math.min(w, hgt);
        ctx.drawImage(img, (w - edge) / 2, (hgt - edge) / 2, edge, edge, 0, 0, cw, ch);
      } else ctx.drawImage(img, 0, 0, cw, ch);
      return webpOK ? cv.toDataURL('image/webp', quality) : cv.toDataURL('image/jpeg', quality);
    }, function (err) { W.URL.revokeObjectURL(url); throw err; });
  }

  /* 默认头像：名字首字，宣纸方印。 */
  function monogram(name, dark) {
    var ch = C.graphemes(String(name || '素').trim())[0] || '素';
    var bg = dark ? '#2b2e2b' : '#efece4', fg = dark ? '#ece8de' : '#2c302c', line = dark ? '#6d716a' : '#b9b8ae';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" fill="' + bg + '"/>' +
      '<rect x="7" y="7" width="106" height="106" fill="none" stroke="' + line + '" stroke-width="2"/>' +
      '<rect x="12" y="12" width="96" height="96" fill="none" stroke="' + line + '" stroke-width=".7"/>' +
      '<text x="60" y="80" text-anchor="middle" font-size="56" font-family="Songti SC,STSong,Noto Serif CJK SC,serif" fill="' + fg + '">' + esc(ch) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* —— 提示 —— */
  var toastTimer;
  function toast(text, ms) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  /* —— 浮层（替代 <dialog>，旧内核无 showModal） —— */
  var sheetStack = [];
  function sheet(opts) {
    var layer = h('div', { class: 'sheet-layer' + (opts.full ? ' full' : '') + (opts.dark ? ' dark' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' });
    var panel = h('div', { class: 'sheet' });
    var head = h('div', { class: 'sheet-head' }, [
      h('span', { class: 'sheet-title', text: opts.title || '' }),
      opts.sub ? h('small', { class: 'sheet-sub', text: opts.sub }) : null,
      h('button', { class: 'link sheet-close', type: 'button', text: opts.closeText || '收起', onclick: function () { api.close(); } })
    ]);
    var body = h('div', { class: 'sheet-body' });
    panel.appendChild(head);
    panel.appendChild(h('div', { class: 'rule-wenwu' }));
    panel.appendChild(body);
    layer.appendChild(panel);
    layer.addEventListener('click', function (e) { if (e.target === layer && !opts.sticky) api.close(); });
    document.body.appendChild(layer);
    var api = {
      layer: layer, body: body, panel: panel, head: head,
      close: function () {
        if (!layer.parentNode) return;
        blurWithin(layer);
        layer.classList.remove('open');
        var i = sheetStack.indexOf(api); if (i >= 0) sheetStack.splice(i, 1);
        setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 260);
        if (opts.onclose) opts.onclose();
      }
    };
    sheetStack.push(api);
    if (opts.build) opts.build(body, api);
    W.requestAnimationFrame(function () { layer.classList.add('open'); });
    return api;
  }
  function closeTopSheet() { var s = sheetStack[sheetStack.length - 1]; if (s) { s.close(); return true; } return false; }

  function confirmSheet(text, okText, onOk, danger) {
    return sheet({
      title: '且慢', build: function (body, s) {
        body.appendChild(h('p', { class: 'confirm-text', text: text }));
        body.appendChild(h('div', { class: 'seal-row' }, [
          h('button', { class: 'seal-btn' + (danger ? ' cinnabar' : ''), type: 'button', text: okText || '是', onclick: function () { s.close(); onOk(); } }),
          h('button', { class: 'link', type: 'button', text: '罢了', onclick: function () { s.close(); } })
        ]));
      }
    });
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var a = h('a', { href: W.URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { W.URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
  }
  function pickFile(accept, multiple) {
    return new Promise(function (resolve) {
      var input = h('input', { type: 'file', accept: accept, style: 'position:fixed;left:-99px;opacity:0' });
      if (multiple) input.multiple = true;
      input.onchange = function () { resolve(Array.prototype.slice.call(input.files || [])); input.parentNode.removeChild(input); };
      document.body.appendChild(input);
      input.click();
    });
  }
  function readText(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error('此卷未能读取。')); };
      fr.readAsText(file);
    });
  }

  /* 动画结束：transitionend + 超时兜底（旧内核偶尔不派发）。 */
  function after(el, ms) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; el.removeEventListener('transitionend', onEnd); el.removeEventListener('animationend', onEnd); resolve(); }
      function onEnd(e) { if (e.target === el) fin(); }
      el.addEventListener('transitionend', onEnd);
      el.addEventListener('animationend', onEnd);
      setTimeout(fin, (ms || 400) + 80);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  W.ChisuUtil = {
    $: $, $$: $$, h: h, clear: clear, esc: esc,
    keepInputVisible: keepInputVisible, lockLayoutScroll: lockLayoutScroll, focusInput: focusInput, blurWithin: blurWithin,
    get: idbGet, set: idbSet, saveLater: saveLater, flushAll: flushAll,
    compressImage: compressImage, monogram: monogram, toast: toast,
    sheet: sheet, closeTopSheet: closeTopSheet, confirmSheet: confirmSheet,
    download: download, pickFile: pickFile, readText: readText, after: after, wait: wait
  };
})(window);
