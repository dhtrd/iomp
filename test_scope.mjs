import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const IT=[[{code:'A',name:'صنف',book:5,cost:2}]];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:960,height:1200} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// SC1 — counter with report.view.own sees report of a session they're assigned to
{ const page=await ctx.newPage();
  await load(page,{ user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:{uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد',role:'عدّاد',active:true}, users:[OWNER],
    config:{ roles:{ 'عدّاد':{ count:true, 'report.view.own':true } } },
    sessions:[{id:'A',name:'جلستي',status:'open',started:true,assignedCounters:['u_ct'],itemCount:1,location:'فرع أ',__chunks:IT}] });
  await page.evaluate(()=>window.__openSession('A')); await page.waitForTimeout(350);
  ok('SC1 المكلَّف بنطاق «الخاص به» يرى زر تقرير جلسته', await page.evaluate(()=>window.__has('repBtn')));
  await page.close(); }
// SC2 — same user denied a report of a session they are NOT part of
{ const page=await ctx.newPage();
  await load(page,{ user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:{uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد',role:'عدّاد',active:true}, users:[OWNER],
    config:{ roles:{ 'عدّاد':{ count:true, 'report.view.own':true } } },
    sessions:[{id:'B',name:'جلسة غيري',status:'approved',assignedCounters:['u_x'],itemCount:1,location:'فرع ب',__chunks:IT}] });
  await page.evaluate(()=>window.__openReport('B')); await page.waitForTimeout(350);
  const denied=await page.evaluate(()=>window.__contentHtml().includes('خارج نطاق اطّلاعك'));
  ok('SC2 يُمنع من تقرير جلسة خارج نطاقه', denied);
  await page.close(); }
// SC3 — viewer with report.view.location sees only their warehouse's sessions
{ const page=await ctx.newPage();
  await load(page,{ user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:{uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع',role:'مطّلع',active:true}, users:[OWNER],
    config:{ roles:{ 'مطّلع':{ 'report.view':false, 'report.view.location':true } }, userLocations:{ 'u_vw':['فرع أ'] }, warehouses:[{id:'w1',name:'فرع أ'},{id:'w2',name:'فرع ب'}] },
    sessions:[{id:'A',name:'جرد فرع أ',status:'approved',itemCount:5,location:'فرع أ',__chunks:IT},{id:'B',name:'جرد فرع ب',status:'approved',itemCount:5,location:'فرع ب',__chunks:IT}] });
  await page.waitForTimeout(300);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('SC3 نطاق الموقع: يرى جلسة فرعه فقط', html.includes('جرد فرع أ')&&!html.includes('جرد فرع ب'), '');
  await page.close(); }
// SC4 — location-scoped viewer denied a report outside their warehouse
{ const page=await ctx.newPage();
  await load(page,{ user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:{uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع',role:'مطّلع',active:true}, users:[OWNER],
    config:{ roles:{ 'مطّلع':{ 'report.view':false, 'report.view.location':true } }, userLocations:{ 'u_vw':['فرع أ'] } },
    sessions:[{id:'B',name:'جرد فرع ب',status:'approved',itemCount:5,location:'فرع ب',__chunks:IT}] });
  await page.evaluate(()=>window.__openReport('B')); await page.waitForTimeout(350);
  ok('SC4 يُمنع من تقرير مستودع خارج نطاقه', await page.evaluate(()=>window.__contentHtml().includes('خارج نطاق اطّلاعك')));
  await page.close(); }
// SC5 — full report.view sees all sessions
{ const page=await ctx.newPage();
  await load(page,{ user:{uid:'u_vw',email:'vw@dhtrd.com'}, profile:{uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع',role:'مطّلع',active:true}, users:[OWNER],
    sessions:[{id:'A',name:'جرد فرع أ',status:'approved',itemCount:5,location:'فرع أ',__chunks:IT},{id:'B',name:'جرد فرع ب',status:'approved',itemCount:5,location:'فرع ب',__chunks:IT}] });
  await page.waitForTimeout(300);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('SC5 «عرض الكل» يرى كل الجلسات', html.includes('جرد فرع أ')&&html.includes('جرد فرع ب'));
  await page.close(); }
// SC6 — per-user warehouse assignment UI + save
{ const page=await ctx.newPage();
  await load(page,{ profile:OWNER, users:[OWNER,{uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع',role:'مطّلع',active:true}], config:{ warehouses:[{id:'w1',name:'فرع أ'},{id:'w2',name:'فرع ب'}] } });
  await page.evaluate(()=>window.__editUser('u_vw')); await page.waitForTimeout(350);
  const hasLoc=await page.evaluate(()=>document.querySelectorAll('.uloc').length>0);
  ok('SC6 محرّر المستخدم يعرض إسناد المستودعات', hasLoc);
  await page.evaluate(()=>{ const c=document.querySelector('.uloc[data-name="فرع أ"]'); if(c)c.checked=true; });
  await page.evaluate(()=>window.__click('saveUserOvr')); await page.waitForTimeout(300);
  const saved=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.userLocations&&c.userLocations['u_vw']?c.userLocations['u_vw']:[]; });
  ok('SC6 حُفظ إسناد المستودع للفرد', saved.indexOf('فرع أ')>=0, JSON.stringify(saved));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
