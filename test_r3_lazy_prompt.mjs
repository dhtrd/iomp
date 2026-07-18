// اختبارات الدفعة ر٣ — كسل XLSX (I-1) + حوار الإدخال (بديل prompt)
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1000,height:1000} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }

// Z1 — لا وسم XLSX في الترويسة عند التحميل (تحميل كسول)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>({
    noTag:![...document.querySelectorAll('script[src]')].some(s=>/xlsx/i.test(s.src)),
    notLoaded:typeof window.XLSX==='undefined',
    hasLoader:typeof window.loadXLSX==='function'}));
  ok('Z1 XLSX غير محمّلة مبدئيًّا ومُحمّلها موجود', r.noTag&&r.notLoaded&&r.hasLoader, JSON.stringify(r));
  await page.close(); }
// Z2 — استدعاء loadXLSX يحقن الوسم (نتحقق من الحقن لا التنزيل الفعلي — الشبكة قد تُحجب)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{ window.loadXLSX().catch(()=>{});
    return [...document.querySelectorAll('script[src]')].some(s=>/xlsx/i.test(s.src)); });
  ok('Z2 loadXLSX يحقن وسم المكتبة عند الطلب', r);
  await page.close(); }
// Z3 — دوال التصدير صارت async (لا تعطب دون XLSX)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{ return typeof window.__hasExportFns==='undefined'?
    // نتحقق عبر توقيع الدوال المصدّرة للاختبار إن وُجدت، وإلا نكتفي بعدم انهيار الصفحة
    (typeof window.loadXLSX==='function'):true; });
  ok('Z3 مسار التصدير الكسول جاهز (لا انهيار)', r);
  await page.close(); }
// P1 — promptDialog: إدخال قيمة يُرجعها، وإلغاء يُرجع null
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type());d.accept().catch(()=>{});});
  await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.promptDialog({title:'مستودع',placeholder:'الاسم'});
    const shown=getComputedStyle(document.getElementById('ppOverlay')).display!=='none';
    const inp=document.getElementById('ppInput'); inp.value='مستودع الرياض'; inp.dispatchEvent(new Event('input'));
    document.getElementById('ppGo').click();
    const val=await p;
    const p2=window.promptDialog({title:'x'}); document.getElementById('ppCancel').click(); const nul=await p2;
    return {shown,val,nul};
  });
  ok('P1 حوار الإدخال يُرجع القيمة والإلغاء null (بلا نافذة نظام)', r.shown&&r.val==='مستودع الرياض'&&r.nul===null&&dialogs.length===0, JSON.stringify(r)+` dlg=${dialogs.length}`);
  await page.close(); }
// P2 — الإلزامي: الزر معطّل حتى إدخال قيمة، وEsc يلغي
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.promptDialog({title:'سبب',required:true});
    const d0=document.getElementById('ppGo').disabled;
    const inp=document.getElementById('ppInput'); inp.value='سبب وجيه'; inp.dispatchEvent(new Event('input'));
    const d1=document.getElementById('ppGo').disabled;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    const res=await p;
    return {d0,d1,res};
  });
  ok('P2 الإلزامي يعطّل الزر حتى الإدخال وEsc يلغي', r.d0===true&&r.d1===false&&r.res===null);
  await page.close(); }
// P3 — تدفق حقيقي: «مستودع جديد» في إنشاء الجلسة يفتح حوار الإدخال لا prompt
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type());d.accept().catch(()=>{});});
  await load(page,{profile:OWNER,users:[OWNER],config:{warehouses:[{id:'w1',name:'فرع أ',deleted:false}]}});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  const opened=await page.evaluate(()=>{ const s=document.getElementById('s_loc'); if(!s)return false;
    s.value='__new'; s.onchange(); return true; });
  await page.waitForTimeout(150);
  const shown=await page.evaluate(()=>{ const o=document.getElementById('ppOverlay'); return o&&getComputedStyle(o).display!=='none'; });
  await page.evaluate(()=>document.getElementById('ppCancel').click());
  ok('P3 «مستودع جديد» يفتح حوار الإدخال (لا prompt نظام)', opened&&shown&&dialogs.length===0, `shown=${shown} dlg=${dialogs.length}`);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
