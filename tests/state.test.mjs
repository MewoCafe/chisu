import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const C = createRequire(import.meta.url)('../dist/js/core.js');
function state(saved = {}) {
  const writes = [], persisted = [];
  const window = {ChisuCore:C, localStorage:{getItem:()=>null}, ChisuUtil:{get:k=>Promise.resolve(saved[k]), saveLater:k=>writes.push(k), flushAll:()=>Promise.resolve([]), set:(key,value)=>{persisted.push([key,value]);return Promise.resolve(true);}}};
  runInNewContext(readFileSync(new URL('../dist/js/state.js', import.meta.url),'utf8'), {window,navigator:{}});
  return {st:window.ChisuState, writes, persisted};
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

test('新卷与旧默认案式均用素笺，手动选择雅集后保存且不改往来', async () => {
  const {st}=state();await st.load();
  assert.equal(st.S.settings.bookStyle,'simple');
  const role=st.currentRole();
  st.S.messages[role.id].push({id:'style-keep',from:'me',kind:'text',text:'往来如故。'});
  st.S.settings.bookStyle='ornate';
  st.S.settings.bookStyleChosen=true;
  const saved=JSON.parse(st.exportAll());
  const reloaded=state(saved);await reloaded.st.load();
  assert.equal(reloaded.st.S.settings.bookStyle,'ornate');
  assert.equal(reloaded.st.S.messages[role.id][0].id,'style-keep');
  delete saved.settings.bookStyleChosen;
  const legacy=state(saved);await legacy.st.load();
  assert.equal(legacy.st.S.settings.bookStyle,'simple');
  assert.equal(legacy.st.S.messages[role.id][0].id,'style-keep');
  legacy.st.importAll(JSON.stringify(saved));
  assert.equal(legacy.st.S.settings.bookStyle,'simple');
});

test('起居、每日摘句、自定纪年和纪念日随本机卷宗保存，不与字卡导入混淆', async()=>{
 const {st}=state();await st.load();
 st.S.settings.almanac={seed:'test',clock:{mode:'custom',label:'永宁',year:2026,month:10,day:22,yearNumber:1,anchorDay:20000},days:{'2026-10-22|r':{place:'书斋',mood:'清欢',skill:70,quote:'今日案语。'}},poems:{'2026-10-22':['山中相送罢，日暮掩柴扉。','王维','送别']},anniversaries:[{id:'a',name:'初逢',calendar:'lunar',year:2026,month:9,day:13,repeat:true}]};
 const original=JSON.stringify(st.S.settings.almanac), backup=st.exportAll();
 st.importAll(JSON.stringify({customReplies:['并入字卡。']}));assert.equal(JSON.stringify(st.S.settings.almanac),original);
 const restored=state();await restored.st.load();restored.st.importAll(backup);
 assert.equal(JSON.stringify(restored.st.S.settings.almanac),original);
});

test('换卷前将人物、字卡、往来与设置全部存妥，再允许刷新', async()=>{
 const {st,persisted}=state();await st.load();const r=st.currentRole();
 st.S.messages[r.id].push({id:'before-update',from:'me',text:'换卷仍留此句。'});
 assert.equal(await st.prepareReload(),true);
 assert.deepEqual(persisted.map(x=>x[0]).sort(),['settings','roles','lib','messages','letters','pending'].sort());
 assert.equal(persisted.find(x=>x[0]==='messages')[1][r.id][0].id,'before-update');
});
