import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const release=JSON.parse(read('dist/release.json')).version;
test('页面、服务卷、更新器及所有脚本样式统一使用同一发布号',()=>{
 const html=read('dist/index.html');assert.ok(html.includes('name="chisu-version" content="'+release+'"'));
 for(const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g))assert.equal(new URL(m[1],'https://example.test/').searchParams.get('v'),release,m[1]);
 assert.ok(read('dist/sw.js').includes("chisu-v"+release));assert.ok(read('dist/js/updater.js').includes("VERSION = '"+release+"'"));
});
function worker(offline=false){
 const events={},deleted=[],requests=[],notices=[],writes=[];
 const cache={addAll:async req=>requests.push(...req),put:async(k,v)=>writes.push(k),match:async req=>String(req).endsWith('index.html')?new Response('offline page',{headers:{'Content-Type':'text/html'}}):undefined};
 const self={location:new URL('https://example.test/chisu/sw.js'),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[{postMessage:m=>notices.push(m)}]},addEventListener:(k,v)=>events[k]=v};
 runInNewContext(read('dist/sw.js'),{self,URL,Request,Response,Promise,caches:{open:async()=>cache,keys:async()=>['other-app','chisu-v0.1.0','chisu-v'+release],delete:async k=>deleted.push(k)},fetch:async(req,opt)=>{requests.push({req,opt});if(offline)throw Error('offline');return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 return {events,deleted,requests,notices,writes};
}
test('安装新版绕开HTTP旧缓存，激活只清理尺素资源缓存并通知页面',async()=>{
 const w=worker();let task;w.events.install({waitUntil:p=>task=p});await task;
 assert.ok(w.requests.length>20);assert.ok(w.requests.every(r=>r.cache==='reload'));for(const r of w.requests){const path=new URL(r.url).pathname.replace('/chisu/','')||'index.html';assert.ok(existsSync(new URL('../dist/'+path,import.meta.url)),path);}
 w.events.activate({waitUntil:p=>task=p});await task;assert.deepEqual(w.deleted,['chisu-v0.1.0']);assert.equal(w.notices[0].version,release);
});
test('发布清单始终走网络，静态文件离线缺失时不会错回旧HTML',async()=>{
 const w=worker(true);let response;
 w.events.fetch({request:new Request('https://example.test/chisu/release.json?t=1'),respondWith:p=>response=p});assert.equal((await response).status,503);assert.equal(w.requests[0].opt.cache,'no-store');
 w.events.fetch({request:new Request('https://example.test/chisu/js/missing.js'),respondWith:p=>response=p});const missing=await response;assert.equal(missing.status,503);assert.ok(!(await missing.text()).includes('offline page'));
 w.events.fetch({request:{url:'https://example.test/chisu/',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),'offline page');
});
function updater(){
 const timers=[],navigations=[],form={tagName:'TEXTAREA',value:'尚未落笔',getClientRects:()=>[{}]};let saveResolve,saves=0;
 const document={hidden:false,activeElement:form,querySelector:()=>null,body:{appendChild(){}},addEventListener(){}};
 const window={location:{href:'https://example.test/chisu/?v='+release,replace:url=>navigations.push(url)},ChisuUtil:{$$:()=>[form],h:()=>({}),toast(){}},ChisuState:{S:{ready:true,pending:[]},prepareReload:()=>{saves++;return new Promise(r=>saveResolve=r);}}};
 runInNewContext(read('dist/js/updater.js'),{window,document,navigator:{},URL,Promise,fetch:async()=>({ok:true,json:async()=>({version:'99.0.0'})}),setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout(){},setInterval(){}});
 return {U:window.ChisuUpdater,document,form,timers,navigations,saves:()=>saves,finish:()=>saveResolve(true)};
}
test('新卷到来时不刷新未发文字；清空后也须等本机存妥再换版',async()=>{
 const x=updater();assert.equal(await x.U.check(false),'updating');x.timers.shift()();assert.equal(x.saves(),0);assert.equal(x.form.value,'尚未落笔');assert.equal(x.navigations.length,0);
 x.document.activeElement=null;x.form.value='';x.timers.shift()();assert.equal(x.saves(),1);assert.equal(x.navigations.length,0);
 x.finish();await Promise.resolve();await Promise.resolve();assert.equal(x.navigations.length,1);assert.ok(x.navigations[0].includes('v=99.0.0'));
});
test('已是当前版或更老版时不循环刷新',()=>{
 const x=updater();assert.equal(x.U.newer(release,release),false);assert.equal(x.U.newer('0.1.0',release),false);assert.equal(x.U.newer('bad',release),false);
});
