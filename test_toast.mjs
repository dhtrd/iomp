// اختبارات الدفعة ر١ — منظومة Toast (م٢٠) بديل alert() في التطبيق الحي
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const COUNTER = { uid:'u_c', email:'c@dhtrd.com', name:'عدّاد', role:'عدّاد', active:true };
const ITEMS = [[{code:'A',name:'صنف أ',book:5,cost:2}]];
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:960,height:1200} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }

// T1 — الواجهة: toastOk/Warn/Err معرّفة والمضيف aria-live والرسالة تظهر بنوعها
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{
    const api=typeof window.toastOk==='function'&&typeof window.toastWarn==='function'&&typeof window.toastErr==='function';
    window.toastOk('تم الحفظ ✓');
    const h=document.getElementById('toastHost');
    const t=h&&h.querySelector('.toast.ok');
    return {api, live:h&&h.getAttribute('aria-live')==='polite', shown:!!t&&t.textContent.includes('تم الحفظ')};
  });
  ok('T1 واجهة Toast والمضيف aria-live والرسالة بنوعها', r.api&&r.live&&r.shown);
  await page.close(); }
// T2 — العابر (ok) يختفي وحده بعد مهلته
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const has=await page.evaluate(()=>{ window.__TOAST_TTL=250; window.toastOk('عابر');
    return document.querySelectorAll('#toastHost .toast').length===1; });
  await page.waitForTimeout(700);
  const gone=await page.evaluate(()=>document.querySelectorAll('#toastHost .toast').length===0);
  ok('T2 العابر يختفي وحده', has&&gone);
  await page.close(); }
// T3 — الحرج (err) يثبت بعد المهلة ويُغلق يدويًّا فقط
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r1=await page.evaluate(()=>{ window.__TOAST_TTL=250; window.toastErr('تعذّر الحفظ');
    const t=document.querySelector('#toastHost .toast.err');
    return {shown:!!t, x:!!(t&&t.querySelector('.tx'))}; });
  await page.waitForTimeout(700);
  const r2=await page.evaluate(()=>{
    const still=document.querySelectorAll('#toastHost .toast').length===1;
    document.querySelector('#toastHost .toast .tx').click();
    return {still, closed:document.querySelectorAll('#toastHost .toast').length===0}; });
  ok('T3 الحرج يثبت حتى الإغلاق اليدوي', r1.shown&&r1.x&&r2.still&&r2.closed);
  await page.close(); }
// T4 — التحذيري (warn) عابر بنوعه
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const has=await page.evaluate(()=>{ window.__TOAST_TTL=250; window.toastWarn('تنبيه إرشادي');
    return !!document.querySelector('#toastHost .toast.warn'); });
  await page.waitForTimeout(700);
  const gone=await page.evaluate(()=>document.querySelectorAll('#toastHost .toast').length===0);
  ok('T4 التحذيري عابر', has&&gone);
  await page.close(); }
// T5 — حدّ التراكب ٣: الرابعة تُزيح الأقدم
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{
    window.toastErr('١'); window.toastErr('٢'); window.toastErr('٣'); window.toastErr('٤');
    const list=[...document.querySelectorAll('#toastHost .toast')].map(t=>t.textContent.replace('✕','').trim());
    return {n:list.length, first:list[0], last:list[2]};
  });
  ok('T5 حدّ ٣ متراكبة والأقدم يُزاح', r.n===3&&r.first==='٢'&&r.last==='٤', JSON.stringify(r));
  await page.close(); }
// T6 — تدفق حقيقي: حارس حذف جلسة مبدوءة → toast تحذيري لا نافذة نظام
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type()); d.accept().catch(()=>{});});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[{id:'s2',name:'مبدوءة',status:'open',started:true,assignedCounters:['u_owner'],itemCount:1,__chunks:ITEMS}]});
  await page.evaluate(()=>window.__del('s2')); await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({
    warned:(document.getElementById('toastHost')||{textContent:''}).textContent.includes('لا يمكن حذف'),
    kind:!!document.querySelector('#toastHost .toast.warn'),
    kept:!!(window.__store['sessions/s2']&&window.__store['sessions/s2'].deleted!==true)}));
  ok('T6 حارس الحذف عبر toast تحذيري (لا alert) والجلسة محفوظة', r.warned&&r.kind&&r.kept&&dialogs.length===0, `dialogs=${dialogs.length}`);
  await page.close(); }
// T7 — تدفق حقيقي: بلا صلاحية → toast تحذيري وwindow.alert لا يُستدعى أبدًا
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type()); d.accept().catch(()=>{});});
  await load(page,{profile:COUNTER,users:[OWNER,COUNTER],sessions:[{id:'s3',name:'ج',status:'open',started:false,itemCount:1,__chunks:ITEMS}]});
  const r=await page.evaluate(async()=>{
    let calls=0; window.alert=()=>{calls++;};
    await window.__del('s3');
    return {calls,
      warned:(document.getElementById('toastHost')||{textContent:''}).textContent.includes('صلاحية'),
      kept:!!(window.__store['sessions/s3']&&window.__store['sessions/s3'].deleted!==true)};
  });
  ok('T7 منع الصلاحية عبر toast وalert() غير مستدعى', r.calls===0&&r.warned&&r.kept&&dialogs.length===0);
  await page.close(); }
// T8 — الأنواع الثلاثة تتعايش بألوان دلالية مميزة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{
    window.toastOk('نجاح'); window.toastWarn('تنبيه'); window.toastErr('خطأ');
    const cs=k=>getComputedStyle(document.querySelector('.toast.'+k)).borderInlineStartColor;
    const a=cs('ok'), b=cs('warn'), c=cs('err');
    return {n:document.querySelectorAll('#toastHost .toast').length, distinct:a!==b&&b!==c&&a!==c};
  });
  ok('T8 الأنواع الثلاثة معًا بألوان دلالية مميزة', r.n===3&&r.distinct);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
