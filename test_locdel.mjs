import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const USERS = [OWNER];
const ITEMS = [[{code:'A',name:'صنف أ',book:5,cost:2}]];
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:960,height:1200} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }

// D1 — delete cap present in matrix, correct defaults
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  const exists=await page.evaluate(()=>!!document.querySelector('.rcap[data-cap="session.delete"]'));
  const mgr=await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="مدير"][data-cap="session.delete"]');return c?c.checked:null;});
  const ct=await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="عدّاد"][data-cap="session.delete"]');return c?c.checked:null;});
  ok('D1 صلاحية «حذف الجلسة» في المصفوفة', exists);
  ok('D1 افتراضي: مدير=مسموح، عدّاد=ممنوع', mgr===true&&ct===false, `مدير=${mgr}/عدّاد=${ct}`);
  await page.close(); }
// D2 — delete button shows for not-started, hidden for started
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:USERS,sessions:[
    {id:'s_pre',name:'قيد التجهيز',status:'open',started:false,itemCount:1,location:'فرع أ',__chunks:ITEMS},
    {id:'s_run',name:'مبدوءة',status:'open',started:true,assignedCounters:['u_owner'],itemCount:1,location:'فرع أ',__chunks:ITEMS},
  ]});
  await page.waitForTimeout(250);
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const preHas=await page.evaluate(()=>!!document.querySelector('[data-del="s_pre"]'));
  const runHas=await page.evaluate(()=>!!document.querySelector('[data-del="s_run"]'));
  ok('D2 زر الحذف يظهر للجلسة غير المبدوءة', preHas);
  ok('D2 زر الحذف مخفي للجلسة المبدوءة', !runHas);
  await page.close(); }
// D3 — delete moves session to trash (soft) and removes it from the list
{ const page=await ctx.newPage(); page.on('dialog', d=>d.accept().catch(()=>{}));
  await load(page,{profile:OWNER,users:USERS,sessions:[{id:'s1',name:'للحذف',status:'open',started:false,itemCount:1,location:'فرع أ',__chunks:ITEMS}]});
  await page.waitForTimeout(250);
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.querySelector('[data-del="s1"]'); if(b)b.click(); });
  await page.waitForTimeout(250);
  // ر٢: تأكيد عبر حوار م١٢ بدل نافذة النظام
  await page.evaluate(()=>document.getElementById('cfGo').click());
  await page.waitForTimeout(400);
  const soft=await page.evaluate(()=>{ const s=window.__store['sessions/s1']; return !!(s&&s.deleted===true); });
  const gone=await page.evaluate(()=>!document.querySelector('[data-open="s1"]')&&!window.__contentHtml().includes('للحذف'));
  ok('D3 نُقلت الجلسة إلى السلة (deleted=true)', soft);
  ok('D3 اختفت من قائمة الجلسات', gone);
  await page.close(); }
// D4 — delete guard blocks a started session (not moved to trash)
// ر١: رسالة الحارس صارت toast تحذيريًّا (م٢٠) بدل نافذة alert المقاطِعة — النية ذاتها
{ const page=await ctx.newPage(); page.on('dialog', d=>{ d.accept().catch(()=>{}); });
  await load(page,{profile:OWNER,users:USERS,sessions:[{id:'s2',name:'مبدوءة',status:'open',started:true,assignedCounters:['u_owner'],itemCount:1,__chunks:ITEMS}]});
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.__del('s2')); await page.waitForTimeout(200);
  const notTrashed=await page.evaluate(()=>{ const s=window.__store['sessions/s2']; return !!(s&&s.deleted!==true); });
  const warned=await page.evaluate(()=>{ const h=document.getElementById('toastHost'); return !!h&&h.textContent.includes('لا يمكن حذف'); });
  ok('D4 الحارس يمنع نقل جلسة مبدوءة للسلة', notTrashed&&warned, `warned=${warned}`);
  await page.close(); }
// L1 — create-session location is a dropdown built from managed warehouses
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:USERS,config:{warehouses:[{id:'w1',name:'فرع الرياض',deleted:false},{id:'w2',name:'فرع جدة',deleted:false}]}});
  await page.waitForTimeout(250);
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const opts=await page.evaluate(()=>{ const s=document.getElementById('s_loc'); return s?Array.from(s.options).map(o=>o.value):[]; });
  ok('L1 حقل الموقع قائمة منسدلة من المستودعات المُدارة', opts.indexOf('فرع الرياض')>=0&&opts.indexOf('فرع جدة')>=0&&opts.indexOf('__new')>=0, JSON.stringify(opts));
  await page.close(); }
// L2 — archive view groups sessions by location
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:USERS,sessions:[
    {id:'a',name:'ج1',status:'open',started:false,itemCount:1,location:'فرع الرياض',__chunks:ITEMS},
    {id:'b',name:'ج2',status:'approved',itemCount:1,location:'فرع الرياض',__chunks:ITEMS},
    {id:'c',name:'ج3',status:'open',started:false,itemCount:1,location:'فرع جدة',__chunks:ITEMS},
  ]});
  await page.waitForTimeout(250);
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.getElementById('sessViewToggle'); if(b)b.click(); });
  await page.waitForTimeout(200);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('L2 الأرشيف يجمّع حسب الموقع', html.includes('🗂 فرع الرياض')&&html.includes('🗂 فرع جدة'));
  ok('L2 يعرض عدد الجلسات للموقع', html.includes('(2 جلسة)'));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
