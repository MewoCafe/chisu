import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function classes() {
  const set = new Set();
  return {toggle:(k,on)=>on ? set.add(k) : set.delete(k), contains:k=>set.has(k)};
}
function viewport(withVisual = true) {
  const css = {}, events = {}, frames = [], root = {style:{setProperty:(k,v)=>css[k]=v},classList:classes()};
  let resets = 0, scrolls = 0;
  const window = {__chisuOK:true,innerHeight:800,innerWidth:390, ChisuCore:{},
    ChisuUtil:{},ChisuState:{S:{ready:false},load:()=>new Promise(()=>{})},ChisuEngine:{},
    ChisuChat:{resetCache:()=>resets++},scrollTo:()=>scrolls++,
    addEventListener:(k,f)=>events['window:'+k]=f,requestAnimationFrame:f=>{frames.push(f);return frames.length;}};
  if (withVisual) window.visualViewport = {height:800,width:390,offsetTop:0,addEventListener:(k,f)=>events['visual:'+k]=f};
  const document = {documentElement:root,activeElement:null,readyState:'complete',addEventListener:(k,f)=>events['document:'+k]=f};
  runInNewContext(readFileSync(new URL('../dist/js/app.js',import.meta.url),'utf8'),{window,document,setTimeout:()=>1,clearTimeout:()=>{}});
  return {window,document,css,root,events,flush:()=>{while(frames.length)frames.shift()();},resets:()=>resets,scrolls:()=>scrolls};
}
test('键盘缩小可视区域和向上平移时，舞台跟随高度与偏移，关闭后复位', () => {
  const x=viewport();
  x.document.activeElement={tagName:'TEXTAREA'};
  Object.assign(x.window.visualViewport,{height:360,offsetTop:94});
  x.events['visual:resize'](); x.events['visual:scroll'](); x.flush();
  assert.equal(x.css['--vh'],'360px'); assert.equal(x.css['--viewport-top'],'94px');
  assert.equal(x.root.classList.contains('keyboard-open'),true);
  assert.equal(x.resets(),1,'只改变高度不应清空消息测量缓存');
  assert.equal(x.scrolls(),0,'不要用页面滚动与输入法竞争');
  x.document.activeElement=null;
  Object.assign(x.window.visualViewport,{height:800,offsetTop:0});
  x.events['visual:resize'](); x.flush();
  assert.equal(x.css['--vh'],'800px');assert.equal(x.css['--viewport-top'],'0px');
  assert.equal(x.root.classList.contains('keyboard-open'),false);
});
test('旧内核没有 visualViewport 时，随 innerHeight 变化；横屏变宽后重新测量', () => {
  const x=viewport(false); x.window.innerHeight=340; x.window.innerWidth=800;
  x.events['window:resize']();x.flush();
  assert.equal(x.css['--vh'],'340px');assert.equal(x.css['--viewport-top'],'0px');assert.equal(x.resets(),2);
});
test('角色候笔显示提笔酝词，结束或远行时清除输入标识', () => {
  const nodes={};
  const node=()=>({textContent:'',classList:classes(),attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
  ['chat-status','chat-who','chat-name','chat-avatar','composer','chat-input','call-btn'].forEach(k=>nodes['#'+k]=node());
  let pending=2;
  const role={id:'r',name:'君',travel:false};
  const window={ChisuCore:{roleState:r=>r.travel?'travel':'awake',STATE_NAMES:{awake:'秉烛',travel:'远行'},shichen:()=> '午初'},
    ChisuUtil:{$:k=>nodes[k]},ChisuState:{S:{messages:{r:[]}},currentRole:()=>role,avatarOf:()=>''},
    ChisuEngine:{pendingCount:()=>pending},ChisuInk:{}};
  runInNewContext(readFileSync(new URL('../dist/js/chat.js',import.meta.url),'utf8'),{window});
  window.ChisuChat.status();
  assert.equal(nodes['#chat-status'].textContent,'提笔酝词');
  assert.equal(nodes['#chat-status'].attrs['aria-label'],'君正在输入：提笔酝词');
  assert.ok(nodes['#chat-who'].classList.contains('is-writing'));
  pending=0;window.ChisuChat.status();
  assert.equal(nodes['#chat-status'].textContent,'秉烛 · 午初');
  assert.equal(nodes['#chat-who'].classList.contains('is-writing'),false);
  pending=2;role.travel=true;window.ChisuChat.status();
  assert.equal(nodes['#chat-status'].textContent,'远行 · 午初');
  assert.equal(nodes['#chat-who'].classList.contains('is-writing'),false);
});
