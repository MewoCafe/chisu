/* 尺素 · 数据：默认内容、读取、迁移旧版、保存。 */
(function (W) {
  'use strict';
  var C = W.ChisuCore, U = W.ChisuUtil;

  var DEFAULT_CARDS = {
    '寻常': ['见字如晤。', '展信佳。', '我在。', '嗯，知道了。', '好。', '你呀。', '今日檐下落雨，想起你。',
      '茶已温好，等你来。', '此事不急，慢慢说与我听。', '你说的，我都记着。', '今晨有雾，庭中荷开了一半。',
      '明日若晴，同去看荷。', '山中无事，唯念君安。', '方才研墨，墨香还未散。'],
    '关怀': ['夜深了，早些歇息。', '可曾用过饭了？', '且宽心，万事有我。', '莫要忧心。', '天凉，添件衣裳。', '见你来信，甚喜。'],
    '批语': ['此句甚好。', '妙。', '可再斟酌。', '见之一笑。', '记下了。', '这一句，我读了三遍。']
  };
  var DEFAULT_KAO = ['(｡･ω･｡)', '(´｡• ᵕ •｡`)', '( ˘ ³˘)', '(＾▽＾)', '(・_・;)', 'ヾ(•ω•`)o', '(￣▽￣)', '(´-ω-`)', '(*´▽`*)', '(｀・ω・´)'];

  var S = {
    settings: null, roles: null, lib: null, messages: null, letters: null, pending: null, ready: false
  };

  function defaultSettings() {
    return {
      selfName: '我', selfAvatar: '', currentRole: '', introSeen: false,
      wakeLock: false, silentAudio: false, notify: false, floatNote: true,
      lite: null, reduced: false, tts: false, bookStyle: 'simple', bookStyleChosen: false, ver: 3
    };
  }

  function emptyLib() {
    var lib = {};
    C.LIBS.forEach(function (k) { lib[k] = { groups: [], items: [], next: 1 }; });
    lib.card.zhupiGroup = '';
    return lib;
  }
  function addGroup(lib, key, name) {
    var g = { id: 'g' + C.uid(), name: name };
    lib[key].groups.push(g);
    return g;
  }
  function addItem(lib, key, data, groups) {
    if (key === 'card') {
      data.text = C.normalizeText(data.text);
      var existing = lib.card.items.filter(function (i) { return C.normalizeText(i.text) === data.text; })[0];
      if (existing) {
        (groups || []).forEach(function (g) { if (existing.groups.indexOf(g) < 0) existing.groups.push(g); });
        return existing;
      }
    }
    var item = { id: 'i' + C.uid(), n: lib[key].next++, groups: groups || [] };
    Object.keys(data).forEach(function (k) { item[k] = data[k]; });
    lib[key].items.push(item);
    return item;
  }

  function defaultLib() {
    var lib = emptyLib();
    Object.keys(DEFAULT_CARDS).forEach(function (name) {
      var g = addGroup(lib, 'card', name);
      if (name === '批语') lib.card.zhupiGroup = g.id;
      DEFAULT_CARDS[name].forEach(function (t) { addItem(lib, 'card', { text: t }, [g.id]); });
    });
    var kg = addGroup(lib, 'kao', '欢喜');
    DEFAULT_KAO.forEach(function (t) { addItem(lib, 'kao', { text: t }, [kg.id]); });
    addGroup(lib, 'img', '景');
    addGroup(lib, 'stk', '常用');
    return lib;
  }

  function newRole(name) {
    return {
      id: 'r' + C.uid(), name: name || '君', avatar: '', callMe: '',
      groups: { card: ['*'], kao: ['*'], img: ['*'], stk: ['*'] },
      mix: { card: 70, kao: 12, img: 6, stk: 12 },
      wait: { min: 2, max: 8 }, count: { min: 1, max: 3 },
      letterWait: { min: 1, max: 5 },
      zhupi: 12, callChance: 0, sleep: { on: true, from: 23, to: 7 }, travel: false
    };
  }

  function normRole(r) {
    var d = newRole(r.name);
    Object.keys(d).forEach(function (k) { if (r[k] === undefined) r[k] = d[k]; });
    C.LIBS.forEach(function (k) { if (!Array.isArray(r.groups[k])) r.groups[k] = ['*']; });
    r.wait = C.normRange(r.wait, 0, 86400, d.wait, false);
    r.count = C.normRange(r.count, 1, 30, d.count, true);
    r.letterWait = C.normRange(r.letterWait, 0, 1440, d.letterWait, false);
    r.zhupi = C.clampNum(r.zhupi, 0, 100, 12);
    r.callChance = C.clampNum(r.callChance, 0, 100, 0);
    return r;
  }

  /* 旧版（chisu-v2-*，localStorage）一次性迁入。 */
  function migrateV2() {
    var ls = W.localStorage, key = 'chisu-v2-';
    function rd(k) { try { var v = ls.getItem(key + k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }
    var cards = rd('cards');
    if (!Array.isArray(cards)) return null;
    var profile = rd('profile') || {};
    var out = { lib: defaultLib(), roles: [], settings: defaultSettings(), messages: {}, letters: {} };
    var g = addGroup(out.lib, 'card', '旧藏');
    var have = {};
    out.lib.card.items.forEach(function (i) { have[i.text] = 1; });
    cards.forEach(function (c) { var t = c && C.normalizeText(c.text); if (t && !have[t]) { have[t] = 1; addItem(out.lib, 'card', { text: t }, [g.id]); } });
    var role = newRole(String(profile.peer || '君'));
    var rp = rd('reply-settings');
    if (rp) { role.wait = { min: +rp.min || 1, max: +rp.max || 5 }; role.count = { min: +rp.count || 1, max: +rp.count || 1 }; }
    var ap = rd('avatar-peer'); if (ap && /^data:/.test(ap)) role.avatar = ap;
    var as = rd('avatar-self'); if (as && /^data:/.test(as)) out.settings.selfAvatar = as;
    out.settings.selfName = String(profile.self || '我');
    out.roles.push(role);
    out.settings.currentRole = role.id;
    var msgs = rd('messages');
    out.messages[role.id] = Array.isArray(msgs) ? msgs.map(function (m) {
      return { id: m.id || C.uid(), from: m.role === 'me' ? 'me' : 'peer', kind: 'text', text: String(m.text || ''), at: m.createdAt || Date.now() };
    }) : [];
    var letters = rd('letters');
    out.letters[role.id] = Array.isArray(letters) ? letters.map(function (l) {
      return { id: l.id || C.uid(), from: l.from === 'me' ? 'me' : 'peer', text: String(l.text || ''), at: l.at || Date.now(), kept: !!l.saved };
    }) : [];
    out.settings.introSeen = true;
    return out;
  }

  function load() {
    return Promise.all(['settings', 'roles', 'lib', 'messages', 'letters', 'pending'].map(U.get)).then(function (v) {
      var fresh = !v[0];
      var mig = fresh ? migrateV2() : null;
      S.settings = Object.assign(defaultSettings(), v[0] || (mig && mig.settings) || {});
      if (!S.settings.bookStyleChosen) S.settings.bookStyle = 'simple';
      S.lib = v[2] || (mig && mig.lib) || defaultLib();
      C.LIBS.forEach(function (k) { if (!S.lib[k]) S.lib[k] = { groups: [], items: [], next: 1 }; });
      var duplicates = C.dedupeCards(S.lib.card);
      S.roles = (v[1] || (mig && mig.roles) || []).map(normRole);
      if (!S.roles.length) {
        var r = newRole('君');
        S.roles.push(r);
        // 默认角色：字笺只用寻常与关怀，避免批语混入
        var ids = S.lib.card.groups.filter(function (g) { return g.name !== '批语'; }).map(function (g) { return g.id; });
        if (ids.length) r.groups.card = ids;
      }
      S.messages = v[3] || (mig && mig.messages) || {};
      S.letters = v[4] || (mig && mig.letters) || {};
      S.pending = Array.isArray(v[5]) ? v[5] : [];
      if (!roleById(S.settings.currentRole)) S.settings.currentRole = S.roles[0].id;
      S.roles.forEach(function (r) {
        if (!S.messages[r.id]) S.messages[r.id] = [];
        if (!S.letters[r.id]) S.letters[r.id] = [{ id: C.uid(), from: 'peer', text: '近来可好？\n\n庭中荷花开了，若得闲，便来坐坐。', at: Date.now(), kept: false }];
      });
      if (S.settings.lite === null) {
        var mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
        S.settings.lite = !!((mem && mem <= 2) || (cores && cores <= 4));
      }
      S.ready = true;
      if (fresh) saveAll();
      else if (duplicates) save('lib');
      return S;
    });
  }

  var getters = {
    settings: function () { return S.settings; }, roles: function () { return S.roles; }, lib: function () { return S.lib; },
    messages: function () { return S.messages; }, letters: function () { return S.letters; }, pending: function () { return S.pending; }
  };
  function save(key) { U.saveLater(key, getters[key]); }
  function saveAll() { Object.keys(getters).forEach(save); }
  function flush() { U.flushAll(getters); }

  function roleById(id) {
    for (var i = 0; i < (S.roles || []).length; i++) if (S.roles[i].id === id) return S.roles[i];
    return null;
  }
  function currentRole() { return roleById(S.settings.currentRole) || S.roles[0]; }
  function avatarOf(role) { return role.avatar || U.monogram(role.name); }
  function selfAvatar() { return S.settings.selfAvatar || U.monogram(S.settings.selfName || '我', true); }

  function exportAll() {
    return JSON.stringify({ app: 'chisu', ver: 3, at: Date.now(), settings: S.settings, roles: S.roles, lib: S.lib, messages: S.messages, letters: S.letters }, null, 1);
  }
  function importTextData(key, data, fallbackName) {
    var parsed = C.parseTextImport(data, fallbackName), library = S.lib[key];
    var groupIds = Object.create(null), have = Object.create(null), added = 0, skipped = parsed.duplicates;
    library.groups.forEach(function (g) { if (!groupIds[g.name]) groupIds[g.name] = g.id; });
    library.items.forEach(function (item) { have[C.normalizeText(item.text)] = item; });
    var firstGroup = '';
    parsed.entries.forEach(function (entry) {
      var ids = entry.groups.map(function (name) {
        if (!groupIds[name]) groupIds[name] = addGroup(S.lib, key, name).id;
        if (!firstGroup) firstGroup = groupIds[name];
        return groupIds[name];
      });
      var existing = have[entry.text];
      if (existing) {
        ids.forEach(function (id) { if (existing.groups.indexOf(id) < 0) existing.groups.push(id); });
        skipped++;
      } else { have[entry.text] = addItem(S.lib, key, { text: entry.text }, ids); added++; }
    });
    save('lib');
    return { added: added, skipped: skipped, total: parsed.entries.length, groupId: firstGroup };
  }

  function importAll(text) {
    var d = JSON.parse(text);
    if (d && (Array.isArray(d.cards) || Array.isArray(d.customReplies) || Array.isArray(d.replies) || d.cardGrouping)) {
      var result = importTextData('card', d, '收入');
      return '已收入字卡 ' + result.added + ' 张，略去重复 ' + result.skipped + ' 张。';
    }
    if (!d || d.app !== 'chisu') throw new Error('此卷不是尺素卷宗。');
    S.settings = Object.assign(defaultSettings(), d.settings || {});
    if (!S.settings.bookStyleChosen) S.settings.bookStyle = 'simple';
    S.roles = (d.roles || []).map(normRole);
    S.lib = d.lib || defaultLib();
    C.dedupeCards(S.lib.card);
    S.messages = d.messages || {}; S.letters = d.letters || {}; S.pending = [];
    if (!S.roles.length) S.roles.push(newRole('君'));
    S.roles.forEach(function (r) { if (!S.messages[r.id]) S.messages[r.id] = []; if (!S.letters[r.id]) S.letters[r.id] = []; });
    if (!roleById(S.settings.currentRole)) S.settings.currentRole = S.roles[0].id;
    saveAll();
    return '卷宗已收入。';
  }

  W.ChisuState = {
    S: S, load: load, save: save, saveAll: saveAll, flush: flush,
    newRole: newRole, normRole: normRole, roleById: roleById, currentRole: currentRole,
    avatarOf: avatarOf, selfAvatar: selfAvatar, addGroup: addGroup, addItem: addItem,
    exportAll: exportAll, importAll: importAll, importTextData: importTextData
  };
})(window);
