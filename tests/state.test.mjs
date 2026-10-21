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

test('第三方1300张字卡入库、分组与重复导入均正确，错误文件不留下空组', async () => {
  const {st}=state();await st.load();
  const replies=Array.from({length:1300},(_,i)=>'外部字卡 '+i);
  const data={replyGroupName:'测试分组',customReplies:replies,cardGrouping:{groups:[{name:'测试分组',replies}]}};
  const first=st.importTextData('card',data,'来源文件');
  assert.equal(first.added,1300);assert.equal(first.skipped,0);
  const group=st.S.lib.card.groups.find(g=>g.name==='测试分组');
  assert.equal(st.S.lib.card.items.filter(i=>i.groups.includes(group.id)).length,1300);
  const repeated=st.importTextData('card',data,'来源文件');
  assert.equal(repeated.added,0);assert.equal(repeated.skipped,1300);
  assert.equal(st.S.lib.card.groups.filter(g=>g.name==='测试分组').length,1);
  const groupsBefore=st.S.lib.card.groups.length,itemsBefore=st.S.lib.card.items.length;
  assert.throws(()=>st.importTextData('card',{wrong:['甲']},'空组'),/未识别/);
  assert.equal(st.S.lib.card.groups.length,groupsBefore);assert.equal(st.S.lib.card.items.length,itemsBefore);
});
test('通过卷宗入口收入第三方回复文件时只合并字卡，保留角色和往来', async () => {
  const {st}=state();await st.load();const role=st.currentRole();
  st.S.messages[role.id].push({id:'keep',text:'保留往来'});
  st.importAll(JSON.stringify({replyGroupName:'回复分组',customReplies:['外部新句']}));
  assert.equal(st.currentRole().id,role.id);assert.equal(st.S.messages[role.id][0].id,'keep');
  assert.ok(st.S.lib.card.items.some(i=>i.text==='外部新句'));
});
