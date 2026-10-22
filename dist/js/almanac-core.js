/* 尺素 · 日签、纪年与纪念日的纯计算。 */
(function (W) {
  'use strict';
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function serial(y, m, d) { var t = new Date(0); t.setUTCFullYear(y, m - 1, d); t.setUTCHours(0, 0, 0, 0); return Math.floor(t.getTime() / 86400000); }
  function realDay(d) { return serial(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function hash(s) { var n = 5381; for (var i = 0; i < s.length; i++) n = ((n * 33) ^ s.charCodeAt(i)) >>> 0; return n; }
  function index(seed, day, count) {
    if (!count) return 0;
    var step = 997, a, b, rest;
    do { a = step; b = count; while (b) { rest = a % b; a = b; b = rest; } if (a !== 1) step++; } while (a !== 1);
    return ((hash(String(seed)) + day * step) % count + count) % count;
  }
  function lastDay(year, month, SolarUtil) { return year === 1582 && month === 10 ? 31 : SolarUtil.getDaysOfMonth(year, month); }
  var places = ['临窗书斋', '小院听雨', '溪畔茶寮', '灯下案前', '城南旧巷', '竹影廊间', '湖畔水榭', '客舍庭中', '山寺回廊'];
  var moods = ['心有清欢', '闲适自得', '念君如常', '静候来书', '意气疏朗', '心事微澜', '且听风吟', '落笔生欢', '沉静安然', '望月怀人'];
  function daily(seed, roleId, d, cards) {
    var day = realDay(d), salt = seed + '|' + roleId;
    return { date: key(d), place: places[index(salt + 'p', day, places.length)], mood: moods[index(salt + 'm', day, moods.length)],
      skill: 35 + index(salt + 's', day, 65), quote: cards.length ? cards[index(salt + 'q', day, cards.length)].text : '一纸寄相思，静候故人书。' };
  }
  function storyDate(clock, now, Solar) {
    if (!clock || clock.mode === 'now') return Solar.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var elapsed = realDay(now) - clock.anchorDay;
    return Solar.fromYmd(clock.year, clock.month, clock.day).next(elapsed);
  }
  function eraLabel(clock, solar, han) {
    if (!clock || clock.mode === 'now') return solar.getYear() + '年';
    var n = clock.yearNumber + solar.getYear() - clock.year;
    return clock.label + (n === 1 ? '元' : han(n)) + '年';
  }
  function onDate(event, solar, lunar) {
    var y = event.calendar === 'lunar' ? lunar.getYear() : solar.getYear();
    var m = event.calendar === 'lunar' ? Math.abs(lunar.getMonth()) : solar.getMonth();
    var d = event.calendar === 'lunar' ? lunar.getDay() : solar.getDay();
    if (m !== event.month || d !== event.day || (event.calendar === 'lunar' && (lunar.getMonth() < 0) !== !!event.leap)) return false;
    return event.repeat ? y >= event.year : y === event.year;
  }
  function sentence(text) { var found = String(text || '').match(/[^。]+。/); return found ? found[0].trim() : ''; }
  var api = { key: key, serial: serial, realDay: realDay, hash: hash, index: index, daily: daily, storyDate: storyDate, eraLabel: eraLabel, onDate: onDate, sentence: sentence, lastDay: lastDay };
  W.ChisuAlmanacCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
