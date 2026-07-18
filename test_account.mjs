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
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
const count = (page,sel) => page.evaluate(s=>document.querySelectorAll(s).length, sel);
const disp = (page,id) => page.evaluate(i=>{const e=document.getElementById(i);return e?getComputedStyle(e).display:'MISSING';}, id);

// AC1 — matrix includes the two password capabilities with correct defaults
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  const hasBoth = await page.evaluate(()=>['pw.change','pw.request'].every(k=>!!document.querySelector('.rcap[data-cap="'+k+'"]')));
  ok('AC1 المصفوفة تضم «تغيير/طلب كلمة المرور»', hasBoth);
  const whChange = await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="مدير مخزون"][data-cap="pw.change"]');return c?c.checked:null;});
  const ctChange = await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="عدّاد"][data-cap="pw.change"]');return c?c.checked:null;});
  const vwReq = await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="مطّلع"][data-cap="pw.request"]');return c?c.checked:null;});
  ok('AC1 الافتراضي: مدير مخزون=مفعّل، عدّاد=مُطفأ، مطّلع=مفعّل', whChange===true&&ctChange===false&&vwReq===true, `wh=${whChange}/ct=${ctChange}/vw=${vwReq}`);
  await page.close();
}
// AC2 — «حسابي» hidden for counter (no caps), visible for viewer/stock-manager (have caps)
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[] });
  ok('AC2 العدّاد: زر «حسابي» مخفي', (await disp(page,'acctBtn'))==='none', await disp(page,'acctBtn'));
  await page.close();
  const p2 = await ctx.newPage();
  await load(p2, { user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:prof('u_vw'), users:USERS, sessions:[] });
  ok('AC2 المطّلع: زر «حسابي» ظاهر', (await disp(p2,'acctBtn'))!=='none' && (await disp(p2,'acctBtn'))!=='MISSING', await disp(p2,'acctBtn'));
  await p2.close();
}
// AC3 — account page for viewer shows change + request; counter home has no selfPw
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:prof('u_vw'), users:USERS, sessions:[] });
  await page.evaluate(()=>window.__click('acctBtn')); await page.waitForTimeout(150);
  ok('AC3 المطّلع: صفحة الحساب فيها زر التغيير فقط (لا طلب)', await page.evaluate(()=>window.__has('acChangePw')&&!window.__has('acReqReset')));
  await page.close();
  const p2 = await ctx.newPage();
  await load(p2, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[] });
  ok('AC3 واجهة العدّاد: لا زر «selfPw» لكلمة المرور', !(await p2.evaluate(()=>window.__has('selfPw'))));
  await p2.close();
}
// AC4 — «تكليف» وحده لا يفتح جلسةً مبدوءة غير مُسندة إليه (حارس الاطّلاع)
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_asgn',email:'asgn@dhtrd.com'}, profile:{uid:'u_asgn',email:'asgn@dhtrd.com',name:'مُكلِّف فقط',role:'عدّاد',active:true},
    users:USERS, config:{ users:{ u_asgn:{ 'session.assign':true, count:false } } },
    sessions:[{id:'sx',name:'مبدوءة لغيره',status:'open',started:true,assignedCounters:['u_zz'],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('sx')); await page.waitForTimeout(250);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('AC4 «تكليف» وحده: يُمنع من جلسة مبدوءة غير مُسندة', html.includes('ليست ضمن المكلَّف بها')&&(await count(page,'.padd'))===0, html.slice(0,70));
  ok('AC4 يظهر زر رجوع', await page.evaluate(()=>window.__has('denyBack')));
  await page.close();
}
// AC5 — «تكليف» يفتح جلسةً غير مبدوءة في طور التجهيز (تكليف)، بلا عدّ
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_asgn',email:'asgn@dhtrd.com'}, profile:{uid:'u_asgn',email:'asgn@dhtrd.com',name:'مُكلِّف فقط',role:'عدّاد',active:true},
    users:USERS, config:{ users:{ u_asgn:{ 'session.assign':true, count:false } } },
    sessions:[{id:'snot',name:'قيد التجهيز',status:'open',started:false,assignedCounters:[],itemCount:2,__chunks:ITEMS}] });
  await page.evaluate(()=>window.__openSession('snot')); await page.waitForTimeout(250);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('AC5 «تكليف»: يفتح التجهيز (لوحة التكليف) لا الحظر', html.includes('العدّادون المكلَّفون')&&!html.includes('ليست ضمن المكلَّف بها'));
  ok('AC5 عناصر التكليف موجودة، بلا عدّ', await page.evaluate(()=>window.__has('assignList')&&window.__has('startCountBtn'))&&(await count(page,'.padd'))===0);
  await page.close();
}

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.name}${r.pass?'':'  << '+r.detail}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
