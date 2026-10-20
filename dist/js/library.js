/* 尺素 · 墨藏：字笺 / 颜 / 画 / 印 四库，各可立组；图片支持引链与呈图（自动压缩）。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil, St = W.ChisuState;
  var $ = U.$, h = U.h;

  var lib = 'card', group = '*', pageNo = 0, selecting = false, selected = {}, perPage = 10;

  function L() { return St.S.lib[lib]; }
  function isImg() { return lib === 'img' || lib === 'stk'; }
  function groupName(id) { var g = L().groups.filter(function (x) { return x.id === id; })[0]; return g ? g.name : ''; }

  function results() {
    var q = $('#lib-search').value.trim().toLowerCase();
    return L().items.filter(function (i) {
      if (group !== '*' && i.groups.indexOf(group) < 0) return false;
      if (!q) return true;
      if (/^#?\d+$/.test(q)) return i.n === Number(q.replace('#', ''));
      return String(i.text || i.name || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  function computePerPage() {
    var box = $('#lib-list'), hgt = box.clientHeight - 8;
    if (lib === 'card') perPage = Math.max(3, Math.floor(hgt / 52));
    else if (lib === 'kao') perPage = Math.max(2, Math.floor((hgt + 8) / 62)) * 2;
    else perPage = Math.max(1, Math.floor((hgt + 8) / 104)) * 3;
  }

  function render() {
    C.dedupeCards(St.S.lib.card);
    U.$$('#lib-tabs .tab-v').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lib') === lib); });
    $('#lib-sub').textContent = C.LIB_NAMES[lib] + ' · 共 ' + L().items.length;
    $('#lib-batch').hidden = isImg();
    $('#lib-batch').nextElementSibling.hidden = isImg();
    // 组
    var gb = U.clear($('#lib-groups'));
    [{ id: '*', name: '全部' }].concat(L().groups).forEach(function (g) {
      var b = h('button', { class: 'chip' + (group === g.id ? ' on' : ''), type: 'button', text: g.name + (g.id === St.S.lib.card.zhupiGroup && lib === 'card' ? ' · 朱批用' : '') });
      b.addEventListener('click', function () { group = g.id; pageNo = 0; render(); });
      gb.appendChild(b);
    });
    gb.appendChild(h('button', { class: 'chip add', type: 'button', text: '＋ 立组', onclick: newGroup }));
    if (L().groups.length) gb.appendChild(h('button', { class: 'chip add', type: 'button', text: '理组', onclick: manageGroups }));
    // 条目
    computePerPage();
    var res = results(), pages = Math.max(1, Math.ceil(res.length / perPage));
    pageNo = Math.max(0, Math.min(pageNo, pages - 1));
    var slice = res.slice(pageNo * perPage, pageNo * perPage + perPage);
    var box = U.clear($('#lib-list'));
    if (!res.length) {
      box.appendChild(h('p', { class: 'lib-empty' }, [L().items.length ? '寻之不得' : '此匣尚空', h('br'), h('small', { text: L().items.length ? '' : '点右上「添」置入' })]));
    } else if (lib === 'card') {
      slice.forEach(function (it) {
        box.appendChild(h('button', { class: 'lib-row' + (selected[it.id] ? ' sel' : ''), type: 'button', onclick: function () { tap(it); } }, [
          h('span', { class: 'no', text: '#' + String(it.n).padStart(4, '0') }),
          h('span', { class: 'tx', text: it.text }),
          h('span', { class: 'gp', text: it.groups.map(groupName).filter(Boolean).join('·') })
        ]));
      });
    } else {
      var grid = h('div', { class: 'lib-grid ' + lib });
      slice.forEach(function (it) {
        var cell = h('button', { class: 'lib-cell' + (selected[it.id] ? ' sel' : ''), type: 'button', onclick: function () { tap(it); } });
        if (lib === 'kao') cell.appendChild(document.createTextNode(it.text));
        else cell.appendChild(h('img', { src: it.src, alt: it.name || '', loading: 'lazy' }));
        cell.appendChild(h('span', { class: 'no', text: '#' + it.n }));
        grid.appendChild(cell);
      });
      box.appendChild(grid);
    }
    $('#lib-prev').disabled = pageNo <= 0;
    $('#lib-next').disabled = pageNo >= pages - 1;
    $('#lib-num').textContent = C.hanNum(pageNo + 1) + ' / ' + C.hanNum(pages);
    $('#sel-bar').hidden = !selecting;
    $('#lib-tools').style.display = selecting ? 'none' : '';
    var n = Object.keys(selected).length;
    $('#sel-count').textContent = n ? '已择 ' + C.hanNum(n) : '尚未择取';
    St.save('lib');
  }

  function tap(it) {
    if (selecting) { if (selected[it.id]) delete selected[it.id]; else selected[it.id] = 1; render(); return; }
    editItem(it);
  }

  function groupChips(chosen) {
    var box = h('div', { class: 'chips' });
    function draw() {
      U.clear(box);
      L().groups.forEach(function (g) {
        box.appendChild(h('button', { class: 'chip' + (chosen.indexOf(g.id) >= 0 ? ' on' : ''), type: 'button', text: g.name, onclick: function () {
          var i = chosen.indexOf(g.id); if (i >= 0) chosen.splice(i, 1); else chosen.push(g.id); draw();
        } }));
      });
      box.appendChild(h('button', { class: 'chip add', type: 'button', text: '＋ 立组', onclick: function () {
        askName('立组', '', function (name) { var g = St.addGroup(St.S.lib, lib, name); chosen.push(g.id); draw(); render(); });
      } }));
    }
    draw();
    return box;
  }

  function editItem(it) {
    var chosen = it.groups.slice();
    U.sheet({
      title: '改 · #' + it.n, sub: C.LIB_NAMES[lib], build: function (body, s) {
        var ta = null, nameInput = null;
        if (isImg()) {
          body.appendChild(h('img', { class: 'img-prev', src: it.src, alt: '' }));
          nameInput = h('input', { class: 'field', style: 'width:100%;margin-top:12px', placeholder: '题名（可空）', value: it.name || '' });
          body.appendChild(nameInput);
        } else {
          ta = h('textarea', { class: 'field', rows: lib === 'card' ? '4' : '2' });
          ta.value = it.text;
          body.appendChild(ta);
        }
        body.appendChild(h('div', { class: 'sect-h', style: 'margin-top:18px' }, [h('b', { text: '组' }), '所归']));
        body.appendChild(groupChips(chosen));
        body.appendChild(h('div', { class: 'seal-row' }, [
          h('button', { class: 'seal-btn', type: 'button', text: '存', onclick: function () {
            if (ta) { var t = C.normalizeText(ta.value); if (!t) { U.toast('不可为空。'); return; } it.text = t; }
            if (nameInput) it.name = nameInput.value.trim();
            it.groups = chosen; s.close(); render();
          } }),
          h('button', { class: 'link red', type: 'button', text: '弃', onclick: function () {
            U.confirmSheet('弃去 #' + it.n + '？', '弃', function () { remove([it.id]); s.close(); }, true);
          } })
        ]));
      }
    });
  }

  function remove(ids) {
    var map = {}; ids.forEach(function (i) { map[i] = 1; });
    L().items = L().items.filter(function (i) { return !map[i.id]; });
    selected = {}; render();
    U.toast('已弃 ' + ids.length + ' 件。');
  }

  function askName(title, value, done) {
    U.sheet({ title: title, build: function (body, s) {
      var inp = h('input', { class: 'field', style: 'width:100%', maxlength: '12', placeholder: '组名', value: value || '' });
      body.appendChild(inp);
      body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'seal-btn', type: 'button', text: '定', onclick: function () {
        var n = inp.value.trim(); if (!n) return; s.close(); done(n);
      } })));
      setTimeout(function () { inp.focus(); }, 300);
    } });
  }
  function newGroup() { askName('立组', '', function (n) { var g = St.addGroup(St.S.lib, lib, n); group = g.id; pageNo = 0; render(); }); }

  function manageGroups() {
    U.sheet({ title: '理组', sub: C.LIB_NAMES[lib], build: function (body, s) {
      function draw() {
        U.clear(body);
        L().groups.forEach(function (g, i) {
          var count = L().items.filter(function (it) { return it.groups.indexOf(g.id) >= 0; }).length;
          body.appendChild(h('div', { class: 'row' }, [
            h('span', { class: 'row-label' }, [g.name, h('small', { text: count + ' 件' + (g.id === St.S.lib.card.zhupiGroup && lib === 'card' ? ' · 朱批取此组' : '') })]),
            i > 0 ? h('button', { class: 'link', type: 'button', text: '上移', onclick: function () { var a = L().groups; a.splice(i - 1, 0, a.splice(i, 1)[0]); draw(); render(); } }) : null,
            h('button', { class: 'link', type: 'button', text: '改名', onclick: function () { askName('改名', g.name, function (n) { g.name = n; draw(); render(); }); } }),
            lib === 'card' ? h('button', { class: 'link' + (g.id === St.S.lib.card.zhupiGroup ? ' red' : ''), type: 'button', text: '朱批', onclick: function () {
              St.S.lib.card.zhupiGroup = g.id === St.S.lib.card.zhupiGroup ? '' : g.id; draw(); render();
            } }) : null,
            h('button', { class: 'link red', type: 'button', text: '弃', onclick: function () {
              U.confirmSheet('弃去「' + g.name + '」组？组内条目仍留在库中。', '弃', function () {
                L().groups = L().groups.filter(function (x) { return x.id !== g.id; });
                L().items.forEach(function (it) { it.groups = it.groups.filter(function (x) { return x !== g.id; }); });
                St.S.roles.forEach(function (r) { r.groups[lib] = r.groups[lib].filter(function (x) { return x !== g.id; }); });
                St.save('roles');
                if (group === g.id) group = '*';
                draw(); render();
              }, true);
            } })
          ]));
        });
        body.appendChild(h('p', { class: 'ed-note', html: '「朱批」：标定一组字笺作批语，人物回笔时偶尔取其一，朱笔批在你的原句旁。' }));
      }
      draw();
    } });
  }

  function defaultGroups() { return group === '*' ? [] : [group]; }

  function add() {
    if (lib === 'card' || lib === 'kao') {
      var chosen = defaultGroups();
      U.sheet({ title: '添 · ' + C.LIB_NAMES[lib], build: function (body, s) {
        var ta = h('textarea', { class: 'field', rows: '4', placeholder: lib === 'card' ? '写一张字笺，可换行。' : '(｡･ω･｡)' });
        body.appendChild(ta);
        body.appendChild(h('div', { class: 'sect-h', style: 'margin-top:18px' }, [h('b', { text: '组' }), '所归']));
        body.appendChild(groupChips(chosen));
        body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'seal-btn', type: 'button', text: '存', onclick: function () {
          var t = C.normalizeText(ta.value); if (!t) return;
          if (L().items.some(function (i) { return i.text === t; })) { U.toast('库中已有此句。'); return; }
          St.addItem(St.S.lib, lib, { text: t }, chosen.slice()); s.close(); render(); U.toast('已添。');
        } })));
        setTimeout(function () { ta.focus(); }, 300);
      } });
      return;
    }
    var chosenI = defaultGroups();
    U.sheet({ title: '添 · ' + C.LIB_NAMES[lib], build: function (body, s) {
      body.appendChild(h('div', { class: 'sect-h' }, [h('b', { text: '一' }), '呈图', h('small', { text: '自动压缩，可多选' })]));
      body.appendChild(h('button', { class: 'seal-btn', type: 'button', text: '择图', onclick: function () {
        U.pickFile('image/*', true).then(function (files) {
          if (!files.length) return;
          U.toast('压缩中……');
          var done = 0, fail = 0;
          return files.reduce(function (p, f) {
            return p.then(function () {
              return U.compressImage(f, lib === 'stk' ? { max: 360, quality: 0.82 } : { max: 1080, quality: 0.8 })
                .then(function (src) { St.addItem(St.S.lib, lib, { src: src, name: f.name.replace(/\.[^.]+$/, '') }, chosenI.slice()); done++; }, function () { fail++; });
            });
          }, Promise.resolve()).then(function () { s.close(); render(); U.toast('已添 ' + done + ' 幅' + (fail ? '，' + fail + ' 幅未能读取' : '') + '。'); });
        });
      } }));
      body.appendChild(h('div', { class: 'sect-h', style: 'margin-top:22px' }, [h('b', { text: '二' }), '引链', h('small', { text: '一行一个网址' })]));
      var ta = h('textarea', { class: 'field', rows: '3', placeholder: 'https://……' });
      body.appendChild(ta);
      body.appendChild(h('div', { class: 'sect-h', style: 'margin-top:18px' }, [h('b', { text: '三' }), '所归']));
      body.appendChild(groupChips(chosenI));
      body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'seal-btn', type: 'button', text: '存链', onclick: function () {
        var urls = ta.value.split(/\s+/).filter(function (u) { return /^https?:\/\/\S+$/i.test(u); });
        if (!urls.length) { U.toast('未见可用网址。'); return; }
        urls.forEach(function (u) { St.addItem(St.S.lib, lib, { src: u, url: true }, chosenI.slice()); });
        s.close(); render(); U.toast('已引 ' + urls.length + ' 幅。');
      } })));
    } });
  }

  function batch() {
    var chosen = defaultGroups();
    U.sheet({ title: '批添', sub: '一行一件', build: function (body, s) {
      var ta = h('textarea', { class: 'field', rows: '8', placeholder: '每行一张，重复自动略去。' });
      var stat = h('p', { class: 'ed-note' });
      ta.addEventListener('input', function () { var p = C.parseLines(ta.value); stat.textContent = '可添 ' + p.lines.length + ' 件，重复 ' + p.duplicates + ' 件。'; });
      body.appendChild(ta); body.appendChild(stat);
      body.appendChild(h('div', { class: 'sect-h', style: 'margin-top:12px' }, [h('b', { text: '组' }), '所归']));
      body.appendChild(groupChips(chosen));
      body.appendChild(h('div', { class: 'seal-row' }, h('button', { class: 'seal-btn', type: 'button', text: '存', onclick: function () {
        var parsed = C.parseLines(ta.value); var r = addTexts(parsed.lines, chosen); r.skipped += parsed.duplicates; s.close(); render(); U.toast('已添 ' + r.added + ' 件，略去重复 ' + r.skipped + ' 件。');
      } })));
    } });
  }
  function addTexts(lines, groups) {
    var have = Object.create(null), added = 0, skipped = 0;
    L().items.forEach(function (i) { have[C.normalizeText(i.text)] = i; });
    lines.forEach(function (t) { t = C.normalizeText(t); if (!t) return; if (have[t]) { if (lib === 'card') St.addItem(St.S.lib, lib, { text: t }, groups.slice()); skipped++; return; } have[t] = 1; St.addItem(St.S.lib, lib, { text: t }, groups.slice()); added++; });
    return { added: added, skipped: skipped };
  }

  function importFile() {
    U.pickFile('.txt,.json,text/plain,application/json').then(function (files) {
      var f = files[0]; if (!f) return;
      return U.readText(f).then(function (text) {
        var g = St.addGroup(St.S.lib, lib, '收入 · ' + f.name.replace(/\.[^.]+$/, '').slice(0, 8));
        if (/\.json$/i.test(f.name)) {
          var d = JSON.parse(text.replace(/^﻿/, ''));
          var arr = Array.isArray(d) ? d : (d.items || d.cards || []);
          if (isImg()) {
            var n = 0;
            arr.forEach(function (x) { var src = typeof x === 'string' ? x : x && x.src; if (src && /^(https?:|data:image\/)/.test(src)) { St.addItem(St.S.lib, lib, { src: src, name: (x && x.name) || '' }, [g.id]); n++; } });
            U.toast('已收 ' + n + ' 幅。');
          } else {
            var r = addTexts(arr.map(function (x) { return typeof x === 'string' ? x : x && x.text; }).filter(Boolean), [g.id]);
            U.toast('已收 ' + r.added + ' 件，略去重复 ' + r.skipped + ' 件。');
          }
        } else {
          if (isImg()) { var urls = text.split(/\s+/).filter(function (u) { return /^https?:\/\//.test(u); }); urls.forEach(function (u) { St.addItem(St.S.lib, lib, { src: u, url: true }, [g.id]); }); U.toast('已引 ' + urls.length + ' 幅。'); }
          else { var r2 = addTexts(C.parseLines(text).lines, [g.id]); U.toast('已收 ' + r2.added + ' 件，略去重复 ' + r2.skipped + ' 件。'); }
        }
        group = g.id; pageNo = 0; render();
      });
    }).catch(function (e) { U.toast(e.message || '此卷未能读取。'); });
  }

  function exportFile() {
    var items = Object.keys(selected).length ? L().items.filter(function (i) { return selected[i.id]; }) : results();
    var name = '尺素-' + C.LIB_NAMES[lib];
    if (lib === 'card' || lib === 'kao') {
      U.sheet({ title: '誊出', sub: items.length + ' 件', build: function (body, s) {
        body.appendChild(h('div', { class: 'seal-row' }, [
          h('button', { class: 'seal-btn', type: 'button', text: 'JSON', onclick: function () { U.download(name + '.json', JSON.stringify({ items: items.map(function (i) { return { text: i.text, groups: i.groups.map(groupName) }; }) }, null, 1)); s.close(); } }),
          h('button', { class: 'seal-btn', type: 'button', text: 'TXT', onclick: function () { U.download(name + '.txt', items.map(function (i) { return i.text.replace(/\n/g, ' '); }).join('\n') + '\n', 'text/plain'); s.close(); } })
        ]));
        body.appendChild(h('p', { class: 'ed-note', text: 'JSON 留存换行与组名；TXT 一行一件。' }));
      } });
    } else {
      U.download(name + '.json', JSON.stringify({ items: items.map(function (i) { return { src: i.src, name: i.name || '' }; }) }));
    }
  }

  function assignGroup() {
    var ids = Object.keys(selected);
    if (!ids.length) return;
    var chosen = [];
    U.sheet({ title: '归组', sub: '已择 ' + ids.length + ' 件', build: function (body, s) {
      body.appendChild(groupChips(chosen));
      body.appendChild(h('div', { class: 'seal-row' }, [
        h('button', { class: 'seal-btn', type: 'button', text: '并入', onclick: function () {
          L().items.forEach(function (it) { if (selected[it.id]) chosen.forEach(function (g) { if (it.groups.indexOf(g) < 0) it.groups.push(g); }); });
          s.close(); render();
        } }),
        h('button', { class: 'link', type: 'button', text: '移出这些组', onclick: function () {
          L().items.forEach(function (it) { if (selected[it.id]) it.groups = it.groups.filter(function (g) { return chosen.indexOf(g) < 0; }); });
          s.close(); render();
        } })
      ]));
    } });
  }

  function init() {
    U.$$('#lib-tabs .tab-v').forEach(function (b) { b.addEventListener('click', function () { lib = b.getAttribute('data-lib'); group = '*'; pageNo = 0; selected = {}; $('#lib-search').value = ''; render(); }); });
    $('#lib-add').addEventListener('click', add);
    $('#lib-batch').addEventListener('click', batch);
    $('#lib-import').addEventListener('click', importFile);
    $('#lib-export').addEventListener('click', exportFile);
    $('#lib-select').addEventListener('click', function () { selecting = true; selected = {}; render(); });
    $('#sel-done').addEventListener('click', function () { selecting = false; selected = {}; render(); });
    $('#sel-all').addEventListener('click', function () { var res = results().slice(pageNo * perPage, pageNo * perPage + perPage); res.forEach(function (i) { selected[i.id] = 1; }); render(); });
    $('#sel-group').addEventListener('click', assignGroup);
    $('#sel-del').addEventListener('click', function () { var ids = Object.keys(selected); if (ids.length) U.confirmSheet('弃去已择 ' + ids.length + ' 件？', '弃', function () { remove(ids); }, true); });
    var t; $('#lib-search').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { pageNo = 0; render(); }, 150); });
    $('#lib-prev').addEventListener('click', function () { pageNo--; render(); });
    $('#lib-next').addEventListener('click', function () { pageNo++; render(); });
  }

  W.ChisuLibrary = { init: init, render: render, enter: function () { selecting = false; selected = {}; render(); } };
})(window);
