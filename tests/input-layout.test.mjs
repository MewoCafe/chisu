import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function classes() {
  const set = new Set();
  return {toggle:(k,on)=>on ? set.add(k) : set.delete(k), contains:k=>set.has(k)};
}
function viewport(withVisual = true) {
  const css = {}, events = {}, frames = [], timers = new Map(), root = {style:{setProperty:(k,v)=>css[k]=v},classList:classes()};
  let resets = 0, scrolls = 0, reveals = 0, timerID = 0;
  const window = {__chisuOK:true,innerHeight:800,innerWidth:390, ChisuCore:{},
    ChisuUtil:{$:()=>window.testNode,installInputGuard(){},keepInputVisible(){reveals++;}},ChisuState:{S:{ready:false},load:()=>new Promise(()=>{})},ChisuEngine:{},
    ChisuChat:{resetCache:()=>resets++},scrollTo:()=>scrolls++,
    addEventListener:(k,f)=>events['window:'+k]=f,requestAnimationFrame:f=>{frames.push(f);return frames.length;}};
  if (withVisual) window.visualViewport = {height:800,width:390,offsetTop:0,addEventListener:(k,f)=>events['visual:'+k]=f};
  const document = {documentElement:root,activeElement:null,readyState:'complete',addEventListener:(k,f)=>events['document:'+k]=f};
  runInNewContext(readFileSync(new URL('../dist/js/app.js',import.meta.url),'utf8'),{window,document,setTimeout:fn=>{const id=++timerID;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  return {window,document,css,root,events,flush:()=>{while(frames.length)frames.shift()();},resets:()=>resets,scrolls:()=>scrolls,reveals:()=>reveals,flushTimers:()=>{const pending=Array.from(timers.values());timers.clear();pending.forEach(fn=>fn());}};
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

test('键盘动画期间失焦、切换输入框和安卓布局视口同步缩小时，不提前改变键盘状态', () => {
  const x=viewport();x.document.activeElement={tagName:'INPUT'};
  Object.assign(x.window.visualViewport,{height:340,offsetTop:0});x.window.innerHeight=340;
  x.events['visual:resize']();x.flush();assert.equal(x.root.classList.contains('keyboard-open'),true);
  x.document.activeElement=null;x.events['document:focusout']();x.flush();
  assert.equal(x.root.classList.contains('keyboard-open'),true);
  x.document.activeElement={tagName:'TEXTAREA'};x.events['document:focusin']();x.flush();
  assert.equal(x.css['--vh'],'340px');assert.equal(x.css['--input-max-height'],'109px');
  Object.assign(x.window.visualViewport,{height:800});x.window.innerHeight=800;
  x.events['visual:resize']();x.flush();assert.equal(x.root.classList.contains('keyboard-open'),false);
});

function inputTools() {
  const events={};const document={activeElement:null,body:{},addEventListener:(k,fn)=>events[k]=fn,querySelectorAll:()=>[],createElement:()=>({toDataURL:()=>''})};
  const window={ChisuCore:{},getComputedStyle:el=>({overflowY:el.overflowY||'visible'})};
  runInNewContext(readFileSync(new URL('../dist/js/util.js',import.meta.url),'utf8'),{window,document,setTimeout:()=>1,clearTimeout:()=>{}});
  return {U:window.ChisuUtil,document,events};
}
test('输入框被键盘挤出时仅滚动局部容器；已可见时不再移动', () => {
  const {U,document}=inputTools();
  const pane={parentNode:document.body,overflowY:'auto',scrollHeight:600,clientHeight:180,clientTop:0,scrollTop:0,getBoundingClientRect:()=>({top:60})};
  const field={tagName:'TEXTAREA',parentNode:pane,getBoundingClientRect:()=>({top:280-pane.scrollTop,bottom:380-pane.scrollTop,height:100})};
  document.activeElement=field;U.keepInputVisible();assert.equal(pane.scrollTop,140);
  U.keepInputVisible();assert.equal(pane.scrollTop,140,'已在容器内，不应重复滚动');
  pane.scrollTop=300;U.keepInputVisible();assert.equal(pane.scrollTop,220,'只移动足够露出上沿的距离');
});
test('点击传音输入框使用 preventScroll；关闭容器仅使内部焦点失焦', () => {
  const {U,document}=inputTools();let options=null,blurs=0;
  const field={tagName:'INPUT',focus:opts=>{options=opts;},blur:()=>blurs++};
  U.focusInput(field);assert.equal(options.preventScroll,true);
  document.activeElement=field;U.blurWithin({contains:()=>false});assert.equal(blurs,0);
  U.blurWithin({contains:()=>true});assert.equal(blurs,1);
});

test('阻止隐藏溢出的舞台与传音被浏览器滚出位置，保留正文的正常滚动', () => {
  const {U}=inputTools();
  const stage={id:'app',classList:classes(),scrollTop:36,scrollLeft:18};
  const call={id:'call',classList:classes(),scrollTop:36,scrollLeft:0};
  const pane={id:'set-pane',classList:classes(),scrollTop:112,scrollLeft:0};
  U.lockLayoutScroll(stage);U.lockLayoutScroll(call);U.lockLayoutScroll(pane);
  assert.equal(stage.scrollTop,0);assert.equal(stage.scrollLeft,0);assert.equal(call.scrollTop,0);
  assert.equal(pane.scrollTop,112);
});

test('键盘高度变化后紧接着切换焦点仍会重排消息，单纯切焦点不会重复重排', async () => {
  const x=viewport();let renders=0;
  const el={classList:{add(){},remove(){},toggle(){}}};
  x.window.testNode=el;
  Object.assign(x.window.ChisuUtil,{$$:()=>[],after:()=>Promise.resolve()});
  x.window.ChisuDesk={pickBrush:()=>Promise.resolve()};
  Object.assign(x.window.ChisuChat,{enter(){},autosize(){},render:()=>renders++});
  x.window.ChisuState.S.ready=true;
  await x.window.ChisuApp.go('chat');x.flushTimers();renders=0;
  x.window.visualViewport.height=360;x.events['visual:resize']();x.flush();
  x.events['document:focusin']();x.flush();x.flushTimers();assert.equal(renders,1);
  x.events['document:focusin']();x.flush();x.flushTimers();assert.equal(renders,1);
});

test('上下输入框反复点选时，浏览器忽略 preventScroll 也保留表单原位', () => {
  const {U,document,events}=inputTools();
  const pane={parentNode:document.body,overflowY:'auto',scrollTop:80,scrollLeft:0,scrollHeight:700,clientHeight:240,clientTop:0,getBoundingClientRect:()=>({top:50})};
  let focused=0,prevented=0;
  const input=top=>({tagName:'INPUT',type:'text',parentNode:pane,getBoundingClientRect:()=>({top,bottom:top+35,height:35}),focus(){pane.scrollTop=200;document.activeElement=this;focused++;}});
  const upper=input(75),lower=input(220);U.installInputGuard();
  for(const target of [upper,lower,upper,lower]) {
    events.touchstart({target,touches:[{clientX:90,clientY:100}]});
    events.touchend({target,preventDefault:()=>prevented++});
    assert.equal(pane.scrollTop,80,'可见输入框之间换焦点不应移动表单');
  }
  assert.equal(focused,4);assert.equal(prevented,4);
});
test('已聚焦输入框的光标点选、滑动和文件选择不拦截', () => {
  const {U,document,events}=inputTools();let prevented=0,focused=0;
  const input={tagName:'TEXTAREA',focus:()=>focused++};U.installInputGuard();document.activeElement=input;
  events.touchstart({target:input,touches:[{clientX:10,clientY:10}]});
  events.touchend({target:input,preventDefault:()=>prevented++});
  document.activeElement=null;
  events.touchstart({target:input,touches:[{clientX:10,clientY:10}]});
  events.touchmove({touches:[{clientX:10,clientY:30}]});
  events.touchend({target:input,preventDefault:()=>prevented++});
  events.mousedown({target:{tagName:'INPUT',type:'file'},button:0,preventDefault:()=>prevented++});
  assert.equal(prevented,0);assert.equal(focused,0);
});
test('输入框已经贴近容器边缘但仍完整可见时，不额外加边距推移内容', () => {
  const {U,document}=inputTools();
  const pane={parentNode:document.body,overflowY:'auto',scrollHeight:600,clientHeight:180,clientTop:0,scrollTop:24,getBoundingClientRect:()=>({top:60})};
  document.activeElement={tagName:'INPUT',type:'text',parentNode:pane,getBoundingClientRect:()=>({top:61,bottom:96,height:35})};
  U.keepInputVisible();assert.equal(pane.scrollTop,24);
});

test('可视区域只滚动不改变高度时，不再反复把表单拉向焦点', () => {
  const x=viewport(),before=x.reveals();
  for(const top of [24,48,36,0]) {
    x.window.visualViewport.offsetTop=top;x.events['visual:scroll']();x.flush();x.flushTimers();
  }
  assert.equal(x.reveals(),before);assert.equal(x.css['--viewport-top'],'0px');
});

test('聚焦后的延迟原生滚动只在短保护期内还原，手动滚动解除保护', () => {
  const {U,document}=inputTools();
  const pane={parentNode:document.body,overflowY:'auto',classList:classes(),scrollTop:80,scrollLeft:0,scrollHeight:700,clientHeight:240,clientTop:0,getBoundingClientRect:()=>({top:50})};
  const input={tagName:'INPUT',type:'text',parentNode:pane,getBoundingClientRect:()=>({top:100,bottom:135,height:35}),focus(){document.activeElement=this;}};
  U.focusInput(input);pane.scrollTop=116;U.lockLayoutScroll(pane);assert.equal(pane.scrollTop,80);
  U.releaseFocusScroll();pane.scrollTop=116;U.lockLayoutScroll(pane);assert.equal(pane.scrollTop,116);
});
