/* 尺素 · 回笔调度：按角色的「候」与「每回张数」区间随机回复，含朱批、回信、来召。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, St = W.ChisuState, U = W.ChisuUtil;
  var S = St.S;
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, data) { (listeners[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }

  var timer = null;

  function factor(role) { return C.roleState(role, new Date()) === 'rest' ? 2 : 1; }
  function waitMs(role) { return Math.round(C.randBetween(role.wait) * 1000 * factor(role)); }

  function queueChat(role) {
    if (role.travel) return false;
    var open = S.pending.filter(function (j) { return j.roleId === role.id && j.kind === 'chat' && !j.started; });
    if (open.length) return true; // 已在候，合并为一回
    S.pending.push({
      id: C.uid(), roleId: role.id, kind: 'chat', started: false,
      remaining: C.randBetween(role.count, null, true), dueAt: Date.now() + waitMs(role)
    });
    St.save('pending'); schedule(); emit('pending');
    return true;
  }

  function queueLetter(role) {
    var min = C.randBetween(role.letterWait) * 60000 * factor(role);
    S.pending.push({ id: C.uid(), roleId: role.id, kind: 'letter', started: false, remaining: 1, dueAt: Date.now() + Math.round(min) });
    St.save('pending'); schedule(); emit('pending');
  }

  function cancel(roleId) {
    S.pending = S.pending.filter(function (j) { return roleId && j.roleId !== roleId; });
    St.save('pending'); schedule(); emit('pending');
  }

  function pendingCount(roleId) {
    return S.pending.filter(function (j) { return j.roleId === roleId && j.kind === 'chat'; })
      .reduce(function (n, j) { return n + j.remaining; }, 0);
  }

  function zhupiNote() {
    var lib = S.lib.card, gid = lib.zhupiGroup;
    var notes = lib.items.filter(function (i) { return gid && i.groups.indexOf(gid) >= 0; });
    var p = C.pick(notes);
    return p ? p.text : '妙。';
  }

  function maybeZhupi(role, list) {
    if (!(Math.random() * 100 < role.zhupi)) return;
    for (var i = list.length - 1; i >= 0; i--) {
      var m = list[i];
      if (m.from !== 'me') continue;
      if (m.kind !== 'text' || m.zhupi) return;
      var q = C.pickQuan(m.text);
      m.zhupi = { start: q ? q.start : -1, length: q ? q.length : 0, note: zhupiNote(), at: Date.now(), fresh: true };
      emit('zhupi', { roleId: role.id, msg: m });
      return;
    }
  }

  function makeReply(role) {
    var d = C.drawReply(role, S.lib);
    if (!d) return null;
    var m = { id: C.uid(), from: 'peer', at: Date.now(), kind: d.lib === 'card' ? 'text' : d.lib, fresh: true };
    if (d.lib === 'card' || d.lib === 'kao') m.text = d.item.text;
    else { m.src = d.item.src; m.text = d.item.name || ''; }
    return m;
  }

  function makeLetter(role) {
    var cards = S.lib.card.items.filter(function (i) {
      var g = role.groups.card;
      if (S.lib.card.zhupiGroup && i.groups.indexOf(S.lib.card.zhupiGroup) >= 0) return false;
      return g.indexOf('*') >= 0 || i.groups.some(function (x) { return g.indexOf(x) >= 0; });
    });
    if (!cards.length) return null;
    var n = 3 + Math.floor(Math.random() * 4), lines = [], used = {};
    for (var k = 0; k < n * 3 && lines.length < n; k++) {
      var c = C.pick(cards);
      if (!used[c.id]) { used[c.id] = 1; lines.push(c.text); }
    }
    var to = role.callMe || S.settings.selfName || '君';
    return { id: C.uid(), from: 'peer', at: Date.now(), kept: false, fresh: true,
      text: to + '：\n\n' + lines.join('\n') + '\n\n' + role.name + ' 手书\n' + C.shichen(new Date()) };
  }

  function process() {
    var now = Date.now(), changed = false;
    S.pending.slice().sort(function (a, b) { return a.dueAt - b.dueAt; }).forEach(function (job) {
      if (job.dueAt > now) return;
      var role = St.roleById(job.roleId);
      if (!role) { job.remaining = 0; return; }
      if (job.kind === 'letter') {
        var letter = makeLetter(role);
        if (letter) { S.letters[role.id].push(letter); St.save('letters'); emit('letter', { roleId: role.id, letter: letter }); }
        job.remaining = 0; changed = true; return;
      }
      var list = S.messages[role.id];
      if (!job.started) { job.started = true; maybeZhupi(role, list); }
      var m = makeReply(role);
      if (!m) { job.remaining = 0; U.toast(role.name + '的墨藏是空的，请先为其勾选分组。'); changed = true; return; }
      list.push(m); changed = true;
      job.remaining--;
      emit('message', { roleId: role.id, msg: m });
      if (job.remaining > 0) job.dueAt = now + Math.max(600, waitMs(role) / 2);
      else if (role.callChance && Math.random() * 100 < role.callChance) emit('incoming-call', { roleId: role.id });
    });
    S.pending = S.pending.filter(function (j) { return j.remaining > 0; });
    if (changed) { St.save('messages'); St.save('pending'); }
    schedule();
    emit('pending');
  }

  function schedule() {
    clearTimeout(timer);
    if (!S.pending.length) return;
    var next = Math.min.apply(null, S.pending.map(function (j) { return j.dueAt; }));
    timer = setTimeout(process, Math.min(2147483000, Math.max(0, next - Date.now())));
  }

  W.ChisuEngine = { on: on, emit: emit, queueChat: queueChat, queueLetter: queueLetter, cancel: cancel, process: process, schedule: schedule, pendingCount: pendingCount };
})(window);
