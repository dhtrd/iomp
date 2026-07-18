// اختبارات الدفعة ر٢ — حوار تأكيد م١٢ (بديل confirm) في التطبيق الحي
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const ITEMS = [[{code:'A',name:'صنف أ',book:5,cost:2}]];
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1000,height:1100} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }

// G1 — الواجهة: confirmDialog معرّف ولا نافذة نظام تُطلق
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type());d.accept().catch(()=>{});});
  await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.confirmDialog({title:'س',message:'رسالة',confirmLabel:'موافق'});
    const shown=getComputedStyle(document.getElementById('cfOverlay')).display!=='none';
    const t=document.getElementById('cfTitle').textContent;
    document.getElementById('cfCancel').click();
    const res=await p;
    return {api:typeof window.confirmDialog==='function', shown, t, res:res===false};
  });
  ok('G1 حوار داخل الصفحة يُعرض ويُلغى (لا نافذة نظام)', r.api&&r.shown&&r.t==='س'&&r.res&&dialogs.length===0, `dialogs=${dialogs.length}`);
  await page.close(); }
// G2 — التأكيد يُرجع true والإلغاء false
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.confirmDialog({message:'x'}); document.getElementById('cfGo').click(); const yes=await p;
    const p2=window.confirmDialog({message:'y'}); document.getElementById('cfCancel').click(); const no=await p2;
    return {yes,no};
  });
  ok('G2 تأكيد=true وإلغاء=false', r.yes===true&&r.no===false);
  await page.close(); }
// G3 — Esc يلغي الحوار
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.confirmDialog({message:'x'});
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    return await p;
  });
  ok('G3 Esc يلغي (=false)', r===false);
  await page.close(); }
// G4 — الحساس: الزر معطّل حتى كتابة «اعتماد»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.confirmDialog({message:'حساس',sensitive:true});
    const disabled0=document.getElementById('cfGo').disabled;
    const inp=document.getElementById('cfInput'); inp.value='خطأ'; inp.dispatchEvent(new Event('input'));
    const disabled1=document.getElementById('cfGo').disabled;
    inp.value='اعتماد'; inp.dispatchEvent(new Event('input'));
    const enabled=document.getElementById('cfGo').disabled===false;
    document.getElementById('cfGo').click(); const res=await p;
    return {disabled0,disabled1,enabled,res};
  });
  ok('G4 الحساس يتطلب كتابة «اعتماد»', r.disabled0&&r.disabled1&&r.enabled&&r.res===true);
  await page.close(); }
// G5 — تدفق حقيقي: حذف الجلسة (نقل للسلة) عبر الحوار لا نافذة النظام
{ const page=await ctx.newPage(); const dialogs=[]; page.on('dialog',d=>{dialogs.push(d.type());d.accept().catch(()=>{});});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[{id:'s1',name:'للحذف',status:'open',started:false,itemCount:1,location:'فرع أ',__chunks:ITEMS}]});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.querySelector('[data-del="s1"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  const shown=await page.evaluate(()=>getComputedStyle(document.getElementById('cfOverlay')).display!=='none');
  await page.evaluate(()=>document.getElementById('cfGo').click()); await page.waitForTimeout(400);
  const soft=await page.evaluate(()=>{ const s=window.__store['sessions/s1']; return s&&s.deleted===true; });
  ok('G5 حذف الجلسة عبر الحوار المخصص', shown&&soft&&dialogs.length===0, `shown=${shown} soft=${soft} dialogs=${dialogs.length}`);
  await page.close(); }
// G6 — الإلغاء يمنع الفعل (الجلسة تبقى)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[{id:'s2',name:'تبقى',status:'open',started:false,itemCount:1,location:'فرع أ',__chunks:ITEMS}]});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(250);
  await page.evaluate(()=>{ const b=document.querySelector('[data-del="s2"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  await page.evaluate(()=>document.getElementById('cfCancel').click()); await page.waitForTimeout(300);
  const kept=await page.evaluate(()=>{ const s=window.__store['sessions/s2']; return s&&s.deleted!==true; });
  ok('G6 إلغاء الحوار يُبقي الجلسة', kept);
  await page.close(); }
// G7 — التركيز الأولي على «إلغاء» لا على الزر التدميري
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(async()=>{
    const p=window.confirmDialog({message:'x',danger:true,confirmLabel:'حذف'});
    await new Promise(r=>setTimeout(r,60));
    const focused=document.activeElement&&document.activeElement.id;
    document.getElementById('cfCancel').click(); await p;
    return focused;
  });
  ok('G7 التركيز الأولي على «إلغاء» (لا التدميري)', r==='cfCancel', r);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
