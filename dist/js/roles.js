/* 尺素 · 人物：灯下故人。每人各有名号、墨藏分组、回笔节奏、作息与性情。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState, E = W.ChisuEngine;
  var $ = U.$, h = U.h;
  var pageNo = 0, per = 6;

  function render() {
    var S = St.S, box = U.clear($('#role-list'));
    per = Math.max(3, Math.floor(($('#roles .folio-body').clientHeight - 10) / 73));
    var pages = Math.max(1, Math.ceil(S.roles.length / per));
    pageNo = Math.min(pageNo, pages - 1);
    S.roles.slice(pageNo * per, pageNo * per + per).forEach(function (r, k) {
      var i = pageNo * per + k;
      var st = C.roleState(r, new Date());
      var isCur = r.id === S.settings.currentRole;
      box.appendChild(h('div', { class: 'role-row' }, [
        h('span', { class: 'num', text: C.upperNum(i + 1) }),
        h('img', { src: St.avatarOf(r), alt: '' }),
        h('button', { class: 't', type: 'button', style: 'text-align:left', onclick: function () { edit(r); } }, [
          h('b', { text: r.name }),
          h('small', { text: C.STATE_NAMES[st] + ' · 候 ' + r.wait.min + '–' + r.wait.max + ' 秒 · 每回 ' + r.count.min + '–' + r.count.max + ' 张' })
        ]),
        isCur ? h('span', { class: 'cur', text: '今' }) : h('button', { class: 'go', type: 'button', text: '共书', onclick: function () { choose(r, true); } })
      ]));
    });
    $('#role-prev').disabled = pageNo <= 0;
    $('#role-next').disabled = pageNo >= pages - 1;
    $('#role-num').textContent = C.hanNum(pageNo + 1) + ' / ' + C.hanNum(pages);
  }

  function choose(r, go) {
    St.S.settings.currentRole = r.id; St.save('settings');
    W.ChisuChat.resetCache();
    W.ChisuDesk.refresh();
    render();
    if (go) W.ChisuApp.go('chat');
  }

  function quickSwitch() {
    var S = St.S;
    if (S.roles.length < 2) { W.ChisuApp.go('roles'); return; }
    U.sheet({ title: '换人共书', build: function (body, s) {
      S.roles.forEach(function (r) {
        body.appendChild(h('button', { class: 'role-row', type: 'button', onclick: function () { choose(r); s.close(); } }, [
          h('img', { src: St.avatarOf(r), alt: '' }),
          h('span', { class: 't' }, [h('b', { text: r.name }), h('small', { text: C.STATE_NAMES[C.roleState(r, new Date())] })]),
          r.id === S.settings.currentRole ? h('span', { class: 'cur', text: '今' }) : null
        ]));
      });
      body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'link', type: 'button', text: '理人物', onclick: function () { s.close(); W.ChisuApp.go('roles'); } })));
    } });
  }

  function numField(val, lo, hi, step) {
    return h('input', { class: 'field num', type: 'number', inputmode: 'decimal', min: String(lo), max: String(hi), step: String(step || 1), value: String(val) });
  }
  function toggle(on, label) {
    var b = h('button', { class: 'seal-toggle', type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label, text: on ? '启' : '闭' });
    b.addEventListener('click', function () { var v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', v ? 'true' : 'false'); b.textContent = v ? '启' : '闭'; });
    b.val = function () { return b.getAttribute('aria-checked') === 'true'; };
    return b;
  }

  function edit(role, isNew) {
    var S = St.S;
    var draft = JSON.parse(JSON.stringify(role));
    var sec = 'name';
    var refs = {};
    var s = U.sheet({
      title: isNew ? '立新人' : draft.name, sub: '人物', full: true, sticky: true, closeText: '罢',
      build: function (body, sh) {
        body.style.padding = '0';
        body.style.display = 'flex';
        var nav = h('nav', { class: 'tabs-v' });
        var pane = h('div', { class: 'ed-pane' });
        [['name', '名号'], ['lib', '墨藏'], ['pace', '回笔'], ['mood', '性情']].forEach(function (t) {
          nav.appendChild(h('button', { class: 'tab-v' + (t[0] === sec ? ' on' : ''), type: 'button', 'data-sec': t[0], text: t[1], onclick: function () { collect(); sec = t[0]; U.$$('.tab-v', nav).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sec') === sec); }); draw(); } }));
        });
        body.appendChild(nav); body.appendChild(pane);
        var foot = h('div', { class: 'ed-foot' }, [
          !isNew && S.roles.length > 1 ? h('button', { class: 'link red', type: 'button', text: '辞别此人', onclick: function () {
            U.confirmSheet('辞别「' + role.name + '」？其往来书信一并删去。', '辞别', function () {
              S.roles = S.roles.filter(function (r) { return r.id !== role.id; });
              delete S.messages[role.id]; delete S.letters[role.id];
              S.pending = S.pending.filter(function (j) { return j.roleId !== role.id; });
              if (S.settings.currentRole === role.id) S.settings.currentRole = S.roles[0].id;
              St.saveAll(); sh.close(); render(); W.ChisuDesk.refresh();
            }, true);
          } }) : h('span'),
          h('button', { class: 'seal-btn cinnabar', type: 'button', text: '存', onclick: save })
        ]);
        sh.panel.appendChild(foot);

        function draw() {
          U.clear(pane); refs = {};
          if (sec === 'name') {
            var img = h('img', { src: draft.avatar || U.monogram(draft.name), alt: '' });
            pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '一' }), '名号']));
            pane.appendChild(h('div', { class: 'avatar-edit' }, [img, h('div', { class: 'acts' }, [
              h('button', { class: 'link ink', type: 'button', text: '换像', onclick: function () {
                U.pickFile('image/*').then(function (f) { if (!f[0]) return; return U.compressImage(f[0], { square: 256, quality: 0.86 }).then(function (src) { draft.avatar = src; img.src = src; }); }).catch(function (e) { U.toast(e.message); });
              } }),
              h('button', { class: 'link', type: 'button', text: '复为字印', onclick: function () { draft.avatar = ''; img.src = U.monogram(refs.name.value || draft.name); } })
            ])]));
            refs.name = h('input', { class: 'field', style: 'width:100%', maxlength: '16', value: draft.name, placeholder: '名' });
            refs.callMe = h('input', { class: 'field', style: 'width:100%', maxlength: '16', value: draft.callMe, placeholder: '如：阿素、君、先生' });
            pane.appendChild(h('div', { class: 'row name-row' }, [h('span', { class: 'row-label', text: '名' }), refs.name]));
            pane.appendChild(h('div', { class: 'row name-row' }, [h('span', { class: 'row-label' }, ['称我为', h('small', { text: '来信抬头所用' })]), refs.callMe]));
          }
          if (sec === 'lib') {
            pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '二' }), '墨藏', h('small', { text: '勾选此人可用之组' })]));
            C.LIBS.forEach(function (k) {
              var chosen = draft.groups[k];
              var box = h('div', { class: 'chips' });
              function drawChips() {
                U.clear(box);
                var all = chosen.indexOf('*') >= 0;
                box.appendChild(h('button', { class: 'chip' + (all ? ' on' : ''), type: 'button', text: '全部', onclick: function () {
                  draft.groups[k] = chosen = all ? [] : ['*']; drawChips();
                } }));
                S.lib[k].groups.forEach(function (g) {
                  var on = !all && chosen.indexOf(g.id) >= 0;
                  box.appendChild(h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', text: g.name + (k === 'card' && g.id === S.lib.card.zhupiGroup ? '（朱批）' : ''), onclick: function () {
                    if (all) chosen = [];
                    var i = chosen.indexOf(g.id); if (i >= 0) chosen.splice(i, 1); else chosen.push(g.id);
                    draft.groups[k] = chosen; drawChips();
                  } }));
                });
                if (!chosen.length) box.appendChild(h('span', { class: 'ed-note', style: 'margin:8px 4px', text: '不用此库' }));
              }
              drawChips();
              pane.appendChild(h('div', { class: 'lib-pick' }, [h('h4', { text: C.LIB_NAMES[k] }), box]));
            });
            pane.appendChild(h('p', { class: 'ed-note', text: '朱批组只供批语，勾选「全部」也不会混入寻常回笔。' }));
          }
          if (sec === 'pace') {
            pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '三' }), '回笔', h('small', { text: '系统在区间内随机' })]));
            refs.wmin = numField(draft.wait.min, 0, 86400, 0.1); refs.wmax = numField(draft.wait.max, 0, 86400, 0.1);
            refs.cmin = numField(draft.count.min, 1, 30); refs.cmax = numField(draft.count.max, 1, 30);
            refs.lmin = numField(draft.letterWait.min, 0, 1440); refs.lmax = numField(draft.letterWait.max, 0, 1440);
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['候', h('small', { text: '收信后多久起笔' })]), h('span', { class: 'range-line' }, [refs.wmin, '至', refs.wmax, '秒'])]));
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['每回', h('small', { text: '一回写几张' })]), h('span', { class: 'range-line' }, [refs.cmin, '至', refs.cmax, '张'])]));
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['回信', h('small', { text: '尺牍往返' })]), h('span', { class: 'range-line' }, [refs.lmin, '至', refs.lmax, '分'])]));
            pane.appendChild(h('div', { class: 'sect-h', style: 'margin-top:20px' }, [h('b', { text: '体' }), '体例比重', h('small', { text: '各库抽取的分量' })]));
            var mg = h('div', { class: 'mix-grid' });
            refs.mix = {};
            C.LIBS.forEach(function (k) { refs.mix[k] = numField(draft.mix[k], 0, 100); mg.appendChild(h('label', null, [C.LIB_NAMES[k], refs.mix[k]])); });
            pane.appendChild(mg);
          }
          if (sec === 'mood') {
            pane.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '四' }), '性情']));
            refs.zhupi = numField(draft.zhupi, 0, 100); refs.call = numField(draft.callChance, 0, 100);
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['朱批', h('small', { text: '回笔时圈点你原句的几率' })]), h('span', { class: 'range-line' }, [refs.zhupi, '分'])]));
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['来召', h('small', { text: '回笔后主动传音的几率' })]), h('span', { class: 'range-line' }, [refs.call, '分'])]));
            pane.appendChild(h('div', { class: 'sect-h', style: 'margin-top:20px' }, [h('b', { text: '灯' }), '作息', h('small', { text: '案头灯随之明暗' })]));
            refs.sleepOn = toggle(draft.sleep.on, '作息');
            refs.sf = numField(draft.sleep.from, 0, 23); refs.st = numField(draft.sleep.to, 0, 23);
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['夜寝', h('small', { text: '寝时回笔迟一倍，传音或不应' })]), refs.sleepOn]));
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label', text: '寝时' }), h('span', { class: 'range-line' }, [refs.sf, '时至', refs.st, '时'])]));
            refs.travel = toggle(draft.travel, '远行');
            pane.appendChild(h('div', { class: 'row' }, [h('span', { class: 'row-label' }, ['远行', h('small', { text: '远行时不共书、不传音，唯书信可达' })]), refs.travel]));
          }
        }
        function collect() {
          if (refs.name) { draft.name = refs.name.value.trim() || draft.name; draft.callMe = refs.callMe.value.trim(); }
          if (refs.wmin) {
            draft.wait = C.normRange({ min: refs.wmin.value, max: refs.wmax.value }, 0, 86400, draft.wait, false);
            draft.count = C.normRange({ min: refs.cmin.value, max: refs.cmax.value }, 1, 30, draft.count, true);
            draft.letterWait = C.normRange({ min: refs.lmin.value, max: refs.lmax.value }, 0, 1440, draft.letterWait, false);
            C.LIBS.forEach(function (k) { draft.mix[k] = C.clampNum(refs.mix[k].value, 0, 100, draft.mix[k]); });
          }
          if (refs.zhupi) {
            draft.zhupi = C.clampNum(refs.zhupi.value, 0, 100, draft.zhupi);
            draft.callChance = C.clampNum(refs.call.value, 0, 100, draft.callChance);
            draft.sleep = { on: refs.sleepOn.val(), from: Math.round(C.clampNum(refs.sf.value, 0, 23, 23)), to: Math.round(C.clampNum(refs.st.value, 0, 23, 7)) };
            draft.travel = refs.travel.val();
          }
        }
        function save() {
          collect();
          if (isNew) { S.roles.push(draft); S.messages[draft.id] = []; S.letters[draft.id] = []; }
          else Object.keys(draft).forEach(function (k) { role[k] = draft[k]; });
          St.save('roles'); St.save('messages'); St.save('letters');
          sh.close(); render(); W.ChisuDesk.refresh(); W.ChisuChat.status();
          U.toast('已存。');
        }
        draw();
      }
    });
    return s;
  }

  function init() {
    $('#role-add').addEventListener('click', function () {
      var r = St.newRole();
      var ids = St.S.lib.card.groups.filter(function (g) { return g.id !== St.S.lib.card.zhupiGroup; }).map(function (g) { return g.id; });
      if (ids.length) r.groups.card = ids;
      edit(r, true);
    });
    $('#role-prev').addEventListener('click', function () { pageNo--; render(); });
    $('#role-next').addEventListener('click', function () { pageNo++; render(); });
  }

  W.ChisuRoles = { init: init, render: render, edit: edit, quickSwitch: quickSwitch, enter: render };
})(window);
