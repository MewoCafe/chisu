/* 尺素 · 纯逻辑（无 DOM）。浏览器挂到 window.ChisuCore，node 测试用 require。
   兼容约定：本目录所有脚本只用 ES2017 语法，不用 ?. ?? .at() replaceAll 等。 */
(function (root) {
  'use strict';

  var LIBS = ['card', 'kao', 'img', 'stk'];
  var LIB_NAMES = { card: '字笺', kao: '颜', img: '画', stk: '印' };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  /* 区间：{min,max}，非法时修正为合法值而不是抛错，避免设置界面卡死。 */
  function normRange(r, lo, hi, def, integer) {
    r = r || {};
    var a = clampNum(r.min, lo, hi, def.min);
    var b = clampNum(r.max, lo, hi, def.max);
    if (integer) { a = Math.round(a); b = Math.round(b); }
    if (b < a) { var t = a; a = b; b = t; }
    return { min: a, max: b };
  }

  function randBetween(r, random, integer) {
    random = random || Math.random;
    var x = Math.min(0.999999, Math.max(0, Number(random()) || 0));
    if (integer) return r.min + Math.floor(x * (r.max - r.min + 1));
    return r.min + x * (r.max - r.min);
  }

  function pick(list, random) {
    if (!list || !list.length) return null;
    random = random || Math.random;
    var x = Math.min(0.999999, Math.max(0, Number(random()) || 0));
    return list[Math.floor(x * list.length)];
  }

  /* 角色可抽取的条目：role.groups[lib] 为 ['*'] 表示全部；空数组表示此库不用。 */
  function rolePool(role, lib) {
    var out = [];
    LIBS.forEach(function (key) {
      var chosen = (role.groups && role.groups[key]) || [];
      if (!chosen.length) return;
      var all = chosen.indexOf('*') >= 0;
      lib[key].items.forEach(function (item) {
        // 批语只给朱批用，除非角色明确勾选了批语组
        if (key === 'card' && lib.card.zhupiGroup && item.groups.indexOf(lib.card.zhupiGroup) >= 0 && chosen.indexOf(lib.card.zhupiGroup) < 0) return;
        if (all || item.groups.some(function (g) { return chosen.indexOf(g) >= 0; })) {
          out.push({ lib: key, item: item });
        }
      });
    });
    return out;
  }

  /* 按库加权：先按角色的体例比重选库，再在库内均匀抽，避免字笺多时图永远抽不到。 */
  function drawReply(role, lib, random) {
    random = random || Math.random;
    var pool = rolePool(role, lib);
    if (!pool.length) return null;
    var byLib = {};
    pool.forEach(function (p) { (byLib[p.lib] = byLib[p.lib] || []).push(p); });
    var weights = role.mix || { card: 70, kao: 12, img: 6, stk: 12 };
    var keys = Object.keys(byLib);
    var total = 0;
    keys.forEach(function (k) { total += Math.max(0, Number(weights[k]) || 0); });
    if (total <= 0) return pick(pool, random);
    var x = (Number(random()) || 0) * total;
    for (var i = 0; i < keys.length; i++) {
      x -= Math.max(0, Number(weights[keys[i]]) || 0);
      if (x < 0) return pick(byLib[keys[i]], random);
    }
    return pick(byLib[keys[keys.length - 1]], random);
  }

  /* 十二时辰：23 点起为子初。 */
  var BRANCH = '子丑寅卯辰巳午未申酉戌亥';
  function shichen(date) {
    var h = date.getHours();
    var idx = Math.floor(((h + 1) % 24) / 2);
    var zheng = (h % 2) === 0;
    return BRANCH.charAt(idx) + (zheng ? '正' : '初');
  }

  var DIGITS = '〇一二三四五六七八九';
  function hanNum(n) {
    n = Math.floor(n);
    if (n < 0) return String(n);
    if (n < 10) return DIGITS.charAt(n);
    if (n < 20) return '十' + (n % 10 ? DIGITS.charAt(n % 10) : '');
    if (n < 100) return DIGITS.charAt(Math.floor(n / 10)) + '十' + (n % 10 ? DIGITS.charAt(n % 10) : '');
    return String(n).split('').map(function (d) { return DIGITS.charAt(+d); }).join('');
  }
  var UPPER = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
  function upperNum(n) {
    if (n <= 10) return UPPER[n];
    if (n < 20) return '拾' + UPPER[n - 10];
    return hanNum(n);
  }

  function durationText(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m ? hanNum(m) + '分' : '') + hanNum(s) + '秒';
  }

  /* 角色作息：sleep.from / sleep.to 为小时；travel 为远行。 */
  function roleState(role, date) {
    if (role.travel) return 'travel';
    var s = role.sleep || { from: 23, to: 7, on: true };
    if (!s.on) return 'awake';
    var h = date.getHours();
    var asleep = s.from <= s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to);
    return asleep ? 'rest' : 'awake';
  }
  var STATE_NAMES = { awake: '秉烛', rest: '小憩', travel: '远行' };

  /* 字素切分：不依赖 Intl.Segmenter 与 \p{} 正则（旧内核会语法错误）。 */
  var EXTEND = /[̀-ͯ᪰-᫿⃐-⃿︀-️゙゚]/;
  function graphemes(text) {
    var pts = Array.from(String(text == null ? '' : text));
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var g = pts[i];
      while (i + 1 < pts.length) {
        var nx = pts[i + 1];
        var code = nx.codePointAt(0);
        if (EXTEND.test(nx) || (code >= 0x1f3fb && code <= 0x1f3ff) || (code >= 0xe0100 && code <= 0xe01ef)) { g += nx; i++; }
        else if (nx === '‍' && i + 2 < pts.length) { g += nx + pts[i + 2]; i += 2; }
        else break;
      }
      out.push(g);
    }
    return out;
  }

  /* 朱批可落在句中任一汉字处，圈点不越过标点或换行。 */
  function pickQuan(text, random) {
    random = random || Math.random;
    var s = String(text || ''), starts = [], re = /[一-鿿]+/g, m;
    while ((m = re.exec(s))) {
      for (var i = 0; i < m[0].length; i++) starts.push({ start: m.index + i, remaining: m[0].length - i });
    }
    if (!starts.length) return null;
    var r = Math.max(0, Math.min(.999999, Number(random()) || 0));
    var at = starts[Math.floor(r * starts.length)];
    var len = 1 + Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * Math.min(3, at.remaining));
    return { start: at.start, length: len };
  }

  function normalizeText(t) {
    return String(t == null ? '' : t).replace(/\r\n?/g, '\n').trim();
  }

  /* 有空间时把朱批原句与紧随的回笔排在同一叶，避免批语被自动翻走。 */
  function chatPages(messages, heights, available) {
    var pages = [], current = [], used = 0;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i], reserve = heights[i];
      if (m.from === 'me' && m.zhupi && messages[i + 1] && messages[i + 1].from === 'peer') {
        var pair = heights[i] + heights[i + 1], together = heights[i];
        for (var j = i + 1; j < messages.length && messages[j].from === 'peer'; j++) together += heights[j];
        reserve = together <= available ? together : (pair <= available ? pair : heights[i]);
      }
      if (current.length && used + reserve > available) { pages.push(current); current = []; used = 0; }
      current.push(i); used += heights[i];
    }
    if (current.length || !pages.length) pages.push(current);
    return pages;
  }

  /* 同句保留最早编号，并合并所属组；只归一首尾空白和换行。 */
  function dedupeCards(card) {
    var seen = Object.create(null), removed = 0;
    card.items = card.items.filter(function (item) {
      var text = normalizeText(item.text);
      item.text = text;
      var first = seen[text];
      if (!first) { seen[text] = item; return true; }
      (item.groups || []).forEach(function (g) {
        if (first.groups.indexOf(g) < 0) first.groups.push(g);
      });
      removed++;
      return false;
    });
    return removed;
  }

  /* 字卡文件兼容：尺素 items/cards、回复 customReplies 与分组 replies。 */
  function parseTextImport(data, fallbackName) {
    var entries = [], seen = Object.create(null), duplicates = 0, recognized = false;
    var fallback = normalizeText(fallbackName) || '收入';
    function readText(x) { return typeof x === 'string' ? normalizeText(x) : (x && typeof x.text === 'string' ? normalizeText(x.text) : ''); }
    function add(values, name, mirror) {
      if (!Array.isArray(values)) return;
      recognized = true;
      values.forEach(function (x) {
        var text = readText(x); if (!text) return;
        var names = name ? [name] : (x && Array.isArray(x.groups) ? x.groups.filter(function (g) { return typeof g === 'string' && g.trim(); }).map(normalizeText) : []);
        if (!names.length) names = [fallback];
        var entry = seen[text];
        if (entry) {
          if (mirror) return; // customReplies 是分组内容的平铺镜像，不能算两遍
          duplicates++;
          names.forEach(function (n) { if (entry.groups.indexOf(n) < 0) entry.groups.push(n); });
        } else {
          entry = { text: text, groups: names }; seen[text] = entry; entries.push(entry);
        }
      });
    }
    if (Array.isArray(data)) add(data);
    else if (data && typeof data === 'object') {
      var name = typeof data.replyGroupName === 'string' ? normalizeText(data.replyGroupName) : fallback;
      var grouping = data.cardGrouping && data.cardGrouping.groups;
      var hasGroups = false;
      if (Array.isArray(grouping)) grouping.forEach(function (g) {
        if (!g || !Array.isArray(g.replies)) return;
        hasGroups = true;
        add(g.replies, typeof g.name === 'string' && g.name.trim() ? g.name.trim() : name);
      });
      if (Array.isArray(data.customReplies)) add(data.customReplies, name, hasGroups);
      else if (Array.isArray(data.items)) add(data.items);
      else if (Array.isArray(data.cards)) add(data.cards);
      else if (Array.isArray(data.replies)) add(data.replies, name);
    }
    if (!recognized) throw new Error('未识别字卡格式：请使用 items、cards、customReplies 或分组 replies。');
    if (!entries.length) throw new Error('文件中没有可收入的文字字卡，未建立空分组。');
    return { entries: entries, duplicates: duplicates };
  }

  function parseLines(text) {
    var seen = Object.create(null), lines = [], dup = 0;
    String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (seen[line]) { dup++; return; }
      seen[line] = 1; lines.push(line);
    });
    return { lines: lines, duplicates: dup };
  }

  var api = {
    LIBS: LIBS, LIB_NAMES: LIB_NAMES, STATE_NAMES: STATE_NAMES,
    uid: uid, clampNum: clampNum, normRange: normRange, randBetween: randBetween, pick: pick,
    rolePool: rolePool, drawReply: drawReply, chatPages: chatPages, shichen: shichen, hanNum: hanNum, upperNum: upperNum,
    durationText: durationText, roleState: roleState, graphemes: graphemes, pickQuan: pickQuan,
    normalizeText: normalizeText, dedupeCards: dedupeCards, parseTextImport: parseTextImport, parseLines: parseLines
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChisuCore = api;
})(typeof window !== 'undefined' ? window : this);
