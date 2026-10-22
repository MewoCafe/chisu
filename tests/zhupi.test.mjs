import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const C=createRequire(import.meta.url)('../dist/js/core.js');
function reply(chance) {
  const role={id:'r',name:'测试角色',zhupi:chance,groups:{card:['g'],kao:[],img:[],stk:[]},mix:{card:100},sleep:{on:false}};
  const message={id:'m',from:'me',kind:'text',text:'今夜月色真好，想与你同看。'};
  const S={messages:{r:[message]},pending:[{roleId:'r',kind:'chat',dueAt:0,remaining:1,started:false}],lib:{card:{zhupiGroup:'z',items:[{id:'a',text:'见字如晤。',groups:['g']},{id:'z',text:'此句甚好。',groups:['z']}]},kao:{items:[]},img:{items:[]},stk:{items:[]}}};
  const saved=[],events=[],math=Object.create(Math);math.random=()=>0.05;
  const window={ChisuCore:C,ChisuUtil:{toast(){}},ChisuState:{S,roleById:()=>role,save:k=>saved.push(k)}};
  runInNewContext(readFileSync(new URL('../dist/js/engine.js',import.meta.url),'utf8'),{window,Math:math,setTimeout:()=>1,clearTimeout(){}});
  window.ChisuEngine.on('zhupi',d=>events.push(d));window.ChisuEngine.process();
  return {S,message,saved,events};
}
test('朱批实际回笔流程：触发后圈选原句、取批语并保存往来', () => {
  const {S,message,saved,events}=reply(100);
  assert.equal(events.length,1);assert.equal(message.zhupi.note,'此句甚好。');
  assert.ok(message.zhupi.length>=1 && message.zhupi.length<=3);assert.ok(message.text.slice(message.zhupi.start,message.zhupi.start+message.zhupi.length));
  assert.equal(S.messages.r.length,2);assert.equal(S.messages.r[1].from,'peer');assert.ok(saved.includes('messages'));
});
test('朱批关闭时不修改原句，角色回笔仍正常', () => {
  const {S,message,events}=reply(0);
  assert.equal(message.zhupi,undefined);assert.equal(events.length,0);assert.equal(S.messages.r.length,2);
});
