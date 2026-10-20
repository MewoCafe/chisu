/* 尺素 · 传音：一盏灯、一线声纹、逐字浮现的言语。对方的话取自其字笺。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine;
  var $ = U.$, h = U.h;

  var cur = null; // {role, startAt, timer, speakTimer, raf, state}

  function lines(role) {
    var lib = St.S.lib.card, zg = lib.zhupiGroup, g = role.groups.card;
    return lib.items.filter(function (i) {
      if (zg && i.groups.indexOf(zg) >= 0) return false;
      return g.indexOf('*') >= 0 || i.groups.some(function (x) { return g.indexOf(x) >= 0; });
    });
  }

  function ctrl(buttons) {
    var box = U.clear($('#call-ctrl'));
    buttons.forEach(function (b) { box.appendChild(b); });
  }
  function key(label, sub, cls, fn) {
    return h('button', { class: 'call-key ' + (cls || ''), type: 'button', onclick: fn }, [label, sub ? h('small', { text: sub }) : null]);
  }

  /* 声纹：说话时起伏，静默时近乎平直 */
  var amp = 0, target = 0, phase = 0;
  function wave() {
    if (!cur) return;
    amp += (target - amp) * 0.08;
    phase += 0.09;
    var a = '', b = '';
    for (var x = 0; x <= 300; x += 6) {
      var env = Math.sin(Math.PI * x / 300);
      var y1 = 22 + Math.sin(x * 0.07 + phase) * amp * env * (0.6 + 0.4 * Math.sin(x * 0.019 + phase * 0.7));
      var y2 = 22 + Math.sin(x * 0.05 - phase * 0.8) * amp * 0.6 * env;
      a += (x ? 'L' : 'M') + x + ' ' + y1.toFixed(1);
      b += (x ? 'L' : 'M') + x + ' ' + y2.toFixed(1);
    }
    $('#wave-a').setAttribute('d', a);
    $('#wave-b').setAttribute('d', b);
    cur.raf = W.requestAnimationFrame(wave);
  }

  function tick() {
    if (!cur || !cur.startAt) return;
    $('#call-time').textContent = '已叙 · ' + C.durationText((Date.now() - cur.startAt) / 1000);
  }

  function say(text, me) {
    var sub = $('#call-sub');
    sub.className = 'call-sub' + (me ? ' me' : '');
    U.clear(sub);
    if (me) { sub.textContent = text; return; }
    var gs = C.graphemes(text), t = 0;
    gs.forEach(function (g) {
      var s = h('span', { class: 'g', text: g });
      s.style.webkitAnimationDelay = s.style.animationDelay = t + 'ms';
      sub.appendChild(s);
      t += /[，。！？、]/.test(g) ? 260 : 120;
    });
    $('#call').classList.add('speaking'); target = 12;
    clearTimeout(cur.quiet);
    cur.quiet = setTimeout(function () { if (!cur) return; $('#call').classList.remove('speaking'); target = 1.5; }, t + 400);
    if (St.S.settings.tts && W.speechSynthesis && W.SpeechSynthesisUtterance) {
      try { var u = new W.SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.85; u.pitch = 0.95; W.speechSynthesis.cancel(); W.speechSynthesis.speak(u); } catch (e) { /* 无诵读 */ }
    }
    cur.said.push(text);
  }

  function speakSoon(min, max) {
    clearTimeout(cur.speakTimer);
    cur.speakTimer = setTimeout(function () {
      if (!cur || cur.state !== 'talk') return;
      var p = C.pick(lines(cur.role));
      if (p) say(p.text);
      speakSoon(6000, 12000);
    }, min + Math.random() * (max - min));
  }

  function connect() {
    cur.state = 'talk';
    cur.startAt = Date.now();
    $('#call').classList.remove('ringing');
    $('#call-state').textContent = '已通 · 灯下相对';
    cur.timer = setInterval(tick, 1000); tick();
    target = 1.5;
    ctrl([
      key('言', '', '', function () { var f = $('#call-input'); f.hidden = !f.hidden; if (!f.hidden) $('#call-text').focus(); }),
      key('止', '', 'hang', hangup),
      key(St.S.settings.tts ? '诵' : '默', St.S.settings.tts ? '诵读' : '不诵', St.S.settings.tts ? 'on' : '', function () {
        St.S.settings.tts = !St.S.settings.tts; St.save('settings');
        this.firstChild.textContent = St.S.settings.tts ? '诵' : '默';
        this.lastChild.textContent = St.S.settings.tts ? '诵读' : '不诵';
        this.classList.toggle('on', St.S.settings.tts);
        if (!St.S.settings.tts && W.speechSynthesis) W.speechSynthesis.cancel();
      })
    ]);
    var first = C.pick(lines(cur.role));
    setTimeout(function () { if (cur && cur.state === 'talk') say(first ? first.text : '我在。'); }, 900);
    speakSoon(7000, 11000);
  }

  function open(role, incoming) {
    if (cur) return;
    if (role.travel) { U.toast(role.name + '远行，传音不达。'); return; }
    cur = { role: role, state: incoming ? 'ring-in' : 'ring-out', said: [] };
    var el = $('#call');
    $('#call-avatar').src = St.avatarOf(role);
    $('#call-name').textContent = role.name;
    $('#call-time').textContent = '';
    U.clear($('#call-sub'));
    $('#call-input').hidden = true;
    el.classList.add('open', 'ringing');
    target = 0; amp = 0; wave();
    if (incoming) {
      $('#call-state').textContent = role.name + ' 遣信使相召';
      ctrl([key('辞', '', '', function () { close(); W.ChisuChat.addNote(role.id, '— 辞了' + role.name + '的传音 —'); }), key('接', '', 'answer', connect)]);
      if (navigator.vibrate) try { navigator.vibrate([200, 120, 200]); } catch (e) { /* 无震 */ }
    } else {
      $('#call-state').textContent = '遣信使相召……';
      ctrl([key('止', '', 'hang', function () { close(); })]);
      var st = C.roleState(role, new Date());
      cur.ringTimer = setTimeout(function () {
        if (!cur) return;
        if (st === 'rest' && Math.random() < 0.5) {
          $('#call-state').textContent = role.name + '已歇下，未应';
          setTimeout(function () { close(); W.ChisuChat.addNote(role.id, '— 传音未应 —'); }, 1600);
        } else connect();
      }, 1800 + Math.random() * 2200);
    }
  }

  function hangup() {
    if (!cur) return;
    var role = cur.role, sec = cur.startAt ? (Date.now() - cur.startAt) / 1000 : 0;
    close();
    W.ChisuChat.addNote(role.id, '— 传音 · ' + C.durationText(sec) + ' —');
  }

  function close() {
    if (!cur) return;
    clearInterval(cur.timer); clearTimeout(cur.speakTimer); clearTimeout(cur.ringTimer); clearTimeout(cur.quiet);
    W.cancelAnimationFrame(cur.raf);
    if (W.speechSynthesis) try { W.speechSynthesis.cancel(); } catch (e) { /* */ }
    cur = null;
    $('#call').classList.remove('open', 'ringing', 'speaking');
  }

  function init() {
    $('#call-btn').addEventListener('click', function () { open(St.currentRole(), false); });
    $('#call-input').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = $('#call-text').value.trim();
      if (!t || !cur) return;
      $('#call-text').value = '';
      say(t, true);
      speakSoon(1800, 3800);
    });
    E.on('incoming-call', function (d) {
      var r = St.roleById(d.roleId);
      if (r && !cur && !document.hidden) setTimeout(function () { open(r, true); }, 2500);
    });
  }

  W.ChisuCall = { init: init, open: open, close: close, active: function () { return !!cur; } };
})(window);
