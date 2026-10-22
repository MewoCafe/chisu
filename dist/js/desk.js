/* 尺素 · 书案：灯、笺、砚、笔、墨与案脚。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState;
  var $ = U.$;

  function refresh() {
    var S = St.S, role = St.currentRole(), now = new Date();
    var state = C.roleState(role, now);
    var desk = $('#home');
    desk.classList.remove('state-awake', 'state-rest', 'state-travel');
    desk.classList.add('state-' + state);
    $('#lamp-state').textContent = C.STATE_NAMES[state];
    $('#paper-to').textContent = '致 ' + role.name;
    $('#desk-who-name').textContent = role.name;
    $('#desk-who-img').src = St.avatarOf(role);
    var unread = (S.letters[role.id] || []).some(function (l) { return l.from === 'peer' && l.fresh; });
    $('#paper-new').hidden = !unread;
    var idx = S.roles.indexOf(role) + 1;
    $('#desk-time').innerHTML = U.esc(C.shichen(now)) + '<i>' + U.esc(C.upperNum(idx)) + '</i>';
  }

  /* 取笔 → 蘸墨 → 落纸。返回 Promise，动画结束后由调用者展开共书。 */
  function pickBrush() {
    var S = St.S;
    if (S.settings.bookStyle === 'simple') return Promise.resolve();
    if (S.settings.lite || S.settings.reduced) return Promise.resolve();
    var brushBtn = $('#tool-brush'), visual = $('#brush-visual'), pool = $('#ink-pool'), paper = $('#tool-paper');
    var br = brushBtn.getBoundingClientRect();
    var fly = visual.cloneNode(true);
    fly.removeAttribute('id');
    fly.className = 'brush-visual brush-fly';
    fly.style.left = br.left + 'px'; fly.style.top = br.top + 'px';
    fly.style.width = br.width + 'px'; fly.style.height = br.height + 'px';
    fly.style.transform = fly.style.webkitTransform = 'rotate(-14deg)';
    document.body.appendChild(fly);
    visual.style.visibility = 'hidden';
    $('#home').classList.add('busy');
    function to(x, y, rot) {
      var tx = x - (br.left + br.width / 2), ty = y - (br.top + br.height * 0.95);
      var v = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + rot + 'deg)';
      fly.style.transform = fly.style.webkitTransform = v;
      return U.after(fly, 380);
    }
    var ink = pool.getBoundingClientRect(), pp = paper.getBoundingClientRect();
    return U.wait(20).then(function () {
      fly.style.transform = fly.style.webkitTransform = 'translate(-6px,-22px) rotate(-6deg)';
      return U.after(fly, 380);
    }).then(function () {
      return to(ink.left + ink.width * 0.5, ink.top + ink.height * 0.55, 18);
    }).then(function () {
      pool.classList.remove('ripple'); void pool.offsetWidth; pool.classList.add('ripple');
      return U.wait(160);
    }).then(function () {
      return to(pp.left + pp.width * 0.5, pp.top + pp.height * 0.45, 8);
    }).then(function () {
      fly.style.transition = 'opacity .2s'; fly.style.opacity = '0';
      return U.wait(120);
    }).then(cleanup, function () { cleanup(); });
    function cleanup() {
      if (fly.parentNode) fly.parentNode.removeChild(fly);
      visual.style.visibility = '';
      $('#home').classList.remove('busy');
    }
  }

  function inkPress() { var p = $('#ink-pool'); if (!p) return; p.classList.remove('ripple'); void p.offsetWidth; p.classList.add('ripple'); }

  function applyStyle() {
    var desk = $('#home'), next = St.S.settings.bookStyle === 'simple' ? 'simple' : 'ornate';
    if (desk.getAttribute('data-desk-style') === next) return;
    desk.innerHTML = $('#desk-' + next).innerHTML;
    desk.setAttribute('data-desk-style', next);
    refresh();
    if (W.ChisuAlmanac) W.ChisuAlmanac.decorateDesk();
  }

  W.ChisuDesk = { applyStyle: applyStyle, refresh: refresh, pickBrush: pickBrush, inkPress: inkPress };
})(window);
