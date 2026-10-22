import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url), A=require('../dist/js/almanac-core.js'), C=require('../dist/js/core.js'), L=require('../dist/vendor/lunar.js');

test('农历新年以农历年换生肖，跨年前一日仍为兔年',()=>{
 const before=L.Solar.fromYmd(2024,2,9).getLunar(),after=L.Solar.fromYmd(2024,2,10).getLunar();
 assert.equal(before.getYearShengXiao(),'兔');assert.equal(after.getYearShengXiao(),'龙');assert.equal(after.getMonthInChinese(),'正');assert.equal(after.getDayInChinese(),'初一');
});
test('角色日签同日稳定，次日笔力、心境与所在均轮换',()=>{
 const cards=[{text:'甲。'},{text:'乙。'},{text:'丙。'}],d=new Date(2026,9,22),next=new Date(2026,9,23);
 const first=A.daily('seed','r',d,cards),again=A.daily('seed','r',d,cards),tomorrow=A.daily('seed','r',next,cards);
 assert.deepEqual(first,again);for(const k of ['place','mood','skill','quote'])assert.notEqual(first[k],tomorrow[k]);
 assert.notDeepEqual(first,A.daily('seed','other-role',d,cards));
});
test('保存后的当日日签不因墨藏改动和重开而重抽，次日另起一笺',()=>{
 let now=new Date(2026,9,22,10),saved=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}}
 const S={settings:{},lib:{card:{zhupiGroup:'z',items:[{text:'寻常。',groups:['g']},{text:'批语。',groups:['z']}]}}},role={id:'r',groups:{card:['g']}};
 const window={ChisuCore:C,ChisuAlmanacCore:A,ChisuUtil:{},ChisuState:{S,currentRole:()=>role,save(){saved++;}}};
 runInNewContext(readFileSync(new URL('../dist/js/almanac.js',import.meta.url),'utf8'),{window,Date:Clock});
 const initial=window.ChisuAlmanac.daySnapshot();assert.equal(initial.quote,'寻常。');
 S.lib.card.items=[{text:'后来之句。',groups:['g']}];assert.equal(window.ChisuAlmanac.daySnapshot(),initial);assert.equal(saved,1);
 initial.place='自题书斋';assert.equal(window.ChisuAlmanac.daySnapshot().place,'自题书斋');
 now=new Date(2026,9,23,8);const next=window.ChisuAlmanac.daySnapshot();assert.equal(next.quote,'后来之句。');assert.notEqual(next.date,initial.date);assert.equal(saved,2);
});
test('故事纪年逐实际日推进，跨年与闰日不会因刷新停留',()=>{
 const anchor=new Date(2026,9,22),clock={mode:'era',label:'贞观',yearNumber:1,year:627,month:12,day:31,anchorDay:A.realDay(anchor)};
 const same=A.storyDate(clock,anchor,L.Solar),next=A.storyDate(clock,new Date(2026,9,23),L.Solar);
 assert.equal(same.toYmd(),'0627-12-31');assert.equal(next.toYmd(),'0628-01-01');assert.equal(A.eraLabel(clock,next,C.hanNum),'贞观二年');
 const leap={...clock,year:2024,month:2,day:28};assert.equal(A.storyDate(leap,new Date(2026,9,23),L.Solar).toYmd(),'2024-02-29');
 const ancient={...clock,year:-1045,month:10,day:22};assert.equal(A.storyDate(ancient,anchor,L.Solar).getYear(),-1045);
});
test('纪念日区分农历、公历、闰月与仅此一年；不倒数未到的起年',()=>{
 const solar=L.Solar.fromYmd(2024,2,10),lunar=solar.getLunar();
 assert.equal(A.onDate({calendar:'lunar',year:2023,month:1,day:1,repeat:true},solar,lunar),true);
 assert.equal(A.onDate({calendar:'solar',year:2023,month:1,day:1,repeat:true},solar,lunar),false);
 assert.equal(A.onDate({calendar:'lunar',year:2023,month:1,day:1,repeat:false},solar,lunar),false);
 assert.equal(A.onDate({calendar:'lunar',year:2025,month:1,day:1,repeat:true},solar,lunar),false);
 const leap=L.Lunar.fromYmd(2023,-2,1),s=leap.getSolar();
 assert.equal(A.onDate({calendar:'lunar',year:2023,month:2,day:1,leap:true,repeat:true},s,leap),true);
 assert.equal(A.onDate({calendar:'lunar',year:2023,month:2,day:1,leap:false,repeat:true},s,leap),false);
});
test('四千余摘句均只含一个句号，保留出处且互不重复；年号可查唐宋明清及民国日本',()=>{
 const poems=JSON.parse(readFileSync(new URL('../dist/data/poems.json',import.meta.url),'utf8'));
 assert.equal(poems.length,4096);assert.equal(new Set(poems.map(p=>p[0])).size,poems.length);
 for(const p of poems){assert.equal(p[0].match(/。/g).length,1);assert.ok(p[0].endsWith('。'));assert.ok(p[1]&&p[2]);}
 const eras=JSON.parse(readFileSync(new URL('../dist/data/eras.json',import.meta.url),'utf8'));
 assert.ok(eras.length>1000);for(const name of ['贞观','开元','建隆','至元','永乐','康熙','民国','令和'])assert.ok(eras.some(e=>e.name===name),name);
 assert.equal(A.sentence('白日依山尽，黄河入海流。欲穷千里目，更上一层楼。'),'白日依山尽，黄河入海流。');
});
test('圈点可落句首、句中、句末及单字，不越标点与换行',()=>{
 const text='甲乙丙，丁。\n戊己庚辛';
 assert.equal(C.pickQuan(text,()=>0).start,0);assert.equal(C.pickQuan(text,()=>.999999).start,text.length-1);
 const positions=new Set();for(let n=0;n<100;n++){const q=C.pickQuan(text,()=>n/100);positions.add(q.start);assert.ok(/^[一-鿿]+$/.test(text.slice(q.start,q.start+q.length)));assert.ok(q.start+q.length<=text.length);}
 assert.equal(positions.size,8);assert.deepEqual(C.pickQuan('君',()=>.99),{start:0,length:1});
});
test('轮换步长与资料条数互质，997张字卡也不会每日抽中同一张',()=>{
 assert.notEqual(A.index('x',100,997),A.index('x',101,997));
 const seen=new Set();for(let d=0;d<28;d++)seen.add(A.index('x',d,28));assert.equal(seen.size,28);
 assert.equal(A.lastDay(1582,10,L.SolarUtil),31);
});
