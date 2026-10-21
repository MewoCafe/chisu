import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const C = createRequire(import.meta.url)('../dist/js/core.js');

const seq = xs => { let i = 0; return () => xs[i++ % xs.length]; };

test('区间随机：等待与张数都落在用户自填区间内', () => {
  const r = C.normRange({min: 8, max: 2}, 0, 100, {min: 1, max: 2}, false);
  assert.deepEqual(r, {min: 2, max: 8});
  for (const x of [0, .3, .999999, 1]) {
    const n = C.randBetween({min: 2, max: 5}, () => x, true);
    assert.ok(Number.isInteger(n) && n >= 2 && n <= 5);
  }
  assert.equal(C.randBetween({min: 3, max: 3}, Math.random, true), 3);
});

test('角色只从勾选的分组抽取，批语组不混入寻常回笔', () => {
  const lib = {card: {zhupiGroup: 'gz', items: [{id: 'a', groups: ['g1'], text: 'A'}, {id: 'b', groups: ['g2'], text: 'B'}, {id: 'z', groups: ['gz'], text: 'Z'}]},
    kao: {items: [{id: 'k', groups: ['k1'], text: '(´-ω-`)'}]}, img: {items: []}, stk: {items: []}};
  const role = {groups: {card: ['g1'], kao: [], img: ['*'], stk: []}};
  assert.deepEqual(C.rolePool(role, lib).map(p => p.item.id), ['a']);
  role.groups.card = ['*'];
  assert.deepEqual(C.rolePool(role, lib).map(p => p.item.id).sort(), ['a', 'b']);
  role.groups.kao = ['k1'];
  const r = C.drawReply({...role, mix: {card: 0, kao: 10}}, lib, seq([.5, .1]));
  assert.equal(r.lib, 'kao');
});

test('时辰、汉字数字、作息', () => {
  assert.equal(C.shichen(new Date(2026, 0, 1, 23)), '子初');
  assert.equal(C.shichen(new Date(2026, 0, 1, 12)), '午正');
  assert.equal(C.hanNum(15), '十五'); assert.equal(C.hanNum(42), '四十二');
  assert.equal(C.durationText(135), '二分十五秒');
  const role = {sleep: {on: true, from: 23, to: 7}};
  assert.equal(C.roleState(role, new Date(2026, 0, 1, 2)), 'rest');
  assert.equal(C.roleState(role, new Date(2026, 0, 1, 14)), 'awake');
  assert.equal(C.roleState({...role, travel: true}, new Date()), 'travel');
});

test('字素切分不拆组合符与 emoji 序列', () => {
  assert.deepEqual(C.graphemes('见字'), ['见', '字']);
  assert.equal(C.graphemes('👩‍👧').length, 1);
  assert.equal(C.graphemes('é').length, 1);
});

test('朱批圈点落在原句汉字上', () => {
  const t = '今夜雨大，君可安好？';
  const q = C.pickQuan(t, seq([0, 0, 0]));
  assert.ok(q && /^[一-鿿]+$/.test(t.substr(q.start, q.length)));
  assert.equal(C.pickQuan('(｡･ω･｡)'), null);
});

test('字卡去重：归一换行与首尾空白，保留首张编号并合并分组', () => {
  const card = {items: [{id:'first', n:1, text:'  你好\r\n君  ', groups:['a']}, {id:'second', n:7, text:'你好\n君', groups:['b','a']}, {id:'third', n:9, text:'你好君', groups:['c']}]};
  assert.equal(C.dedupeCards(card), 1);
  assert.deepEqual(card.items.map(x => x.id), ['first', 'third']);
  assert.deepEqual(card.items[0].groups, ['a','b']);
  assert.equal(card.items[0].n, 1);
  assert.equal(C.dedupeCards(card), 0);
});

test('批添保留与对象原型同名的文本', () => {
  assert.deepEqual(C.parseLines('constructor\n__proto__\nconstructor'), {lines:['constructor','__proto__'], duplicates:1});
});

test('兼容第三方 customReplies 与 cardGrouping，不重复收入平铺镜像', () => {
  const replies=Array.from({length:1300},(_,i)=>'测试字卡 '+i);
  const parsed=C.parseTextImport({replyGroupName:'测试分组',customReplies:replies,cardGrouping:{groups:[{id:'external',name:'测试分组',replies}]}},'文件名');
  assert.equal(parsed.entries.length,1300);assert.equal(parsed.duplicates,0);
  assert.deepEqual(parsed.entries[1299],{text:'测试字卡 1299',groups:['测试分组']});
});
test('分组字卡保留归属及独有平铺条目，过滤非法对象', () => {
  const parsed=C.parseTextImport({replyGroupName:'其他',customReplies:['甲','乙',null,{noText:'非法'},'丙'],cardGrouping:{groups:[{name:'一组',replies:['甲','乙']},{name:'二组',replies:['甲']}]}},'文件名');
  assert.equal(parsed.entries.length,3);assert.deepEqual(parsed.entries[0].groups,['一组','二组']);
  assert.deepEqual(parsed.entries[2],{text:'丙',groups:['其他']});
});
test('仍兼容普通数组、items/cards 导出及换行，空文件和未知格式明确报错', () => {
  for(const data of [[' 甲\r\n乙 '],{items:[{text:' 甲\r\n乙 '}]},{cards:[' 甲\r\n乙 ']}]) {
    assert.equal(C.parseTextImport(data,'收入').entries[0].text,'甲\n乙');
  }
  assert.throws(()=>C.parseTextImport({items:'不是数组'},'收入'),/未识别/);
  assert.throws(()=>C.parseTextImport({customReplies:[null,{},123,'  ']},'收入'),/没有可收入/);
  assert.deepEqual(C.parseTextImport({items:[{text:'甲',groups:['原组']}]},'收入').entries[0].groups,['原组']);
});

test('朱批原句和随后回笔能放在一叶时，不被自动翻页拆散', () => {
  const msgs=[{from:'peer'},{from:'me',zhupi:{note:'妙。'}},{from:'peer'},{from:'peer'}];
  assert.deepEqual(C.chatPages(msgs,[70,35,25,25],100),[[0],[1,2,3]]);
});
test('超长朱批和多页回笔正常分页，消息不丢失、不重复', () => {
  const msgs=[{from:'me',zhupi:{}},{from:'peer'},{from:'peer'},{from:'me'}];
  assert.deepEqual(C.chatPages(msgs,[120,45,45,30],100),[[0],[1,2],[3]]);
  assert.deepEqual(C.chatPages([],[],100),[[]]);
});
