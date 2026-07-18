import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';

execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });

const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

const USERS = [
  { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true },
  { uid:'u_wh', email:'wh@dhtrd.com', name:'أمين المخزن', role:'مدير مخزون', title:'أمين المستودع', active:true },
  { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true },
  { uid:'u_vw', email:'vw@dhtrd.com', name:'مطّلع ١', role:'مطّلع', active:true },
];
const prof = (uid) => USERS.find(u=>u.uid===uid);

const results = [];
const ok = (name, cond, detail='') => results.push({ name, pass: !!cond, detail });

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });

async function load(page, sc) {
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 8000 });
  await page.waitForTimeout(120); // let auth + perm listener + first render settle
}
const caps = (page, list) => page.evaluate(l => l.map(c => window.__can(c)), list);

// ---- S1 owner ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });
  const [count,approve,users,perms,exp] = await caps(page, ['count','session.approve','users.manage','perms.manage','report.export']);
  const nav = await page.evaluate(()=>window.__nav());
  ok('S1 المالك: كل الصلاحيات true', count&&approve&&users&&perms&&exp, `${count}/${approve}/${users}/${perms}/${exp}`);
  ok('S1 المالك: isOwner', await page.evaluate(()=>window.__isOwner()));
  ok('S1 المالك: التبويبات (جلسات+مستخدمون+صلاحيات)', nav.display!=='none'&&nav.html.includes('data-tab="sessions"')&&nav.html.includes('data-tab="users"')&&nav.html.includes('data-tab="settings"'), nav.html);
  await page.close();
}
// ---- S2 warehouse manager ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_wh',email:'wh@dhtrd.com'}, profile:prof('u_wh'), users:USERS });
  const [approve,close,exp,umanage,pmanage] = await caps(page, ['session.approve','session.close','report.export','users.manage','perms.manage']);
  const nav = await page.evaluate(()=>window.__nav());
  ok('S2 مدير مخزون: يعتمد ويغلق ويصدّر', approve&&close&&exp, `${approve}/${close}/${exp}`);
  ok('S2 مدير مخزون: لا يدير مستخدمين/صلاحيات', !umanage&&!pmanage, `${umanage}/${pmanage}`);
  ok('S2 مدير مخزون: تبويب الجلسات فقط', nav.html.includes('data-tab="sessions"')&&!nav.html.includes('data-tab="users"')&&!nav.html.includes('data-tab="settings"'), nav.html);
  await page.close();
}
// ---- S3 counter ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS });
  const [count,view,mgr] = await caps(page, ['count','report.view','session.close']);
  const nav = await page.evaluate(()=>window.__nav());
  const content = await page.evaluate(()=>window.__contentHtml());
  ok('S3 عدّاد: يعدّ ولا يرى تقارير/إغلاق', count&&!view&&!mgr, `${count}/${view}/${mgr}`);
  ok('S3 عدّاد: لا شريط تبويبات', nav.display==='none', nav.display);
  ok('S3 عدّاد: شاشة العدّاد', content.includes('جلسات الجرد المتاحة'), content.slice(0,80));
  await page.close();
}
// ---- S4 viewer ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:prof('u_vw'), users:USERS });
  const [view,exp,count] = await caps(page, ['report.view','report.export','count']);
  const content = await page.evaluate(()=>window.__contentHtml());
  ok('S4 مطّلع: يرى ويصدّر ولا يعدّ', view&&exp&&!count, `${view}/${exp}/${count}`);
  ok('S4 مطّلع: شاشة التقارير', content.includes('تقارير الفروقات'), content.slice(0,80));
  await page.close();
}
// ---- S5 role config override (عدّاد granted report.view) ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, config:{ roles:{ 'عدّاد':{ 'report.view':true } } } });
  const [view,count] = await caps(page, ['report.view','count']);
  ok('S5 إعداد الدور: عدّاد مُنح عرض التقارير', view===true, `view=${view}`);
  ok('S5 إعداد الدور: يبقى العدّ افتراضياً true', count===true, `count=${count}`);
  await page.close();
}
// ---- S6 per-user override ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, config:{ users:{ 'u_ct':{ 'session.approve':true, 'count':false } } } });
  const [approve,count] = await caps(page, ['session.approve','count']);
  const nav = await page.evaluate(()=>window.__nav());
  ok('S6 استثناء الفرد: مُنح الاعتماد', approve===true, `approve=${approve}`);
  ok('S6 استثناء الفرد: نُزع العدّ', count===false, `count=${count}`);
  ok('S6 استثناء الفرد: ظهر تبويب الجلسات (لأنه يعتمد)', nav.html.includes('data-tab="sessions"'), nav.html);
  await page.close();
}
// ---- S7 owner supremacy over bad config ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS,
    config:{ roles:{ 'مدير':{ 'perms.manage':false, 'count':false } }, users:{ 'u_owner':{ 'count':false } } } });
  const [count,perms] = await caps(page, ['count','perms.manage']);
  ok('S7 سيادة المالك: يتجاوز إعداداً يقيّده', count===true&&perms===true, `count=${count}/perms=${perms}`);
  await page.close();
}
// ---- S8 panel: save role matrix ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(200);
  const hasPanel = await page.evaluate(()=>window.__contentHtml().includes('صلاحيات الأدوار'));
  ok('S8 اللوحة تُعرض', hasPanel);
  // check the عدّاد×report.view box then save
  const toggled = await page.evaluate(()=>{
    const chk=document.querySelector('.rcap[data-role="عدّاد"][data-cap="report.view"]');
    if(!chk) return 'no-box'; if(!chk.checked) chk.checked=true; return 'ok';
  });
  ok('S8 خانة عدّاد×عرض موجودة', toggled==='ok', toggled);
  // verify مدير×perms.manage is locked (disabled+checked)
  const lock = await page.evaluate(()=>{ const c=document.querySelector('.rcap[data-role="مدير"][data-cap="perms.manage"]'); return c?{disabled:c.disabled,checked:c.checked}:null; });
  ok('S8 قفل أمان: مدير×إدارة الصلاحيات مقفل ومفعّل', lock&&lock.disabled&&lock.checked, JSON.stringify(lock));
  await page.evaluate(()=>window.__click('savePermRoles'));
  await page.waitForTimeout(200);
  const saved = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.roles&&c.roles['عدّاد']?c.roles['عدّاد']['report.view']:null; });
  ok('S8 حُفظ: عدّاد×عرض = true في المخزن', saved===true, `saved=${saved}`);
  const savedLock = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.roles&&c.roles['مدير']?c.roles['مدير']['perms.manage']:null; });
  ok('S8 حُفظ: مدير×إدارة الصلاحيات = true (قفل)', savedLock===true, `lock=${savedLock}`);
  await page.screenshot({ path: 'preview-perms.png', fullPage: true });
  await page.close();
}
// ---- S9 panel: per-user override save + clear ----
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:prof('u_owner'), users:USERS });
  await page.evaluate(()=>window.__setTab('settings'));
  await page.waitForTimeout(250);
  // select u_ct in the picker and render overrides
  const sel = await page.evaluate(()=>{ const s=document.getElementById('permUser'); if(!s)return 'no-sel';
    s.value='u_ct'; s.onchange(); return 'ok'; });
  await page.waitForTimeout(120);
  ok('S9 محرّر الاستثناءات ظهر', await page.evaluate(()=>window.__has('saveUserOvr')), sel);
  const setOn = await page.evaluate(()=>{ const s=document.querySelector('.ucap[data-cap="session.approve"]'); if(!s)return 'no'; s.value='on'; return 'ok'; });
  await page.evaluate(()=>window.__click('saveUserOvr'));
  await page.waitForTimeout(200);
  const uSaved = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.users&&c.users['u_ct']?c.users['u_ct']['session.approve']:null; });
  ok('S9 حُفظ استثناء الفرد: u_ct.session.approve=true', uSaved===true, `setOn=${setOn} saved=${uSaved}`);
  // now set back to inherit and save → key should be gone
  await page.evaluate(()=>{ const s=document.querySelector('.ucap[data-cap="session.approve"]'); if(s)s.value='inherit'; });
  await page.evaluate(()=>window.__click('saveUserOvr'));
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(()=>{ const c=window.__store['config/permissions']; const u=c&&c.users&&c.users['u_ct']; return u?('session.approve' in u):'no-user'; });
  ok('S9 الإرجاع لـ«يرث» يمسح الاستثناء', cleared===false, `hasKey=${cleared}`);
  await page.close();
}
// ---- S10 session-open gating: counter can edit, viewer read-only ----
{
  const sess = { id:'s1', name:'جرد المستودع', status:'open', started:true, assignedCounters:['u_ct','u_vw'], itemCount:2, blind:false,
    __chunks:[[{code:'A',name:'صنف أ',book:5,cost:2},{code:'B',name:'صنف ب',book:3,cost:1}]], __counts:[] };
  // counter
  let page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:prof('u_ct'), users:USERS, sessions:[sess] });
  await page.evaluate(()=>window.__openSession('s1'));
  await page.waitForTimeout(350);
  const ctEdit = await page.evaluate(()=>document.querySelectorAll('.padd').length>0);
  const ctGov = await page.evaluate(()=>window.__has('closeBtn')||window.__has('approveBtn'));
  const ctRep = await page.evaluate(()=>window.__has('repBtn'));
  ok('S10 عدّاد: أدوات العدّ ظاهرة', ctEdit);
  ok('S10 عدّاد: لا أزرار حوكمة', !ctGov);
  ok('S10 عدّاد: لا زر تقرير', !ctRep);
  await page.close();
  // viewer
  page = await ctx.newPage();
  await load(page, { user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:prof('u_vw'), users:USERS, sessions:[sess] });
  await page.evaluate(()=>window.__openSession('s1'));
  await page.waitForTimeout(350);
  const vwEdit = await page.evaluate(()=>document.querySelectorAll('.padd').length>0);
  const vwRep = await page.evaluate(()=>window.__has('repBtn'));
  ok('S10 مطّلع: للقراءة فقط (لا أدوات عدّ)', !vwEdit);
  ok('S10 مطّلع: زر التقرير ظاهر (لديه عرض)', vwRep);
  await page.close();
}

await browser.close();

let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.name}${r.pass?'':'  << '+r.detail}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
