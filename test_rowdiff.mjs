// البند ١ (ورقة اتفاق معتمدة ٢١-١٠-٢٠٢٦): عند وصول تحديث (من جهاز آخر أو مسحة الجهاز نفسه) تُرسم بطاقات الأصناف التي
// تغيّر نصّها فقط — والناتج مطابق حرفًا بحرف للرسم الكامل؛ والرسم الكامل باقٍ حين تتغيّر الأصناف الظاهرة نفسها.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const N = 1500; const items=[], counts=[];
for(let i=0;i<N;i++){ const code='99'+String(i).padStart(6,'0'); items.push({code,name:'صنف رقم '+i,category:'ك'+(i%5),book:3,cost:10});
  if(i%2===0) counts.push({code,qty:2,entries:[{id:'e'+i,q:2,by:'u_o',byName:'عدّاد آخر',at:1,src:'scan',n:2}]}); }
const chunks=[]; for(let i=0;i<N;i+=400) chunks.push(items.slice(i,i+400));
const SC = { profile:OWNER, users:[OWNER], sessions:[{ id:'s', name:'جرد', status:'open', started:true, assignedCounters:['u_owner'], location:'ف', itemCount:N, __chunks:chunks, __counts:counts }] };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1440,height:900} }); const page=await ctx.newPage();
await page.goto(HARNESS+'?s='+encodeURIComponent(b64(SC))); await page.waitForFunction('window.__ready===true',{timeout:10000}); await sleep(1300);
await page.evaluate(()=>window.__openSession('s')); await page.waitForFunction(()=>window.__has('clist')); await sleep(500);
const idle=async()=>{ for(let i=0;i<300;i++){ if(await page.evaluate(()=>window.__scanIdle()))break; await sleep(10); } };
// مقارنة: ناتج المسار الجاري مقابل الرسم الكامل لنفس البيانات
const same=()=>page.evaluate(()=>{ const a=document.getElementById('clist').innerHTML; window.__rclFull(); const b=document.getElementById('clist').innerHTML; return a===b; });

// R1 — تحديثٌ من جهاز آخر يستبدل بطاقة صنفه وحدها (فحص بنيويّ حتميّ — لا يعتمد على سرعة عدّاء CI)، والزمن يُطبع للمعلومة
{ const r=await page.evaluate(async()=>{ const tick=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
    const cl=document.getElementById('clist'); let added=0, removed=0; const mo=new MutationObserver(ms=>ms.forEach(m=>{ added+=m.addedNodes.length; removed+=m.removedNodes.length; })); mo.observe(cl,{childList:true});
    window.__mockSet('sessions/s/counts/99000005',{code:'99000005',qty:42,entries:[{id:'x0',q:42,by:'o',byName:'آخر',at:2,src:'scan'}]}); await tick(); mo.disconnect();
    const live=[], full=[];
    for(let i=0;i<15;i++){ let t=performance.now(); window.__mockSet('sessions/s/counts/99000005',{code:'99000005',qty:3+i,entries:[{id:'x'+i,q:3+i,by:'o',byName:'آخر',at:2,src:'scan'}]}); await tick(); live.push(performance.now()-t);
      t=performance.now(); window.__rclFull(); await tick(); full.push(performance.now()-t); }
    live.sort((a,b)=>a-b); full.sort((a,b)=>a-b); return {added, removed, rows:cl.children.length, live:+live[7].toFixed(1), full:+full[7].toFixed(1)}; });
  ok('R1 تحديثٌ واحد من جهاز آخر يستبدل بطاقةً واحدة فقط (لا إعادة رسمٍ للـ٣٠٠)', r.added===1&&r.removed===1, JSON.stringify(r));
  console.log('   قياس R1 (مللي ثانية، الوسيط):', JSON.stringify({live:r.live,full:r.full})); }

// R2 — تطابق حرفيّ بعد ٢٠٠ عمليّة عشوائيّة (أجهزة أخرى + مسح هذا الجهاز + بحث مفعّل/غير مفعّل)
{ let seed=7; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
  let bad=0, first='';
  for(let k=0;k<200;k++){ const i=Math.floor(rnd()*60), code='99'+String(i).padStart(6,'0'), r=rnd();
    if(r<0.35) await page.evaluate(([c,k])=>window.__mockSet('sessions/s/counts/'+c,{code:c,qty:k%7+1,entries:[{id:'r'+k,q:k%7+1,by:'o',byName:'جهاز آخر',at:k,src:k%2?'scan':'manual'}]}),[code,k]);
    else if(r<0.45) await page.evaluate((c)=>window.__mockSet('sessions/s/counts/'+c,null),code);
    else if(r<0.75){ await page.evaluate((c)=>window.__scanCommit(c,'field'),code); await idle(); }
    else if(r<0.85) await page.evaluate((v)=>{ const s=document.getElementById('csearch'); s.value=v; s.dispatchEvent(new Event('input',{bubbles:true})); }, rnd()<0.5?'':'9900000');
    else await page.evaluate(([c,k])=>window.__mockSet('sessions/s/counts/'+c,{code:c,qty:2,entries:[{id:'m'+k,q:1,by:'o',byName:'آخر',at:k,src:'scan'},{id:'n'+k,q:1,by:'p',byName:'ثالث',at:k+1,src:'manual'}]}),[code,k]);
    await sleep(15); await idle(); await sleep(80);
    if(!(await same())){ bad++; if(!first)first='k='+k+' r='+r.toFixed(2)+' code='+code; } }
  ok('R2 بعد ٢٠٠ عمليّة عشوائيّة: القائمة مطابقة حرفًا بحرف للرسم الكامل', bad===0, 'mismatches='+bad+' first: '+first); }

// R3 — ما يكتبه العدّاد لا يضيع: كمية في «أضف» وملاحظة قيد الكتابة تبقيان مع تركيزهما حين يُرقَّع صفّهما أو غيره
{ await page.evaluate(()=>{ const s=document.getElementById('csearch'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(300);
  await page.evaluate(()=>{ const p=document.querySelector('[data-row="99000010"] .padd'); p.focus(); p.value='7'; });
  await page.evaluate(()=>window.__mockSet('sessions/s/counts/99000010',{code:'99000010',qty:9,entries:[{id:'z1',q:9,by:'o',byName:'آخر',at:5,src:'scan'}]})); await sleep(150);
  await page.evaluate(()=>window.__mockSet('sessions/s/counts/99000012',{code:'99000012',qty:4,entries:[{id:'z2',q:4,by:'o',byName:'آخر',at:6,src:'scan'}]})); await sleep(150);
  const st=await page.evaluate(()=>{ const p=document.querySelector('[data-row="99000010"] .padd'); return {v:p&&p.value, f:document.activeElement===p, total:document.querySelector('[data-row="99000010"]').textContent.includes('الإجمالي: 9')}; });
  ok('R3 قيمة «أضف» (٧) وتركيزها باقيان بعد ترقيع صفّها وصفّ آخر، والإجمالي الجديد ظاهر (٩)', st.v==='7'&&st.f&&st.total, JSON.stringify(st)); }

// R4 — الأصناف الظاهرة تتغيّر (صنفٌ يدويّ جديد يُضاف للقائمة) ⇒ رسمٌ كامل صحيح
{ await page.evaluate(()=>{ const s=document.getElementById('csearch'); s.value='X99'; s.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(300);
  await page.evaluate(()=>window.__mockSet('sessions/s/extraItems/X999',{code:'X999',name:'صنف أضيف يدويًّا',category:'ك',book:null})); await sleep(300);
  const has=await page.evaluate(()=>!!document.querySelector('[data-row="X999"]'));
  ok('R4 صنف جديد في القائمة يظهر (رسم كامل عند تغيّر الأصناف الظاهرة) والناتج مطابق', has&&(await same()), 'has='+has); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
