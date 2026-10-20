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
