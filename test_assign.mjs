import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const USERS = [
  { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true },
  { uid:'u_wh', email:'wh@dhtrd.com', name:'أمين المخزن', role:'مدير مخزون', active:true },
  { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true },
  { uid:'u_vw', email:'vw@dhtrd.com', name:'مطّلع ١', role:'مطّلع', active:true },
];
const prof = (uid) => USERS.find(u=>u.uid===uid);
const ITEMS = [[{code:'A',name:'صنف أ',book:5,cost:2},{code:'B',name:'صنف ب',book:3,cost:1}]];
const results = [];
const ok = (name, cond, detail='') => results.push({ name, pass: !!cond, detail });
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:900,height:1300} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }
const txt = (page,id) => page.evaluate(i=>{const e=document.getElementById(i);return e?e.textContent:'';}, id);
const count = (page,sel) => page.evaluate(s=>document.querySelectorAll(s).length, sel);

// A1 — setup panel for assigner
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS, sessions:[{id:'s1',name:'جرد التجهيز',status:'open',started:false,itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(300);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('A1 المُكلِّف: يرى «قيد التجهيز» ولوحة التكليف', html.includes('قيد التجهيز')&&html.includes('العدّادون المكلَّفون'));
  ok('A1 عناصر التكليف موجودة (قائمة + بدء الجرد)', await page.evaluate(()=>window.__has('assignList')&&window.__has('startCountBtn')));
  ok('A1 لا عدّ قبل البدء (لا حقول إضافة)', (await count(page,'.padd'))===0);
  await page.close();
}
// A2 — assigned-but-not-started counter sees the "not started yet" message (no assign panel, no count)
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[{id:'s1',name:'جرد التجهيز',status:'open',started:false,assignedCounters:['u_ct'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(250);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('A2 المكلَّف قبل البدء: رسالة «لم يبدأ الجرد بعد»', html.includes('لم يبدأ الجرد بعد'));
  ok('A2 لا لوحة تكليف ولا عدّ', !(await page.evaluate(()=>window.__has('assignList')))&&(await count(page,'.padd'))===0);
  await page.close();
}
// A3 — start locks roster + writes state
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS, sessions:[{id:'s1',name:'جرد التجهيز',status:'open',started:false,itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(350);
  const picked = await page.evaluate(()=>{ const c=document.querySelector('.asgn[value="u_ct"]'); if(!c)return false; c.checked=true; return true; });
  ok('A3 خانة تكليف عدّاد موجودة', picked);
  await page.evaluate(()=>window.__click('startCountBtn')); await page.waitForTimeout(300);
  const s = await page.evaluate(()=>window.__store['sessions/s1']);
  ok('A3 بدء الجرد: started=true', s&&s.started===true, JSON.stringify(s&&s.started));
  ok('A3 بدء الجرد: الطاقم = [u_ct]', s&&Array.isArray(s.assignedCounters)&&s.assignedCounters.length===1&&s.assignedCounters[0]==='u_ct', JSON.stringify(s&&s.assignedCounters));
  await page.close();
}
// A4 — assigned counter can count
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[{id:'s2',name:'جرد فعّال',status:'open',started:true,assignedCounters:['u_ct'],assignedNames:['عدّاد ١'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s2')); await page.waitForTimeout(300);
  ok('A4 المكلَّف: أدوات العدّ ظاهرة', (await count(page,'.padd'))>0);
  ok('A4 المكلَّف: ليس في طور التجهيز', !(await page.evaluate(()=>window.__has('startCountBtn'))));
  ok('A4 زر «صنف يدوي» ظاهر للمكلَّف', await page.evaluate(()=>window.__has('addItemBtn')));
  await page.close();
}
// A5 — unassigned counter is read-only with correct banner
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[{id:'s2',name:'جرد فعّال',status:'open',started:true,assignedCounters:['u_zz'],assignedNames:['آخر'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s2')); await page.waitForTimeout(300);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('A5 غير المكلَّف: يُمنع من دخول الجلسة', html.includes('ليست ضمن المكلَّف بها')&&(await count(page,'.padd'))===0, html.slice(0,80));
  ok('A5 غير المكلَّف: يظهر زر رجوع', await page.evaluate(()=>window.__has('denyBack')));
  await page.close();
}
// A6 — manual add creates extraItem, merges live, tagged يدوي
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[{id:'s2',name:'جرد فعّال',status:'open',started:true,assignedCounters:['u_ct'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s2')); await page.waitForTimeout(300);
  await page.evaluate(()=>window.__click('addItemBtn')); await page.waitForTimeout(150);
  await page.evaluate(()=>{ document.getElementById('ai_barcode').value='NEW1'; document.getElementById('ai_name').value='صنف مكتشف'; document.getElementById('ai_cat').value='متنوع'; document.getElementById('ai_cost').value='4'; });
  await page.evaluate(()=>window.__click('aiSave')); await page.waitForTimeout(300);
  const it = await page.evaluate(()=>window.__store['sessions/s2/extraItems/NEW1']);
  ok('A6 أُنشئ صنف يدوي في المخزن (manual=true)', it&&it.manual===true&&it.name==='صنف مكتشف'&&it.cost===4, JSON.stringify(it&&{n:it.name,m:it.manual,c:it.cost}));
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('A6 ظهر حيّاً في القائمة موسوماً «يدوي»', html.includes('صنف مكتشف')&&html.includes('يدوي'));
  await page.close();
}
// A7 — duplicate barcode rejected
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[{id:'s2',name:'جرد فعّال',status:'open',started:true,assignedCounters:['u_ct'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('s2')); await page.waitForTimeout(300);
  await page.evaluate(()=>window.__click('addItemBtn')); await page.waitForTimeout(150);
  await page.evaluate(()=>{ document.getElementById('ai_barcode').value='A'; document.getElementById('ai_name').value='مكرر'; document.getElementById('ai_cat').value='x'; document.getElementById('ai_cost').value='1'; });
  await page.evaluate(()=>window.__click('aiSave')); await page.waitForTimeout(200);
  const status = await txt(page,'aiStatus');
  ok('A7 رفض الباركود المكرر', status.includes('موجود مسبقاً'), status);
  ok('A7 لم يُنشأ صنف مكرر', !(await page.evaluate(()=>window.__store['sessions/s2/extraItems/A'])));
  await page.close();
}
// A8 — counter home lists only started+assigned sessions
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[
    {id:'sa',name:'مسندة فعّالة',status:'open',started:true,assignedCounters:['u_ct'],itemCount:1,__chunks:[[{code:'X',name:'x'}]]},
    {id:'sb',name:'غير مبدوءة',status:'open',started:false,assignedCounters:['u_ct'],itemCount:1},
    {id:'sc',name:'مسندة لغيري',status:'open',started:true,assignedCounters:['u_zz'],itemCount:1},
  ] });
  await page.waitForTimeout(300);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('A8 يظهر: المسندة الفعّالة', html.includes('مسندة فعّالة'));
  ok('A8 يُخفى: غير المبدوءة والمسندة لغيري', !html.includes('غير مبدوءة')&&!html.includes('مسندة لغيري'));
  await page.close();
}
// A9 — matrix includes session.assign
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  const exists = await page.evaluate(()=>!!document.querySelector('.rcap[data-cap="session.assign"]'));
  const mgr = await page.evaluate(()=>{ const c=document.querySelector('.rcap[data-role="مدير"][data-cap="session.assign"]'); return c?c.checked:null; });
  const ct = await page.evaluate(()=>{ const c=document.querySelector('.rcap[data-role="عدّاد"][data-cap="session.assign"]'); return c?c.checked:null; });
  ok('A9 المصفوفة تضم «تكليف العدّادين»', exists);
  ok('A9 الافتراضي: مدير=مسموح، عدّاد=ممنوع', mgr===true&&ct===false, `مدير=${mgr}/عدّاد=${ct}`);
  await page.close();
}

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.name}${r.pass?'':'  << '+r.detail}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
