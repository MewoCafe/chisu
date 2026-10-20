/* 尺素 · 共书：一纸往来，按叶翻看，不整页滚动。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine, Ink = W.ChisuInk;
  var $ = U.$, h = U.h;

  var pages = [], page = -1, follow = true, plans = {}, drawerLib = 'kao', drawerGroup = '*';
  var heightCache = {}, composing = false, resizeFrame = 0;

  function role() { return St.currentRole(); }
  function list() { return St.S.messages[role().id]; }

  function whenText(at) { return C.shichen(new Date(at)); }

  function entryNode(m, prev, live) {
    var me = m.from === 'me';
    var cont = prev && prev.from === m.from && m.kind !== 'call' && prev.kind !== 'call' && (m.at - prev.at) < 10 * 60000;
    var el = h('article', { class: 'entry ' + (me ? 'me' : 'peer') + ' kind-' + m.kind + (cont ? ' cont' : ''), 'data-id': m.id });
    if (!cont && m.kind !== 'call' && m.kind !== 'note') {
      el.appendChild(h('div', { class: 'entry-meta' }, [
        h('span', { class: 'who', text: me ? St.S.settings.selfName : role().name }),
        h('span', { class: 'when', text: whenText(m.at) })
      ]));
    }
    var body;
    if (m.kind === 'img' || m.kind === 'stk') {
      body = h('div', { class: 'entry-body' }, h('span', { class: 'entry-img' }, h('img', { src: m.src, alt: m.text || '图', loading: 'lazy' })));
      body.firstChild.addEventListener('click', function () { viewImage(m.src); });
    } else {
      body = h('div', { class: 'entry-body' });
      var plan = plans[m.id];
      if (live && plan && m.kind === 'text') Ink.paint(body, m.text, plan);
      else if (me && m.zhupi && m.zhupi.start >= 0) {
        var t = m.text, z = m.zhupi;
        body.appendChild(document.createTextNode(t.slice(0, z.start)));
        body.appendChild(h('span', { class: 'quan', text: t.slice(z.start, z.start + z.length) }));
        body.appendChild(document.createTextNode(t.slice(z.start + z.length)));
      } else body.textContent = m.text;
    }
    el.appendChild(body);
    if (me && m.zhupi) {
      var zp = h('div', { class: 'zhupi' + (live && m.zhupi.fresh ? ' fresh' : ''), text: m.zhupi.note });
      el.appendChild(zp);
    }
    return el;
  }

  function measure(stage) {
    var msgs = list(), w = stage.clientWidth;
    var box = h('div', { class: 'chat-stage measure', style: 'width:' + w + 'px;position:absolute;height:auto' });
    stage.parentNode.appendChild(box);
    var heights = [];
    var marginOf = 14;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i], prev = msgs[i - 1];
      var key = m.id + '|' + w + '|' + (prev ? prev.id : '') + '|' + (m.zhupi ? 'z' : '');
      if (heightCache[key] == null) {
        var node = entryNode(m, prev, false);
        box.appendChild(node);
        var cs = W.getComputedStyle(node);
        heightCache[key] = node.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || marginOf);
        box.removeChild(node);
      }
      heights.push(heightCache[key]);
    }
    box.parentNode.removeChild(box);
    return heights;
  }

  function paginate() {
    var stage = $('#chat-stage');
    var avail = stage.clientHeight - 26;
    var msgs = list(), heights = measure(stage);
    pages = [];
    var cur = [], used = 0;
    for (var i = 0; i < msgs.length; i++) {
      if (cur.length && used + heights[i] > avail) { pages.push(cur); cur = []; used = 0; }
      cur.push(i); used += heights[i];
    }
    if (cur.length || !pages.length) pages.push(cur);
  }

  function render() {
    if (!St.S.ready) return;
    var stage = $('#chat-stage');
    if (!stage.clientHeight) return;
    paginate();
    if (follow || page < 0 || page >= pages.length) page = pages.length - 1;
    var idxs = pages[page], msgs = list();
    U.clear(stage);
    stage.classList.remove('tall');
    if (!msgs.length) {
      stage.appendChild(h('p', { class: 'chat-empty' }, ['纸已铺开', h('small', { text: '写下第一句，' + role().name + '自会回笔' })]));
    } else {
      idxs.forEach(function (i) { stage.appendChild(entryNode(msgs[i], msgs[i - 1], true)); });
      if (idxs.length === 1 && stage.scrollHeight > stage.clientHeight + 4) stage.classList.add('tall');
    }
    $('#pg-prev').disabled = page <= 0;
    $('#pg-next').disabled = page >= pages.length - 1;
    $('.chat-pager').classList.toggle('single', pages.length <= 1);
    $('#pg-num').textContent = pages.length > 1 ? C.hanNum(page + 1) + ' / ' + C.hanNum(pages.length) : '';
    status();
  }

  function status() {
    var r = role(), st = C.roleState(r, new Date());
    var n = E.pendingCount(r.id), txt;
    var writing = list().some(function (m) {
      var plan = plans[m.id];
      return plan && Date.now() < plan.start + plan.sched.duration;
    });
    if (writing) txt = '落笔成笺';
    else if (n) txt = '提笔酝词';
    else txt = C.STATE_NAMES[st] + ' · ' + C.shichen(new Date());
    var mark = $('#chat-status'), busy = !r.travel && (writing || n > 0);
    if (r.travel) txt = C.STATE_NAMES[st] + ' · ' + C.shichen(new Date());
    if (mark.textContent !== txt) mark.textContent = txt;
    mark.classList.toggle('writing-mark', busy);
    mark.setAttribute('aria-label', r.name + (busy ? '正在输入：' : '，') + txt);
    $('#chat-who').classList.toggle('is-writing', busy);
    $('#chat-name').textContent = r.name;
    $('#chat-avatar').src = St.avatarOf(r);
    var locked = r.travel;
    $('#composer').classList.toggle('locked', locked);
    $('#chat-input').placeholder = locked ? r.name + '远行，请移步尺牍' : '提笔……';
    $('#call-btn').disabled = locked;
  }

  function send(msg) {
    var r = role();
    if (r.travel) { U.toast(r.name + '远行未归，书信或可寄达。'); return; }
    msg.id = C.uid(); msg.from = 'me'; msg.at = Date.now();
    list().push(msg);
    St.save('messages');
    follow = true;
    render();
    E.queueChat(r);
    status();
  }

  function submit(e) {
    if (e) e.preventDefault();
    var input = $('#chat-input'), text = input.value.trim();
    if (!text) { input.focus(); return; }
    input.value = ''; autosize();
    send({ kind: 'text', text: text });
  }

  function autosize() {
    var t = $('#chat-input'), previous = t.offsetHeight;
    var limit = Math.min(120, Math.max(44, Math.floor($('#app').clientHeight / 4)));
    t.style.height = '44px';
    t.style.height = Math.min(limit, Math.max(44, t.scrollHeight)) + 'px';
    t.style.overflowY = t.scrollHeight > limit ? 'auto' : 'hidden';
    if (previous !== t.offsetHeight && !resizeFrame) {
      resizeFrame = W.requestAnimationFrame(function () { resizeFrame = 0; if (W.ChisuApp.view() === 'chat') render(); });
    }
  }

  /* —— 匣 —— */
  function renderDrawer() {
    var lib = St.S.lib[drawerLib];
    U.$$('#drawer-tabs .tab-v').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lib') === drawerLib); });
    var gbox = U.clear($('#drawer-groups'));
    [{ id: '*', name: '全部' }].concat(lib.groups).forEach(function (g) {
      gbox.appendChild(h('button', { class: 'chip' + (drawerGroup === g.id ? ' on' : ''), type: 'button', text: g.name, onclick: function () { drawerGroup = g.id; renderDrawer(); } }));
    });
    var grid = U.clear($('#drawer-grid'));
    grid.className = 'drawer-grid' + (drawerLib === 'kao' ? ' kao' : '');
    var items = lib.items.filter(function (i) { return drawerGroup === '*' || i.groups.indexOf(drawerGroup) >= 0; });
    if (drawerLib === 'img') {
      grid.appendChild(h('button', { class: 'drawer-cell', type: 'button', text: '呈图', onclick: sendLocalImage }));
    }
    if (!items.length && drawerLib !== 'img') grid.appendChild(h('div', { class: 'drawer-empty' }, ['此匣尚空', h('br'), '可往墨藏添置']));
    items.forEach(function (it) {
      var cell = h('button', { class: 'drawer-cell', type: 'button' });
      if (drawerLib === 'kao') cell.textContent = it.text;
      else cell.appendChild(h('img', { src: it.src, alt: it.name || '', loading: 'lazy' }));
      cell.onclick = function () {
        if (drawerLib === 'kao') { var t = $('#chat-input'); t.value += it.text; autosize(); }
        else send({ kind: drawerLib, src: it.src, text: it.name || '' });
      };
      grid.appendChild(cell);
    });
  }
  function sendLocalImage() {
    U.pickFile('image/*').then(function (files) {
      if (!files[0]) return;
      return U.compressImage(files[0], { max: 1080 }).then(function (src) { send({ kind: 'img', src: src }); });
    }).catch(function (e) { U.toast(e.message); });
  }
  function toggleDrawer(force) {
    var d = $('#drawer'), open = force == null ? !d.classList.contains('open') : force;
    d.classList.toggle('open', open);
    $('#box-btn').classList.toggle('on', open);
    if (open) { $('#chat-input').blur(); renderDrawer(); }
    W.requestAnimationFrame(render);
  }

  function viewImage(src) {
    var v = h('div', { class: 'viewer', role: 'dialog', 'aria-label': '观图', onclick: function () { v.parentNode.removeChild(v); } }, h('img', { src: src, alt: '' }));
    document.body.appendChild(v);
  }

  /* 新回笔到达 */
  function onMessage(d) {
    if (d.roleId !== role().id) return;
    var m = d.msg;
    if (m.fresh && m.kind === 'text') plans[m.id] = Ink.reserve(m.text);
    delete m.fresh;
    follow = true;
    if (W.ChisuApp.view() === 'chat') render();
    var wait = plans[m.id] ? (plans[m.id].start + plans[m.id].sched.duration - Date.now()) : 0;
    setTimeout(function () { delete plans[m.id]; if (W.ChisuApp.view() === 'chat') status(); }, Math.max(0, wait) + 400);
  }

  function init() {
    $('#composer').addEventListener('submit', submit);
    $('#chat-input').addEventListener('input', autosize);
    $('#chat-input').addEventListener('focus', function () { toggleDrawer(false); });
    $('#chat-input').addEventListener('compositionstart', function () { composing = true; });
    $('#chat-input').addEventListener('compositionend', function () { composing = false; autosize(); });
    $('#chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !composing && e.keyCode !== 229 && W.matchMedia('(pointer:fine)').matches) { e.preventDefault(); submit(); }
    });
    $('#box-btn').addEventListener('click', function () { toggleDrawer(); });
    U.$$('#drawer-tabs .tab-v').forEach(function (b) { b.addEventListener('click', function () { drawerLib = b.getAttribute('data-lib'); drawerGroup = '*'; renderDrawer(); }); });
    $('#pg-prev').addEventListener('click', function () { if (page > 0) { follow = false; page--; render(); } });
    $('#pg-next').addEventListener('click', function () { if (page < pages.length - 1) { page++; follow = page === pages.length - 1; render(); } });
    $('#chat-who').addEventListener('click', function () { W.ChisuRoles.edit(role()); });
    // 左右轻扫翻叶
    var sx = null, sy = null;
    $('#chat-stage').addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    $('#chat-stage').addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx > 0) $('#pg-prev').click(); else $('#pg-next').click();
    });
    E.on('message', onMessage);
    E.on('zhupi', function (d) { if (d.roleId === role().id && W.ChisuApp.view() === 'chat') { heightCache = {}; render(); } setTimeout(function () { delete d.msg.zhupi.fresh; }, 800); });
    E.on('pending', function () { if (W.ChisuApp.view() === 'chat') status(); });
  }

  function enter() { follow = true; heightCache = {}; render(); }
  function addNote(roleId, text, kind) {
    St.S.messages[roleId].push({ id: C.uid(), from: 'me', kind: kind || 'call', text: text, at: Date.now() });
    St.save('messages');
    if (roleId === role().id && W.ChisuApp.view() === 'chat') render();
  }

  W.ChisuChat = { init: init, render: render, enter: enter, autosize: autosize, status: status, addNote: addNote, resetCache: function () { heightCache = {}; }, closeDrawer: function () { toggleDrawer(false); } };
})(window);
