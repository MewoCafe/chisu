/* 尺素 · 起居笺与岁时簿。数据留本机，历法及诗库按需展卷。 */
(function (W) {
  'use strict';
  var U = W.ChisuUtil, C = W.ChisuCore, St = W.ChisuState, A = W.ChisuAlmanacCore, h = U.h;
  var lunarTask, poemTask, eraTask;
  function store() {
    var s = St.S.settings;
    if (!s.almanac || typeof s.almanac !== 'object') s.almanac = {};
    var a = s.almanac;
    if (!a.seed) a.seed = C.uid();
    if (!a.days || Array.isArray(a.days)) a.days = {};
    if (!a.poems || Array.isArray(a.poems)) a.poems = {};
    if (!Array.isArray(a.anniversaries)) a.anniversaries = [];
    return a;
  }
  function save() { St.save('settings'); }
  function json(path) { return fetch(path).then(function (r) { if (!r.ok) throw new Error('资料暂未取到，请稍后再试。'); return r.json(); }); }
  function lunarReady() {
    if (W.Solar) return Promise.resolve();
    if (!lunarTask) lunarTask = new Promise(function (resolve, reject) {
      var script = h('script', { src: 'vendor/lunar.js?v=3.1.2' });
      script.onload = resolve;
      script.onerror = function () { lunarTask = null; script.parentNode.removeChild(script); reject(new Error('历书未能展卷，请连网后重试。')); };
      document.head.appendChild(script);
    });
    return lunarTask;
  }
  function eras() { if (!eraTask) eraTask = json('data/eras.json?v=3.1.2').catch(function (e) { eraTask = null; throw e; }); return eraTask; }
  function poemLibrary() { if (!poemTask) poemTask = json('data/poems.json?v=3.1.2').catch(function (e) { poemTask = null; throw e; }); return poemTask; }
  function trim(map, limit) { Object.keys(map).sort().slice(0, Math.max(0, Object.keys(map).length - limit)).forEach(function (k) { delete map[k]; }); }
  function solarNow() { return A.storyDate(store().clock, new Date(), W.Solar); }
  function dateLine(solar) {
    var l = solar.getLunar(), era = A.eraLabel(store().clock, solar, C.hanNum);
    return { era: era, lunar: l.getYearInGanZhi() + ' · ' + l.getYearShengXiao() + '年', day: l.getMonthInChinese() + '月' + l.getDayInChinese(), term: l.getJieQi(), lunarObject: l };
  }
  function daySnapshot() {
    var a = store(), r = St.currentRole(), date = new Date(), k = A.key(date) + '|' + r.id;
    if (!a.days[k]) {
      var cards = St.S.lib.card.items.filter(function (i) {
        if (St.S.lib.card.zhupiGroup && i.groups.indexOf(St.S.lib.card.zhupiGroup) >= 0) return false;
        return r.groups.card.indexOf('*') >= 0 || i.groups.some(function (g) { return r.groups.card.indexOf(g) >= 0; });
      });
      a.days[k] = A.daily(a.seed, r.id, date, cards); trim(a.days, 180); save();
    }
    return a.days[k];
  }
  function note(text) { return h('p', { class: 'day-note', text: text }); }
  function field(label, el) { return h('label', { class: 'day-field' }, [h('span', { text: label }), el]); }
  function button(text, fn, cls) { return h('button', { class: cls || 'link ink', type: 'button', text: text, onclick: fn }); }
  function heading(small, title) { return h('div', { class: 'day-title' }, [h('span', { text: small }), h('h2', { text: title })]); }
  function openReady(title, build) {
    var sh = U.sheet({ full: true, title: title, sub: '尺素 · 日有所记' });
    sh.body.classList.add('day-sheet'); sh.body.appendChild(note('正在展卷……'));
    lunarReady().then(function () { if (!sh.layer.parentNode) return; U.clear(sh.body); build(sh); }).catch(function (e) {
      if (!sh.layer.parentNode) return; U.clear(sh.body); sh.body.appendChild(note(e.message)); sh.body.appendChild(button('再展此卷', function () { sh.close(); openReady(title, build); }));
    });
    return sh;
  }
  function status() { return openReady('起居笺', renderStatus); }
  function renderStatus(sh) {
    var body = U.clear(sh.body), r = St.currentRole(), d = daySnapshot(), solar = solarNow(), time = dateLine(solar);
    var page = h('div', { class: 'tube-leaf status-leaf' });
    page.appendChild(h('div', { class: 'day-ribbon' }, [h('span', { text: '起居有常 · 笔墨有情' }), button('改元', function () { clockEditor(function () { renderStatus(sh); }); }, 'day-corner')]));
    page.appendChild(heading('今日 / ' + A.key(new Date()), '一日清欢'));
    page.appendChild(h('div', { class: 'day-date' }, [h('b', { text: '现在是 ' + time.era }), h('span', { text: '农历 ' + time.day + ' · ' + time.lunar + (time.term ? ' · ' + time.term : '') })]));
    page.appendChild(h('div', { class: 'day-person' }, [h('img', { src: St.avatarOf(r), alt: '' }), h('div', {}, [h('h3', { text: r.name }), h('small', { text: C.STATE_NAMES[C.roleState(r, new Date())] + ' · ' + C.shichen(new Date()) })]), h('span', { class: 'day-stamp', text: '安' })]));
    page.appendChild(h('dl', { class: 'day-facts' }, [h('div', {}, [h('dt', { text: '所在' }), h('dd', { text: d.place })]), h('div', {}, [h('dt', { text: '心境' }), h('dd', { text: d.mood })])]));
    page.appendChild(h('div', { class: 'day-excerpt' }, [h('small', { text: '今日案语 · 自墨藏撷取' }), h('p', { text: d.quote })]));
    page.appendChild(h('div', { class: 'day-skill' }, [h('span', { text: '今日笔力签' }), h('b', { text: d.skill + ' / 百' }), h('div', { class: 'day-skill-track', 'aria-label': '今日笔力签 ' + d.skill }, h('i', { style: 'width:' + d.skill + '%' }))]));
    page.appendChild(note('起居与笔力为角色日签，同一日不重抽；次日另起一笺。'));
    page.appendChild(h('div', { class: 'day-actions' }, [button('记起居', function () { editDaily(d, function () { renderStatus(sh); }); }), button('翻岁时簿', function () { sh.close(); calendar(); })]));
    body.appendChild(page);
  }
  function editDaily(d, done) {
    U.sheet({ title: '记起居', build: function (body, sh) {
      var place = h('input', { class: 'field', maxlength: '32', value: d.place }), mood = h('input', { class: 'field', maxlength: '32', value: d.mood });
      body.appendChild(field('所在', place)); body.appendChild(field('心境', mood)); body.appendChild(note('只记入今日；明日仍另起日签。'));
      body.appendChild(button('记入此笺', function () {
        if (!place.value.trim() || !mood.value.trim()) { U.toast('所在与心境尚未落笔。'); return; }
        d.place = place.value.trim(); d.mood = mood.value.trim(); save(); sh.close(); done();
      }));
    } });
  }
  function clockEditor(done) {
    var a = store(), current = a.clock, selected = null;
    var sh = U.sheet({ full: true, title: '改元', sub: '故事纪年 · 逐日续记' }); sh.body.classList.add('day-sheet');
    var body = sh.body, mode = h('select', { class: 'field', 'aria-label': '纪年方式' }, [h('option', { value: 'now', text: '随今 · 现实年月' }), h('option', { value: 'era', text: '择朝 · 历代纪年' }), h('option', { value: 'custom', text: '自题 · 别立年号' })]);
    mode.value = current ? current.mode : 'now';
    body.appendChild(field('纪年方式', mode));
    var eraPane = h('div'), customPane = h('div'), detail = h('div'), result = h('div', { class: 'era-results' }), info = note('正在取年号名录……');
    var search = h('input', { class: 'field', type: 'search', placeholder: '检索朝代、年号，如：唐、贞观、民国', 'aria-label': '检索年号' });
    var group = h('select', { class: 'field', 'aria-label': '朝代' });
    ['全部','夏','商','周','汉','魏晋','南北朝','隋','唐','五代','宋','辽','金','元','明','清','民国','日本'].forEach(function (t) { group.appendChild(h('option', { value: t, text: t })); });
    eraPane.appendChild(field('朝代', group)); eraPane.appendChild(field('检索', search)); eraPane.appendChild(info); eraPane.appendChild(result);
    var picked = h('p', { class: 'era-picked', text: current && current.mode === 'era' ? '现用：' + current.label : '请择一个年号。' }); eraPane.appendChild(picked);
    var custom = h('input', { class: 'field', maxlength: '20', placeholder: '如：长安、永宁', value: current && current.mode === 'custom' ? current.label : '' });
    var ce = h('input', { class: 'field', type: 'number', min: '-2070', max: '9999', value: current && current.mode === 'custom' ? (current.year <= 0 ? current.year - 1 : current.year) : new Date().getFullYear(), 'aria-label': '对应公元年份' });
    customPane.appendChild(field('自题纪年', custom)); customPane.appendChild(field('对应公元年份', ce)); customPane.appendChild(note('公元前年份前加负号，如前1046年填 -1046；不设公元零年。'));
    var yr = h('input', { class: 'field', type: 'number', min: '1', max: '9999', value: current ? current.yearNumber : 1, 'aria-label': '纪年第几年' });
    var month = h('input', { class: 'field', type: 'number', min: '1', max: '12', value: current ? current.month : new Date().getMonth() + 1, 'aria-label': '起始公历月' });
    var day = h('input', { class: 'field', type: 'number', min: '1', max: '31', value: current ? current.day : new Date().getDate(), 'aria-label': '起始公历日' });
    detail.appendChild(field('纪年第几年', yr)); detail.appendChild(h('div', { class: 'day-two-fields' }, [field('起始公历月', month), field('起始公历日', day)]));
    detail.appendChild(note('以今日为起点，此后每日走一日。年号用于故事，农历按算法回推；夏商周为约年王年，非正式年号。'));
    body.appendChild(eraPane); body.appendChild(customPane); body.appendChild(detail);
    function modePaint() { eraPane.hidden = mode.value !== 'era'; customPane.hidden = mode.value !== 'custom'; detail.hidden = mode.value === 'now'; }
    mode.addEventListener('change', modePaint); modePaint();
    var all = [], offset = 0;
    function matching(e) {
      var g = group.value, family = e.dynasty;
      var inGroup = g === '全部' || (g === '魏晋' ? /魏|晋/.test(family) : g === '南北朝' ? /齐|梁|陈|刘宋|北周/.test(family) : g === '五代' ? /后唐|后梁|后晋|后汉|后周/.test(family) : family.indexOf(g) >= 0);
      return inGroup && (!search.value.trim() || (e.name + ' ' + family + ' ' + e.start).indexOf(search.value.trim()) >= 0);
    }
    function renderList() {
      U.clear(result); var found = all.filter(matching); info.textContent = '共 ' + found.length + ' 项 · 每次展八项，可检索缩小范围';
      found.slice(offset, offset + 8).forEach(function (e) {
        result.appendChild(button(e.dynasty + ' · ' + e.name + '（' + (e.start <= 0 ? '前' + (1 - e.start) : e.start) + '年起）', function () { selected = e; yr.value = 1; picked.textContent = '已择：' + e.dynasty + ' · ' + e.name + (e.approx ? '（约年王年）' : ''); }, 'era-option'));
      });
      if (!found.length) result.appendChild(note('此名未收入，可用「自题」另立纪年。'));
      var nav = h('div', { class: 'day-actions' });
      if (offset) nav.appendChild(button('前八项', function () { offset = Math.max(0, offset - 8); renderList(); }));
      if (offset + 8 < found.length) nav.appendChild(button('后八项', function () { offset += 8; renderList(); }));
      result.appendChild(nav);
    }
    search.addEventListener('input', function () { offset = 0; renderList(); }); group.addEventListener('change', function () { offset = 0; renderList(); });
    eras().then(function (data) { all = data; if (current) selected = all.filter(function (e) { return e.id === current.eraId; })[0] || null; renderList(); }).catch(function (e) { info.textContent = e.message + ' 仍可自题纪年。'; });
    body.appendChild(button('定此纪年', function () {
      if (mode.value === 'now') { a.clock = null; save(); sh.close(); done(); return; }
      var n = Number(yr.value), m = Number(month.value), d = Number(day.value);
      if (!Number.isInteger(n) || n < 1 || n > 9999 || !Number.isInteger(m) || !Number.isInteger(d)) { U.toast('请填完整的年、月、日。'); return; }
      if (mode.value === 'era' && !selected) { U.toast('先择一个年号。'); return; }
      var label = mode.value === 'era' ? selected.name.replace('·王年', '') : custom.value.trim();
      var rawYear = Number(ce.value);
      if (mode.value === 'custom' && (!ce.value.trim() || rawYear === 0)) { U.toast('请填对应公元年份，不设公元零年。'); return; }
      var y = mode.value === 'era' ? selected.start + n - 1 : (rawYear < 0 ? rawYear + 1 : rawYear);
      if (!label || !Number.isInteger(y) || y < -2069 || y > 9999 || m < 1 || m > 12 || d < 1 || d > A.lastDay(y, m, W.SolarUtil) || (y === 1582 && m === 10 && d > 4 && d < 15)) { U.toast('日期或纪年尚不合式，请核对。'); return; }
      if (mode.value === 'era' && y > selected.end) { U.toast('所填年份已超出这一年号，可改用「自题」续写。'); return; }
      a.clock = { mode: mode.value, eraId: selected && selected.id, label: label, yearNumber: n, year: y, month: m, day: d, anchorDay: A.realDay(new Date()) };
      save(); sh.close(); done();
    }));
  }
  function calendar() {
    return openReady('岁时簿', function (sh) {
      var today = solarNow(), selected = today, year = today.getYear(), month = today.getMonth();
      function render() {
        var body = U.clear(sh.body), a = store(), page = h('div', { class: 'tube-leaf calendar-leaf' });
        page.appendChild(h('div', { class: 'day-ribbon' }, [h('span', { text: '岁时有序 · 相逢有期' }), button('改元', function () { clockEditor(function () { today = solarNow(); selected = today; year = today.getYear(); month = today.getMonth(); render(); }); }, 'day-corner')]));
        var poem = h('div', { class: 'calendar-poem calendar-heading', 'aria-live': 'polite' });
        poem.appendChild(h('small', { text: A.eraLabel(a.clock, today, C.hanNum) }));
        poem.appendChild(note('正在启诗卷……'));
        page.appendChild(poem);
        var nav = h('div', { class: 'calendar-nav' }, [button('前月', function () { step(-1); }), h('b', { text: (year <= 0 ? '前' + (1 - year) : year) + ' · ' + C.hanNum(month) + '月' }), button('后月', function () { step(1); })]); page.appendChild(nav);
        var grid = h('div', { class: 'calendar-grid', role: 'group', 'aria-label': '月历' });
        ['日','一','二','三','四','五','六'].forEach(function (w) { grid.appendChild(h('span', { class: 'cal-week', text: w })); });
        var first = W.Solar.fromYmd(year, month, 1).getWeek(), days = A.lastDay(year, month, W.SolarUtil);
        for (var blank = 0; blank < first; blank++) grid.appendChild(h('span', { 'aria-hidden': 'true' }));
        for (var d = 1; d <= days; d++) {
          if (year === 1582 && month === 10 && d > 4 && d < 15) continue;
          (function (day) {
            var sol = W.Solar.fromYmd(year, month, day), l = sol.getLunar(), events = a.anniversaries.filter(function (e) { return A.onDate(e, sol, l); });
            var active = selected.getYear() === year && selected.getMonth() === month && selected.getDay() === day;
            var now = today.getYear() === year && today.getMonth() === month && today.getDay() === day;
            var cell = button('', function () { selected = sol; render(); }, 'cal-day' + (active ? ' selected' : '') + (now ? ' today' : '') + (events.length ? ' marked' : ''));
            cell.setAttribute('aria-label', month + '月' + day + '日' + (events.length ? '，有纪念日' : '')); cell.setAttribute('aria-pressed', active ? 'true' : 'false');
            cell.appendChild(h('b', { text: String(day) })); cell.appendChild(h('small', { text: l.getJieQi() || (l.getDay() === 1 ? l.getMonthInChinese() + '月' : l.getDayInChinese()) })); grid.appendChild(cell);
          })(d);
        }
        page.appendChild(grid);
        var l = selected.getLunar();
        page.appendChild(h('div', { class: 'day-selected' }, [h('b', { text: selected.getMonth() + '月' + selected.getDay() + '日 · 农历' + l.getMonthInChinese() + '月' + l.getDayInChinese() }), button('记一日', function () { editAnniversary(selected, function () { render(); }); })]));
        var events = a.anniversaries.filter(function (e) { return A.onDate(e, selected, l); });
        if (!events.length) page.appendChild(note('此日尚无纪念，留一笔，来年再逢。'));
        events.forEach(function (e) {
          var n = (e.calendar === 'lunar' ? l.getYear() : selected.getYear()) - e.year;
          page.appendChild(h('article', { class: 'anniversary-item' }, [h('div', {}, [h('h3', { text: e.name }), h('small', { text: (e.calendar === 'lunar' ? '农历' : '公历') + ' · ' + (n ? '已过' + C.hanNum(n) + '载' : '初记此日') + (e.repeat ? ' · 岁岁相逢' : '') })]), button('修改', function () { editAnniversary(selected, render, e); })]));
        });
        var poemDate = new Date(), poemKey = A.key(poemDate);
        function paintPoem(p) { U.clear(poem); poem.appendChild(h('small', { text: A.eraLabel(a.clock, today, C.hanNum) + ' · 今日摘句' })); poem.appendChild(h('p', { text: p[0] })); poem.appendChild(h('cite', { text: p[1] + '《' + p[2] + '》' })); }
        if (a.poems[poemKey]) paintPoem(a.poems[poemKey]);
        else poemLibrary().then(function (rows) {
          if (!a.poems[poemKey]) { a.poems[poemKey] = rows[A.index(a.seed + 'poem', A.realDay(poemDate), rows.length)]; trim(a.poems, 90); save(); }
          if (page.parentNode) paintPoem(a.poems[poemKey]);
        }).catch(function () { U.clear(poem); poem.appendChild(note('诗卷暂未取到，连网后可再展。已有日签与纪念日仍可离线查看。')); poem.appendChild(button('重取诗卷', render)); });
        page.appendChild(h('div', { class: 'day-actions' }, [button('回今日', function () { today = solarNow(); selected = today; year = today.getYear(); month = today.getMonth(); render(); }), button('纪念小录', function () { listAnniversaries(render); })]));
        body.appendChild(page);
      }
      function step(n) { var nextMonth = month + n, nextYear = year; if (nextMonth < 1) { nextMonth = 12; nextYear--; } if (nextMonth > 12) { nextMonth = 1; nextYear++; } if (nextYear < -2069 || nextYear > 9999) { U.toast('此处历书已至边界。'); return; } month = nextMonth; year = nextYear; selected = W.Solar.fromYmd(year, month, 1); render(); }
      render();
    });
  }
  function editAnniversary(solar, done, existing) {
    var l = solar.getLunar(), a = store(), sh = U.sheet({ full: true, title: existing ? '重题纪念' : '记一日' }); sh.body.classList.add('day-sheet');
    var body = sh.body, name = h('input', { class: 'field', maxlength: '40', value: existing ? existing.name : '', placeholder: '如：初逢、结契、故人生辰' });
    var kind = h('select', { class: 'field', 'aria-label': '纪念历法' }, [h('option', { value: 'lunar', text: '农历 · 依月相候' }), h('option', { value: 'solar', text: '公历 · 按日相逢' })]); kind.value = existing ? existing.calendar : 'lunar';
    var yr = h('input', { class: 'field', type: 'number', min: '-2069', max: '9999', value: existing ? existing.year : l.getYear() });
    var mo = h('input', { class: 'field', type: 'number', min: '1', max: '12', value: existing ? existing.month : Math.abs(l.getMonth()) });
    var day = h('input', { class: 'field', type: 'number', min: '1', max: '31', value: existing ? existing.day : l.getDay() });
    var leap = h('input', { type: 'checkbox', checked: existing ? existing.leap : l.getMonth() < 0 }), repeat = h('input', { type: 'checkbox', checked: existing ? existing.repeat : true });
    body.appendChild(field('所记之事', name)); body.appendChild(field('纪念历法', kind)); body.appendChild(field('起记年份', yr)); body.appendChild(h('div', { class: 'day-two-fields' }, [field('月', mo), field('日', day)]));
    var leapRow = h('label', { class: 'day-check' }, [leap, '闰月之日']); body.appendChild(leapRow); body.appendChild(h('label', { class: 'day-check' }, [repeat, '岁岁相逢（每年重复）']));
    body.appendChild(note('纪念日按岁时簿中的年月记。农历闰月仅在相应闰月相逢；平年无此日便不挪动。'));
    function sync() { var lunar = kind.value === 'lunar'; leapRow.hidden = !lunar; if (!existing) { yr.value = lunar ? l.getYear() : solar.getYear(); mo.value = lunar ? Math.abs(l.getMonth()) : solar.getMonth(); day.value = lunar ? l.getDay() : solar.getDay(); } }
    kind.addEventListener('change', sync); sync();
    body.appendChild(button('收入岁时簿', function () {
      var y = Number(yr.value), m = Number(mo.value), d = Number(day.value), isLunar = kind.value === 'lunar';
      if (!name.value.trim() || !Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < -2069 || y > 9999 || m < 1 || m > 12 || d < 1 || d > (isLunar ? 30 : A.lastDay(y, m, W.SolarUtil)) || (!isLunar && y === 1582 && m === 10 && d > 4 && d < 15)) { U.toast('请核对所记之事与日期。'); return; }
      try { if (isLunar) W.Lunar.fromYmd(y, leap.checked ? -m : m, d); } catch (e) { U.toast('这一年没有此农历日期，请核对闰月与大小月。'); return; }
      var item = { id: existing ? existing.id : C.uid(), name: name.value.trim(), calendar: kind.value, year: y, month: m, day: d, repeat: repeat.checked, leap: isLunar && leap.checked };
      if (existing) a.anniversaries = a.anniversaries.map(function (e) { return e.id === existing.id ? item : e; }); else a.anniversaries.push(item);
      save(); sh.close(); done(); U.toast('此日已记，来年可候。');
    }));
    if (existing) body.appendChild(button('撤去此记', function () { U.confirmSheet('撤去「' + existing.name + '」这笔纪念？', '撤去', function () { a.anniversaries = a.anniversaries.filter(function (e) { return e.id !== existing.id; }); save(); sh.close(); done(); }); }, 'link red'));
  }
  function listAnniversaries(done) {
    var sh = U.sheet({ full: true, title: '纪念小录' }); sh.body.classList.add('day-sheet');
    function renderList() {
      var body = U.clear(sh.body), all = store().anniversaries;
      if (!all.length) body.appendChild(note('尚无所记。可在月历择日，记下值得岁岁相候的事。'));
      all.slice().sort(function (a, b) { return a.month - b.month || a.day - b.day; }).forEach(function (e) {
        body.appendChild(h('article', { class: 'anniversary-item' }, [h('div', {}, [h('h3', { text: e.name }), h('small', { text: (e.calendar === 'lunar' ? '农历' : '公历') + (e.leap ? '闰' : '') + e.month + '月' + e.day + '日' })]), button('修改', function () { editAnniversary(solarNow(), function () { renderList(); done(); }, e); })]));
      });
    }
    renderList();
  }
  function decorateDesk() {
    var home = U.$('#home'); if (!home || U.$('.desk-additions', home)) return;
    var bar = h('nav', { class: 'desk-additions', 'aria-label': '起居与岁时' }, [button('起居', status), button('岁时', calendar)]); home.appendChild(bar);
  }
  function init() {
    decorateDesk();
    var head = U.$('#chat .folio-head'), call = U.$('#call-btn');
    head.insertBefore(button('起居', status, 'day-chat-button'), call);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) decorateDesk(); });
  }
  W.ChisuAlmanac = { init: init, decorateDesk: decorateDesk, status: status, calendar: calendar, daySnapshot: daySnapshot };
})(window);
