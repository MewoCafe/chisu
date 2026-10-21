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

  /* 横排扉页轻启，随后展开共书。 */
  function pickBrush() {
    var desk = $('#home');
    if (St.S.settings.lite || St.S.settings.reduced) return Promise.resolve();
    desk.classList.add('busy', 'opening');
    return U.wait(180).then(function () { desk.classList.remove('busy', 'opening'); });
  }

  function inkPress() { /* 目录式书案无需拟物蘸墨。 */ }

  W.ChisuDesk = { refresh: refresh, pickBrush: pickBrush, inkPress: inkPress };
})(window);
