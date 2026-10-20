/* 尺素 · 尺牍：竖排信笺，一封一叶；修书封缄后，对方隔些时候回信。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine;
  var $ = U.$, h = U.h;
  var idx = -1;

  function list() { return St.S.letters[St.currentRole().id]; }

  function render() {
    var role = St.currentRole(), ls = list();
    $('#letters-sub').textContent = '与 ' + role.name;
    if (idx < 0 || idx >= ls.length) idx = ls.length - 1;
    var body = U.clear($('#letter-body'));
    if (!ls.length) {
      body.appendChild(h('p', { class: 'letter-empty', text: '案上尚无书信' }));
    } else {
      var l = ls[idx];
      var wrap = h('div', { class: 'letter-wrap' }, h('div', { class: 'letter-inner' }, [
        h('div', { class: 'letter-scroll' }, h('div', { class: 'letter-text' + (l.from === 'me' ? ' me' : ''), text: l.text })),
        l.kept ? h('span', { class: 'letter-kept', text: '藏' }) : null,
        h('span', { class: 'letter-meta', text: (l.from === 'me' ? '寄 ' + role.name : role.name + ' 来书') + ' · ' + dateText(l.at) })
      ]));
      body.appendChild(wrap);
      // 竖排从右起笔：滚到最右
      var sc = wrap.querySelector('.letter-scroll');
      W.requestAnimationFrame(function () { sc.scrollLeft = sc.scrollWidth; });
      if (l.fresh) { delete l.fresh; St.save('letters'); W.ChisuDesk.refresh(); }
    }
    $('#lt-prev').disabled = idx <= 0;
    $('#lt-next').disabled = idx >= ls.length - 1;
    $('#lt-num').textContent = ls.length ? C.hanNum(idx + 1) + ' / ' + C.hanNum(ls.length) : '';
    $('#lt-keep').textContent = ls[idx] && ls[idx].kept ? '已藏' : '藏';
    $('#lt-keep').disabled = !ls.length;
  }

  function dateText(at) {
    var d = new Date(at);
    return C.hanNum(d.getMonth() + 1) + '月' + C.hanNum(d.getDate()) + '日 ' + C.shichen(d);
  }

  function write() {
    var role = St.currentRole();
    U.sheet({
      title: '修书', sub: '致 ' + role.name, build: function (body, s) {
        var ta = h('textarea', { class: 'field', rows: '9', maxlength: '2000', placeholder: (role.name) + '：\n\n见字如晤……' });
        ta.value = St.S.settings.letterDraft || '';
        ta.addEventListener('input', function () { St.S.settings.letterDraft = ta.value; St.save('settings'); });
        body.appendChild(ta);
        body.appendChild(h('p', { class: 'ed-note', text: '封缄之后，' + role.name + '约于 ' + role.letterWait.min + '–' + role.letterWait.max + ' 分内回信（小憩时加倍）。' }));
        body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'seal-btn cinnabar', type: 'button', text: '封缄', onclick: function () {
          var t = ta.value.trim();
          if (!t) { U.toast('素笺尚空。'); return; }
          list().push({ id: C.uid(), from: 'me', text: t, at: Date.now(), kept: false });
          St.S.settings.letterDraft = ''; St.save('settings'); St.save('letters');
          E.queueLetter(role);
          s.close(); idx = -1; render();
          U.toast('信已封缄，交予驿使。');
        } })));
      }
    });
  }

  function init() {
    $('#letter-write').addEventListener('click', write);
    $('#lt-prev').addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
    $('#lt-next').addEventListener('click', function () { if (idx < list().length - 1) { idx++; render(); } });
    $('#lt-keep').addEventListener('click', function () { var l = list()[idx]; if (!l) return; l.kept = !l.kept; St.save('letters'); render(); });
    E.on('letter', function (d) { if (W.ChisuApp.view() === 'letters' && d.roleId === St.currentRole().id) { idx = -1; render(); } W.ChisuDesk.refresh(); });
  }

  W.ChisuLetters = { init: init, render: render, enter: function () { idx = -1; render(); } };
})(window);
