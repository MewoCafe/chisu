import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const C = createRequire(import.meta.url)('../dist/js/core.js');
function state(saved = {}) {
  const writes = [];
  const window = {ChisuCore:C, localStorage:{getItem:()=>null}, ChisuUtil:{get:k=>Promise.resolve(saved[k]), saveLater:k=>writes.push(k)}};
  runInNewContext(readFileSync(new URL('../dist/js/state.js', import.meta.url),'utf8'), {window,navigator:{}});
  return {st:window.ChisuState, writes};
}
test('初次角色与新增角色默认名为君', async () => {
  const {st} = state(); await st.load();
  assert.equal(st.currentRole().name, '君'); assert.equal(st.newRole().name, '君');
});
test('新增、旧版导入和完整卷宗导入均自动去重并保留分组', async () => {
  const {st} = state(); await st.load();
  const first = st.addItem(st.S.lib,'card',{text:'  同句\r\n第二行  '},['a']);
  const second = st.addItem(st.S.lib,'card',{text:'同句\n第二行'},['b']);
  assert.equal(first.id,second.id); assert.deepEqual(Array.from(first.groups),['a','b']);
  st.importAll(JSON.stringify({cards:['新句','新句',' 同句\n第二行 ']}));
  assert.equal(st.S.lib.card.items.filter(x=>x.text==='新句').length,1);
  const backup = JSON.parse(st.exportAll());
  backup.lib.card.items.push({id:'duplicate',n:999,text:first.text,groups:['c']});
  st.importAll(JSON.stringify(backup));
  assert.equal(st.S.lib.card.items.filter(x=>x.text===first.text).length,1);
  assert.ok(st.S.lib.card.items.find(x=>x.id===first.id).groups.includes('c'));
});
test('加载已有字卡自动去重并安排保存，保留已有角色名称', async () => {
  const initial = state(); await initial.st.load();
  const data = JSON.parse(initial.st.exportAll()); data.roles[0].name='自定姓名';
  data.lib.card.items.push({...data.lib.card.items[0], id:'duplicate', groups:['old']});
  const {st,writes} = state(data); await st.load();
  assert.equal(st.currentRole().name,'自定姓名');
  assert.equal(st.S.lib.card.items.filter(x=>x.text===data.lib.card.items[0].text).length,1);
  assert.ok(writes.includes('lib'));
});
