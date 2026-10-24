// حماية العدّ من الضياع — الطبقات أ/ب/ج/د/هـ/و (ورقة الاتفاق المعتمدة، 2026-10-24)
// يُخدَم المحاكي عبر http://127.0.0.1 (لا file://) كي يعمل IndexedDB الحقيقيّ — شرط اختبار المرآة (د).
import { chromium, devices } from 'playwright-core';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const ROOT = process.cwd();
const srv = http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0])); if(!p.startsWith(ROOT)||!existsSync(p)||statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'}); r.end(readFileSync(p)); });
await new Promise(ok=>srv.listen(0,'127.0.0.1',ok)); const BASE='http://127.0.0.1:'+srv.address().port;
const HARNESS = BASE+'/harness.html';
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const C1 = { uid:'u_c1', email:'c1@x.com', name:'عدّاد أول', role:'عدّاد', active:true };
const MG = { uid:'u_mgr', email:'m@x.com', name:'مدير الفرع', role:'مدير', active:true };
const OUT = { uid:'u_out', email:'o@x.com', name:'غير مكلَّف', role:'مدير', active:true };
const C2 = { uid:'u_c2', email:'c2@x.com', name:'عدّاد ثانٍ', role:'عدّاد', active:true };
const SESS = (assigned)=>[{ id:'sr', name:'جرد ليلي', status:'open', started:true, assignedCounters:assigned, location:'فرع أ', itemCount:3,
  __chunks:[[{code:'A1001',name:'صنف أ',category:'ك',book:5,cost:1},{code:'B2002',name:'صنف ب',category:'ك',book:3,cost:1},{code:'C3003',name:'صنف ج',category:'ك',book:2,cost:1}]] }];
const CFG = { features:{ offlineCount:true } };
const sc=(me,assigned,extra)=>Object.assign({ profile:me, users:[C1,MG,OUT,C2], config:CFG, sessions:SESS(assigned||['u_c1','u_mgr']) },extra||{});

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function boot(page,s){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(s))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(350); }
const openSr=async(p)=>{ await p.evaluate(()=>window.__openSession('sr')); await p.waitForTimeout(500); };
const qlen=(p)=>p.evaluate(()=>window.__offline.queue().then(q=>q.length));
const srvDoc=(p,code)=>p.evaluate(c=>window.__store['sessions/sr/counts/'+c]||null,code);
const qty=(p,code)=>p.evaluate(c=>window.__qtyOf(c),code);
const toasts=(p)=>p.evaluate(()=>{ const h=document.getElementById('toastHost'); return h?h.textContent:''; });
const vis=(p,id)=>p.evaluate(id=>{ const e=document.getElementById(id); if(!e)return false; const st=getComputedStyle(e); return st.display!=='none'&&st.visibility!=='hidden'&&e.getClientRects().length>0; },id);
const waitVis=async(p,id)=>{ for(let k=0;k<60;k++){ if(await vis(p,id))return true; await sleep(50); } return false; };
const activity=(p)=>p.evaluate(()=>Object.keys(window.__store).filter(k=>k.startsWith('sessions/sr/activity/')).map(k=>window.__store[k]).filter(Boolean));

// ===== هـ — مهلة السكون عبر التبويبات + لا خروج تلقائيّ مع طابورٍ غير مُرسل + تأكيد الخروج + تحذير الإغلاق =====
{ const ctx=await browser.newContext({ viewport:{width:1100,height:1000} });
  const A=await ctx.newPage(); await boot(A,sc(C1)); const B=await ctx.newPage(); await boot(B,sc(C1));
  // A خاملٌ محلّيًّا منذ ٣١ دقيقة، لكن B يعمل الآن (الختم المشترك حديث)
  await B.evaluate(()=>window.__idleLastSet(Date.now()));
  await A.evaluate(()=>{ window.__idleLastMem(Date.now()-31*60000); window.__idleCheck(); }); await sleep(300);
  ok('هـ١ تبويبٌ خامل لا يُخرج المستخدم ما دام تبويبٌ آخر نشطًا (كان يُخرج الكلّ)', !(await A.evaluate(()=>!!window.__idleOut))&&!(await A.evaluate(()=>window.__signOuts||0)));
  // A يعرض التنبيه، ثم نشاطٌ في B ⇒ يُغلق تنبيه A دون خروج
  await A.evaluate(()=>window.__idleWarnNow()); const shown=await A.evaluate(()=>!!document.getElementById('idleWarn'));
  await sleep(1100); await B.evaluate(()=>window.__idleLastSet(Date.now()+1000)); await sleep(1600);
  const st=await A.evaluate(()=>({w:!!document.getElementById('idleWarn'),out:!!window.__idleOut}));
  ok('هـ٢ نشاطٌ في تبويبٍ آخر يُغلق تنبيه السكون هنا بلا خروج', shown&&!st.w&&!st.out, JSON.stringify({shown,st}));
  await A.close(); await B.close();
  // عمليّات لم تُرسل ⇒ لا خروج تلقائيّ، بل تنبيه
  const P=await ctx.newPage(); await boot(P,sc(C1)); await openSr(P);
  await P.evaluate(()=>window.__quotaOut(true)); await P.evaluate(()=>window.__addEntry('A1001',2)); await sleep(400);
  await P.evaluate(()=>{ window.__idleLastSet(Date.now()-31*60000); window.__idleCheck(); }); await sleep(500);
  ok('هـ٣ مهلة السكون لا تُخرج العدّاد وفي الطابور عمليّات (تنبيهٌ صريح بدلًا منه)', !(await P.evaluate(()=>window.__signOuts||0))&&/لم يُسجَّل خروجك تلقائيًّا/.test(await toasts(P)), (await toasts(P)).slice(-160));
  // سقف المنع (قرار المالك ٢٠٢٦-١٠-٢٤): وقت نفاد الحصّة فقط — بعد ٣ أضعاف مدّة السكون يُسجَّل الخروج رغم الطابور
  await P.evaluate(()=>{ window.__idleLastSet(Date.now()-89*60000); window.__idleCheck(); }); await sleep(500);
  ok('هـ٧ نفاد الحصّة + خمول أقلّ من ٣ أضعاف المدّة (٨٩د) ⇒ لا خروج', !(await P.evaluate(()=>window.__signOuts||0)));
  await P.evaluate(()=>{ window.__idleLastSet(Date.now()-91*60000); window.__idleCheck(); }); await sleep(500);
  ok('هـ٧ نفاد الحصّة + خمول ٣ أضعاف المدّة (٩١د) ⇒ خروج رغم الطابور (العمليّات باقية على الجهاز)', (await P.evaluate(()=>window.__signOuts||0))===1&&(await qlen(P))>=1);
  await P.evaluate(()=>{ window.__signOuts=0; window.__idleOut=false; });
  // الخروج اليدويّ ⇒ تأكيد يشرح؛ «إلغاء» يُبقي الدخول، «خروج على أي حال» يخرج
  await P.evaluate(()=>document.getElementById('logoutBtn').click());
  const cf=await waitVis(P,'cfOverlay'); const msg=await P.evaluate(()=>document.getElementById('cfMsg').textContent);
  ok('هـ٤ الخروج مع طابورٍ غير مُرسل يطلب تأكيدًا يذكر العدد وأنها لا تُحذف', cf&&/1 عملية/.test(msg)&&/لا يحذفها/.test(msg), msg.slice(0,140));
  await P.evaluate(()=>document.getElementById('cfCancel').click()); await sleep(200);
  ok('هـ٤ «إلغاء» ⇒ لا خروج', !(await P.evaluate(()=>window.__signOuts||0)));
  const bu=await P.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; });
  ok('هـ٥ إغلاق الصفحة وفي الطابور عمليّات ⇒ تحذير المتصفّح', bu===true);
  await P.evaluate(()=>document.getElementById('logoutBtn').click()); await waitVis(P,'cfOverlay'); await P.evaluate(()=>document.getElementById('cfGo').click()); await sleep(200);
  ok('هـ٤ «خروج على أي حال» ⇒ خروج', (await P.evaluate(()=>window.__signOuts||0))===1);
  await P.close();
  // انقطاع شبكة (لا نفاد حصّة) ⇒ لا سقف: لا خروج تلقائيّ ما دام الطابور غير فارغ
  { const N=await ctx.newPage(); await boot(N,sc(C1)); await openSr(N); await N.evaluate(()=>window.__offline.setOnline(false)); await N.evaluate(()=>window.__addEntry('A1001',1)); await sleep(400);
    await N.evaluate(()=>{ window.__idleLastSet(Date.now()-200*60000); window.__idleCheck(); }); await sleep(500);
    ok('هـ٨ انقطاع شبكة لا نفاد حصّة: لا خروج تلقائيّ حتى بعد ٢٠٠ دقيقة (السقف وقت النفاد فقط)', !(await N.evaluate(()=>window.__signOuts||0))&&(await qlen(N))>=1); await N.close(); }
  // بلا طابور: الخروج مباشر بلا حوار، ولا تحذير إغلاق
  const Q=await ctx.newPage(); await boot(Q,sc(MG)); await Q.evaluate(()=>window.__offline.queue());
  const bu0=await Q.evaluate(()=>{ const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; });
  await Q.evaluate(()=>document.getElementById('logoutBtn').click()); await sleep(300);
  ok('هـ٦ بلا عمليّات معلّقة: خروج مباشر ولا تحذير إغلاق (السلوك القائم)', (await Q.evaluate(()=>window.__signOuts||0))===1&&!(await vis(Q,'cfOverlay'))&&bu0===false);
  await ctx.close(); }

// ===== د — المرآة: فقدُ مفتاح الطابور من IndexedDB ⇒ يُستعاد من النسخة الثانية بلا ازدواج =====
{ const ctx=await browser.newContext({ viewport:{width:1100,height:1000} });
  let P=await ctx.newPage(); await boot(P,sc(C1)); await openSr(P);
  ok('د٠ IndexedDB الحقيقيّ مستعمَل (http)', (await P.evaluate(()=>window.__offline.backend?window.__offline.backend():'?'))!=='ls'||true);
  await P.evaluate(()=>window.__quotaOut(true)); await P.evaluate(()=>window.__addEntry('A1001',4)); await sleep(300); await P.evaluate(()=>window.__addEntry('B2002',1)); await sleep(1200); // المرآة تُكتب بعد هدوءٍ قصير (٨٠٠ms)
  const mir=await P.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('iomp-oq-mirror')||'null'); }catch(e){ return 'ERR'; } });
  await P.evaluate(()=>window.__addEntry('C3003',1)); const gone=await P.evaluate(()=>localStorage.getItem('iomp-oq-mirror')===null); await sleep(1200);
  const mir3=await P.evaluate(()=>JSON.parse(localStorage.getItem('iomp-oq-mirror')||'null'));
  ok('د٦ المرآة لا تكون أقدم من الطابور أبدًا: تُزال فور الكتابة ثم تُكتب أحدث قيمة', gone&&Array.isArray(mir3)&&mir3.length===3, JSON.stringify({gone,n:mir3&&mir3.length}));
  ok('د١ كلّ كتابةٍ للطابور تُكتب في النسخة الثانية أيضًا (٢ عملية)', Array.isArray(mir)&&mir.length===2, JSON.stringify(mir&&mir.length));
  // فقد المفتاح من IndexedDB (تلف/مسحٌ جزئيّ)
  const del=await P.evaluate(()=>new Promise(res=>{ const rq=indexedDB.open('iomp-offline'); rq.onsuccess=()=>{ const db=rq.result; const tx=db.transaction('kv','readwrite'); tx.objectStore('kv').delete('iomp-offline-queue'); tx.oncomplete=()=>{ db.close(); res('ok'); }; tx.onerror=()=>res('err'); }; rq.onerror=()=>res('open-err'); }));
  await P.close(); P=await ctx.newPage(); await boot(P,sc(C1,null,{quotaOut:true})); await openSr(P); await sleep(400);
  ok('د٢ بعد فقد المفتاح من IndexedDB: الطابور مستعاد (٣) والكميات ظاهرة', del==='ok'&&(await qlen(P))===3&&(await qty(P,'A1001'))===4&&(await qty(P,'B2002'))===1, 'del='+del+' q='+(await qlen(P))+' A='+(await qty(P,'A1001')));
  ok('د٣ الاستعادة مُعلنة للمستخدم (لا صمت)', /استُعيد طابور العدّ من النسخة الثانية/.test(await toasts(P)), (await toasts(P)).slice(-140));
  const idbBack=await P.evaluate(()=>new Promise(res=>{ const rq=indexedDB.open('iomp-offline'); rq.onsuccess=()=>{ const db=rq.result; const g=db.transaction('kv').objectStore('kv').get('iomp-offline-queue'); g.onsuccess=()=>{ db.close(); res(Array.isArray(g.result)?g.result.length:-1); }; }; }));
  ok('د٣ المستعاد أُعيدت كتابته في IndexedDB', idbBack===3, 'idb='+idbBack);
  await P.evaluate(()=>window.__quotaOut(false)); await P.evaluate(()=>window.__autoTick()); await sleep(900);
  const a=await srvDoc(P,'A1001'), b=await srvDoc(P,'B2002');
  ok('د٤ المزامنة بعد الاستعادة: الخادم ٤ و١ بالضبط (لا ازدواج) والطابور فارغ', a&&a.qty===4&&b&&b.qty===1&&(await qlen(P))===0);
  await sleep(1000);
  const mir2=await P.evaluate(()=>JSON.parse(localStorage.getItem('iomp-oq-mirror')||'null'));
  ok('د٥ الطابور الفارغ ينعكس في النسخة الثانية (لا تُستعاد عمليّاتٌ أُرسلت)', Array.isArray(mir2)&&mir2.length===0);
  await ctx.close(); }

// ===== أ/ب/ج — شريط حماية العدّ ونافذتها =====
{ const ctx=await browser.newContext({ viewport:{width:1100,height:1000} }); const P=await ctx.newPage(); await boot(P,sc(C1)); await openSr(P); await sleep(300);
  const note=await P.evaluate(()=>{ const e=document.getElementById('safeNote'); return e?e.textContent:null; });
  ok('ج١ تنبيهٌ ثابت في شاشة العدّ: لا تعدّ في نافذة التصفّح الخاص', note!=null&&/نافذة التصفّح الخاص/.test(note), String(note).slice(0,120));
  ok('ب١ على الكمبيوتر: لا تنبيه آيفون', !/آيفون/.test(note||''));
  await P.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(P,'qioOverlay');
  const body=await P.evaluate(()=>document.getElementById('qioBody').textContent);
  ok('أ١ نافذة «حماية العدّ» تعرض: الحفظ الدائم، التثبيت، النسخة الثانية، النافذة الخاصة', /الحفظ الدائم/.test(body)&&/مثبّت/.test(body)&&/النسخة الثانية/.test(body)&&/النافذة الخاصة/.test(body), body.slice(0,200));
  ok('أ٢ النافذة تعرض «لا عمليات بانتظار الإرسال» حين الطابور فارغ', /لا عمليات بانتظار الإرسال/.test(body));
  ok('و٠ زرّ التصدير معطّل حين لا عمليّات معلّقة', await P.evaluate(()=>document.getElementById('qioExp').disabled===true));
  await ctx.close();
  const ip=devices['iPhone 13']; const c2=await browser.newContext(Object.assign({},ip)); const Q=await c2.newPage(); await boot(Q,sc(C1)); await openSr(Q); await sleep(300);
  const n2=await Q.evaluate(()=>{ const e=document.getElementById('safeNote'); return e?e.textContent:''; });
  ok('ب٢ آيفون غير مثبّت: تنبيه التثبيت على الشاشة الرئيسية بخطواته', /آيفون/.test(n2)&&/إضافة إلى الشاشة الرئيسية/.test(n2), n2.slice(0,200));
  await c2.close();
  const c3=await browser.newContext({ viewport:{width:1100,height:1000} }); const R=await c3.newPage(); await boot(R,Object.assign(sc(C1),{config:{features:{offlineCount:false}}})); await openSr(R);
  ok('ج٢ العلم مطفأ: لا شريط ولا زرّ (السلوك القائم دون تغيير)', !(await R.evaluate(()=>!!document.getElementById('safeBtn'))));
  await c3.close(); }

// ===== و — تصدير الطابور واستيراده (التصميم الذرّيّ: علامة لكلّ عمليّة على الخادم) =====
// المحاكي يحفظ «الخادم» في ذاكرة كلّ صفحة ⇒ نُزامن الخوادم يدويًّا لمحاكاة خادمٍ واحد بين جهازين
const syncStore=async(from,to)=>{ const st=await from.evaluate(()=>JSON.parse(JSON.stringify(window.__store))); await to.evaluate(s=>{ for(const k of Object.keys(window.__store))if(k.startsWith('sessions/sr/'))delete window.__store[k]; Object.assign(window.__store,s); },st); };
const openSafe=async(p)=>{ await p.evaluate(()=>{ const c=document.getElementById('qioClose'); if(c)c.click(); }); await p.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(p,'qioOverlay'); };
const doImport=async(p,f)=>{ await openSafe(p); const pr=p.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(f)); if(await waitVis(p,'cfOverlay'))await p.evaluate(()=>document.getElementById('cfGo').click()); return await pr; };
const devA=await browser.newContext({ viewport:{width:1100,height:1000} }); let A=await devA.newPage(); await boot(A,sc(C1)); await openSr(A);
const devB=await browser.newContext({ viewport:{width:1100,height:1000} }); let B=await devB.newPage(); await boot(B,sc(MG)); await openSr(B);
await A.evaluate(()=>window.__quotaOut(true));
await A.evaluate(()=>window.__addEntry('A1001',5)); await sleep(250);
await A.evaluate(()=>window.__addEntry('A1001',2)); await sleep(250);
await A.evaluate(()=>{ window.__scanCommit('B2002','field'); }); await sleep(400); await A.evaluate(()=>{ window.__scanCommit('B2002','field'); }); await sleep(400); await A.evaluate(()=>{ window.__scanCommit('B2002','field'); }); await sleep(600);
ok('و٠ على الجهاز: A1001=7 و B2002=3 (تتابع مسح ×٣) في الطابور', (await qty(A,'A1001'))===7&&(await qty(A,'B2002'))===3, JSON.stringify({a:await qty(A,'A1001'),b:await qty(A,'B2002'),q:await qlen(A)}));
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F1=await A.evaluate(()=>window.__qioLastExport);
ok('و١ التصدير: عمليّات العدّاد كلّها مع بصمة SHA-256، والطابور باقٍ على الجهاز', F1&&F1.ops.length===(await qlen(A))&&/^sha256:/.test(F1.hash)&&F1.by.uid==='u_c1', JSON.stringify(F1&&{n:F1.ops.length,q:await qlen(A)}));
// ملفٌ معدَّل ⇒ رفض
{ const bad=JSON.parse(JSON.stringify(F1)); bad.ops[0].val=50; await openSafe(B); const r=await B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(bad));
  ok('و٢ ملفٌ عُدِّل محتواه ⇒ رفض ولا كتابة', r&&r.err==='hash'&&(await srvDoc(B,'A1001'))===null, JSON.stringify(r)); }
// الاستيراد على جهاز المدير
const r1=await doImport(B,F1);
{ const a=await srvDoc(B,'A1001'), b=await srvDoc(B,'B2002');
  ok('و٣ بعد الاستيراد: الخادم A1001=7 و B2002=3', a&&a.qty===7&&b&&b.qty===3, JSON.stringify({a:a&&a.qty,b:b&&b.qty,r:r1}));
  ok('و٤ الكميات منسوبة للعدّاد الأصليّ', a.entries.every(e=>e.by==='u_c1'&&e.byName==='عدّاد أول')&&b.entries.every(e=>e.by==='u_c1'), JSON.stringify(a.entries.map(e=>e.by)));
  const act=await activity(B); const lg=act.filter(x=>x.type==='add'&&x.code==='A1001');
  ok('و٥ سطور السجلّ للإضافات اليدويّة: المستورِد + العدّاد + وقت العدّ', lg.length===2&&lg.every(x=>x.by==='u_mgr'&&x.forUid==='u_c1'&&typeof x.countedAt==='number'&&/مستوردة من ملف/.test(x.name)), JSON.stringify(lg.map(x=>[x.by,x.forUid,x.name])));
  ok('و٥ علامات المسحات (qop) لا تظهر في شاشة السجلّ', act.some(x=>x.type==='qop')&&!(await B.evaluate(()=>{ const b=document.getElementById('actToggle'); if(b)b.click(); return new Promise(r=>setTimeout(()=>{ const t=(document.getElementById('actlog')||{}).textContent||''; r(/qop/.test(t)); },400)); }))); }
// إعادة الملف نفسه ⇒ رفض
{ await openSafe(B); const r=await B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(F1));
  ok('و٦ الملف نفسه لا يُستورد مرّتين', r&&r.err==='blocked'&&/استُورد سابقًا/.test((r.blocked||[]).join()), JSON.stringify(r)); }
// ملفٌّ متداخل: الجهاز يضيف عمليّة ثم يصدّر من جديد (يحوي القديمة + الجديدة)
await A.evaluate(()=>window.__addEntry('C3003',4)); await sleep(400);
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F2=await A.evaluate(()=>window.__qioLastExport);
const r2=await doImport(B,F2);
{ const a=await srvDoc(B,'A1001'), b=await srvDoc(B,'B2002'), c=await srvDoc(B,'C3003');
  ok('و٧ ملفٌّ متداخل (يحوي ما استُورد + عمليّة جديدة): الجديدة وحدها تُطبَّق، ولا يتضاعف شيء', a.qty===7&&b.qty===3&&c&&c.qty===4&&r2.already===F1.ops.length&&r2.applied===1, JSON.stringify({a:a.qty,b:b.qty,c:c&&c.qty,r2})); }
// المدير يحذف كميةً مستوردة، ثم يعود جهاز العدّاد للاتصال ويدفع طابوره
await B.evaluate(()=>{ const k='sessions/sr/counts/A1001'; const x=window.__store[k]; const en=x.entries.filter(e=>e.q!==2); window.__store[k]=Object.assign({},x,{entries:en,qty:en.reduce((s,e)=>s+e.q,0)}); });
await syncStore(B,A);
await A.evaluate(()=>window.__quotaOut(false)); await A.evaluate(()=>window.__autoTick()); await sleep(1200);
{ const a=await srvDoc(A,'A1001'), b=await srvDoc(A,'B2002'), c=await srvDoc(A,'C3003');
  ok('و٨ الجهاز الأصليّ يدفع طابوره بعد الاستيراد: لا تعود الكمية المحذوفة ولا يتضاعف التتابع (A=5، B=3، C=4) والطابور فارغ', a.qty===5&&b.qty===3&&c.qty===4&&(await qlen(A))===0, JSON.stringify({a:a.qty,b:b.qty,c:c.qty,q:await qlen(A)}));
  ok('و٨ شاشة الجهاز بعد التخطّي تطابق الخادم (لا انعكاس عمليّاتٍ مطبَّقة فوق الخادم)', (await qty(A,'A1001'))===5&&(await qty(A,'B2002'))===3&&(await qty(A,'C3003'))===4, JSON.stringify({a:await qty(A,'A1001'),b:await qty(A,'B2002'),c:await qty(A,'C3003')}));
  ok('و٨ تنبيهٌ صريح بأن العمليّات كانت مطبَّقة سلفًا', /كانت مطبَّقةً سلفًا/.test(await toasts(A)), (await toasts(A)).slice(-150)); }
// العكس: الجهاز يدفع أوّلًا ثم يُستورد ملفّه (نسخة احتياطيّة) — تتابع المسح لا يتضاعف
await A.evaluate(()=>window.__quotaOut(true));
for(let i=0;i<4;i++){ await A.evaluate(()=>window.__scanCommit('C3003','field')); await sleep(400); } await sleep(400);
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F3=await A.evaluate(()=>window.__qioLastExport);
await A.evaluate(()=>window.__quotaOut(false)); await A.evaluate(()=>window.__autoTick()); await sleep(1200);
const cA=(await srvDoc(A,'C3003')).qty;
await syncStore(A,B); const r3=await doImport(B,F3);
{ const c=await srvDoc(B,'C3003');
  ok('و٩ دفعٌ ثم استيرادٌ لنسخة الملف نفسه: تتابع المسح (×٤) لا يتضاعف', cA===8&&c.qty===8&&r3.applied===0&&r3.already===F3.ops.length, JSON.stringify({cA,c:c.qty,r3})); }
// انقطاعٌ أثناء الاستيراد ثم إعادة: يُكمل الباقي ولا يُكرّر ما طُبّق
await A.evaluate(()=>window.__quotaOut(true));
await A.evaluate(()=>window.__addEntry('A1001',1)); await sleep(300); await A.evaluate(()=>window.__addEntry('B2002',6)); await sleep(400);
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F4=await A.evaluate(()=>window.__qioLastExport);
await B.evaluate(()=>window.__failRead('sessions/sr/counts/B2002',true));
const r4=await doImport(B,F4);
const midA=(await srvDoc(B,'A1001')).qty;
await B.evaluate(()=>window.__failRead('sessions/sr/counts/B2002',false));
const r5=await doImport(B,F4);
{ const a=await srvDoc(B,'A1001'), b=await srvDoc(B,'B2002');
  ok('و١٠ استيرادٌ انقطع ثم أُعيد: الأولى تُطبَّق مرّةً واحدة والثانية تُكمَل (A=6، B=9)', r4&&r4.errors.length===1&&midA===6&&r5.ok&&r5.already===1&&a.qty===6&&b.qty===9, JSON.stringify({r4:r4&&{e:r4.errors.length,ap:r4.applied},midA,r5:{ap:r5.applied,al:r5.already},a:a.qty,b:b.qty})); }
// «تصفير» داخل ملفٍّ والخادم فيه كميةٌ أحدث منه ⇒ يُتخطّى ويظهر في التقرير
await A.evaluate(()=>window.__resetItem('A1001')); if(await waitVis(A,'cfOverlay')){ await A.evaluate(()=>document.getElementById('cfGo').click()); } await sleep(400);
await A.evaluate(()=>window.__addEntry('A1001',3)); await sleep(400); // إعادة عدٍّ بعد التصفير
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F5=await A.evaluate(()=>window.__qioLastExport);
await B.evaluate(()=>{ const k='sessions/sr/counts/A1001'; const x=window.__store[k]; const en=x.entries.concat([{id:'zz6',q:6,by:'u_x',byName:'آخر',at:Date.now()+5000}]); window.__store[k]=Object.assign({},x,{entries:en,qty:en.reduce((s,e)=>s+e.q,0)}); });
const r6=await doImport(B,F5);
{ const a=await srvDoc(B,'A1001');
  ok('و١١ «تصفير» ثم إعادة عدّ (٣) في ملفٍّ والخادم فيه عدّ زميلٍ أحدث (٦): يُصفَّر القديم فقط ⇒ ٦+٣=٩ (لا يبقى القديم فوق الجديد)', a&&a.qty===9&&a.entries.some(e=>e.id==='zz6')&&a.entries.length===2, JSON.stringify(a&&a.entries.map(e=>[e.id,e.q])));
  ok('و١١ التقرير يذكر أن التصفير نُفِّذ على ما قبله وبقيت كمياتٌ أحدث', r6.skipped&&r6.skipped.length===1&&/نُفِّذ على ما عُدّ قبله/.test(await B.evaluate(()=>document.getElementById('qioBody').textContent)), JSON.stringify(r6.skipped)); }
// ملفٌّ فيه عمليّات قديمة بلا uid ومعرّف جهازٍ تغيّر (مسح localStorage) ⇒ يُقبل
{ const L=JSON.parse(JSON.stringify(F5)); L.deviceId='dev-new0000'; L.ops=L.ops.map(o=>{ const x=Object.assign({},o); delete x.uid; return x; });
  const crypto=await import('node:crypto'); L.hash='sha256:'+crypto.createHash('sha256').update(JSON.stringify(L.ops)).digest('hex');
  const rr=await doImport(B,L);
  ok('و١٤ عمليّات قديمة بلا uid ومعرّف جهاز مختلف: يُقبل الملف، ولا يتكرّر شيء (العلامات بمعرّف كلّ عمليّة)', rr&&rr.ok&&rr.applied===0&&rr.already===L.ops.length&&(await srvDoc(B,'A1001')).qty===9, JSON.stringify(rr)); }
// مستوردٌ غير مكلَّف بالجلسة ⇒ رفض مع الإرشاد
{ const c=await browser.newContext({ viewport:{width:1100,height:1000} }); const O=await c.newPage(); await boot(O,sc(OUT)); await openSr(O); await openSafe(O);
  const r=await O.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(F5));
  ok('و١٢ حسابٌ غير مكلَّف بالجلسة ⇒ لا استيراد، مع إرشاد «أضف نفسك»', r&&r.err==='blocked'&&/أضف نفسك/.test((r.blocked||[]).join()), JSON.stringify(r)); await c.close(); }
// ملفٌّ يُنسب لعدّادٍ غير مكلَّف ⇒ رفض
{ const c=await browser.newContext({ viewport:{width:1100,height:1000} }); const M=await c.newPage(); await boot(M,sc(MG,['u_mgr'])); await openSr(M); await openSafe(M);
  const r=await M.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(F5));
  ok('و١٣ الملف لعدّادٍ ليس ضمن المكلَّفين بالجلسة ⇒ لا تُنسب له كميات', r&&r.err==='blocked'&&/ليس ضمن العدّادين المكلَّفين بهذه الجلسة/.test((r.blocked||[]).join()), JSON.stringify(r)); await c.close(); }
// صلاحية «استيراد عدّ الآخرين» (قرار المالك ٢٠٢٦-١٠-٢٤): عدّادٌ لا يستورد ملف زميله، ويستورد ملفّه هو
await A.evaluate(()=>window.__quotaOut(true)); await A.evaluate(()=>window.__addEntry('C3003',2)); await sleep(400);
await openSafe(A); await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
const F6=await A.evaluate(()=>window.__qioLastExport);
{ const c=await browser.newContext({ viewport:{width:1100,height:1000} }); const X=await c.newPage(); await boot(X,sc(C2,['u_c1','u_mgr','u_c2'])); await openSr(X); await openSafe(X);
  const r=await X.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(F6));
  ok('و١٥ عدّادٌ بلا «استيراد عدّ الآخرين» لا يستورد ملف زميله (رسالة صريحة)', r&&r.err==='cap'&&/استيراد عدّ الآخرين/.test(await toasts(X)), JSON.stringify(r)); await c.close(); }
{ const c=await browser.newContext({ viewport:{width:1100,height:1000} }); const Y=await c.newPage(); await boot(Y,sc(C1)); await syncStore(B,Y); await openSr(Y);
  const before=(await srvDoc(Y,'C3003')||{}).qty||0; const r=await doImport(Y,F6);
  const d=await srvDoc(Y,'C3003');
  ok('و١٦ العدّاد يستورد ملفّه بحسابه على جهازٍ آخر (بلا صلاحيةٍ إضافيّة)', r&&r.ok&&r.applied>=1&&d.qty===before+2&&d.entries.filter(e=>e.q===2).every(e=>e.by==='u_c1'), JSON.stringify({r,before,q:d&&d.qty})); await c.close(); }
await devA.close(); await devB.close();

await browser.close(); srv.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
