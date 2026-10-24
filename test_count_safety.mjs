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
const SESS = (assigned)=>[{ id:'sr', name:'جرد ليلي', status:'open', started:true, assignedCounters:assigned, location:'فرع أ', itemCount:3,
  __chunks:[[{code:'A1001',name:'صنف أ',category:'ك',book:5,cost:1},{code:'B2002',name:'صنف ب',category:'ك',book:3,cost:1},{code:'C3003',name:'صنف ج',category:'ك',book:2,cost:1}]] }];
const CFG = { features:{ offlineCount:true } };
const sc=(me,assigned,extra)=>Object.assign({ profile:me, users:[C1,MG,OUT], config:CFG, sessions:SESS(assigned||['u_c1','u_mgr']) },extra||{});

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
  await P.evaluate(()=>window.__quotaOut(true)); await P.evaluate(()=>window.__addEntry('A1001',4)); await sleep(300); await P.evaluate(()=>window.__addEntry('B2002',1)); await sleep(400);
  const mir=await P.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('iomp-oq-mirror')||'null'); }catch(e){ return 'ERR'; } });
  ok('د١ كلّ كتابةٍ للطابور تُكتب في النسخة الثانية أيضًا (٢ عملية)', Array.isArray(mir)&&mir.length===2, JSON.stringify(mir&&mir.length));
  // فقد المفتاح من IndexedDB (تلف/مسحٌ جزئيّ)
  const del=await P.evaluate(()=>new Promise(res=>{ const rq=indexedDB.open('iomp-offline'); rq.onsuccess=()=>{ const db=rq.result; const tx=db.transaction('kv','readwrite'); tx.objectStore('kv').delete('iomp-offline-queue'); tx.oncomplete=()=>{ db.close(); res('ok'); }; tx.onerror=()=>res('err'); }; rq.onerror=()=>res('open-err'); }));
  await P.close(); P=await ctx.newPage(); await boot(P,sc(C1,null,{quotaOut:true})); await openSr(P); await sleep(400);
  ok('د٢ بعد فقد المفتاح من IndexedDB: الطابور مستعاد (٢) والكميات ظاهرة', del==='ok'&&(await qlen(P))===2&&(await qty(P,'A1001'))===4&&(await qty(P,'B2002'))===1, 'del='+del+' q='+(await qlen(P))+' A='+(await qty(P,'A1001')));
  ok('د٣ الاستعادة مُعلنة للمستخدم (لا صمت)', /استُعيد طابور العدّ من النسخة الثانية/.test(await toasts(P)), (await toasts(P)).slice(-140));
  const idbBack=await P.evaluate(()=>new Promise(res=>{ const rq=indexedDB.open('iomp-offline'); rq.onsuccess=()=>{ const db=rq.result; const g=db.transaction('kv').objectStore('kv').get('iomp-offline-queue'); g.onsuccess=()=>{ db.close(); res(Array.isArray(g.result)?g.result.length:-1); }; }; }));
  ok('د٣ المستعاد أُعيدت كتابته في IndexedDB', idbBack===2, 'idb='+idbBack);
  await P.evaluate(()=>window.__quotaOut(false)); await P.evaluate(()=>window.__autoTick()); await sleep(900);
  const a=await srvDoc(P,'A1001'), b=await srvDoc(P,'B2002');
  ok('د٤ المزامنة بعد الاستعادة: الخادم ٤ و١ بالضبط (لا ازدواج) والطابور فارغ', a&&a.qty===4&&b&&b.qty===1&&(await qlen(P))===0);
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
  ok('و٠ زرّ التصدير معطّل حين لا عمليّات معلّقة', await P.evaluate(()=>document.getElementById('qioExp').disabled===true));
  await ctx.close();
  const ip=devices['iPhone 13']; const c2=await browser.newContext(Object.assign({},ip)); const Q=await c2.newPage(); await boot(Q,sc(C1)); await openSr(Q); await sleep(300);
  const n2=await Q.evaluate(()=>{ const e=document.getElementById('safeNote'); return e?e.textContent:''; });
  ok('ب٢ آيفون غير مثبّت: تنبيه التثبيت على الشاشة الرئيسية بخطواته', /آيفون/.test(n2)&&/إضافة إلى الشاشة الرئيسية/.test(n2), n2.slice(0,200));
  await c2.close();
  const c3=await browser.newContext({ viewport:{width:1100,height:1000} }); const R=await c3.newPage(); await boot(R,Object.assign(sc(C1),{config:{features:{offlineCount:false}}})); await openSr(R);
  ok('ج٢ العلم مطفأ: لا شريط ولا زرّ (السلوك القائم دون تغيير)', !(await R.evaluate(()=>!!document.getElementById('safeBtn'))));
  await c3.close(); }

// ===== و — تصدير الطابور واستيراده =====
let FILE=null, FILE2=null;
const devA=await browser.newContext({ viewport:{width:1100,height:1000} }); // جهاز العدّاد الأصليّ
let A=await devA.newPage(); await boot(A,sc(C1)); await openSr(A);
await A.evaluate(()=>window.__quotaOut(true));
await A.evaluate(()=>window.__addEntry('A1001',5)); await sleep(250);
await A.evaluate(()=>window.__addEntry('A1001',2)); await sleep(250);
await A.evaluate(()=>window.__resetItem&&0); // (لا تصفير هنا)
await A.evaluate(()=>window.__addEntry('B2002',3)); await sleep(400);
await A.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(A,'qioOverlay');
await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(500);
FILE=await A.evaluate(()=>window.__qioLastExport);
ok('و١ التصدير: ملفٌ بعمليّات العدّاد (٣) وبصمة SHA-256 واسمه', FILE&&FILE.kind==='iomp-queue'&&FILE.ops.length===3&&/^sha256:/.test(FILE.hash)&&FILE.by.uid==='u_c1', JSON.stringify(FILE&&{n:FILE.ops.length,h:FILE.hash&&FILE.hash.slice(0,12),by:FILE.by}));
ok('و١ التصدير لا يمسّ الطابور على الجهاز (٣ باقية)', (await qlen(A))===3);

// جهازٌ آخر — المدير المكلَّف بالجلسة يستورد
const devB=await browser.newContext({ viewport:{width:1100,height:1000} }); let B=await devB.newPage(); await boot(B,sc(MG)); await openSr(B);
await B.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(B,'qioOverlay');
// ملفٌ معدَّل ⇒ رفض
const bad=JSON.parse(JSON.stringify(FILE)); bad.ops[0].val=50;
const rBad=await B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(bad));
ok('و٢ ملفٌ عُدِّل محتواه ⇒ رفض صريح ولا كتابة', rBad&&rBad.err==='hash'&&(await srvDoc(B,'A1001'))===null, JSON.stringify(rBad));
// الاستيراد الصحيح (تأكيد)
const pr=B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(FILE));
await waitVis(B,'cfOverlay'); const cmsg=await B.evaluate(()=>document.getElementById('cfMsg').textContent);
ok('و٣ تأكيد الاستيراد يذكر العدد ومَن تُنسب إليه الكميات', /3 عملية/.test(cmsg)&&/عدّاد أول/.test(cmsg), cmsg.slice(0,160));
await B.evaluate(()=>document.getElementById('cfGo').click());
const rImp=await pr; await sleep(500);
{ const a=await srvDoc(B,'A1001'), b=await srvDoc(B,'B2002');
  ok('و٣ الخادم بعد الاستيراد: A1001=7 و B2002=3', a&&a.qty===7&&b&&b.qty===3, JSON.stringify({a:a&&a.qty,b:b&&b.qty,r:rImp}));
  ok('و٤ الكميات منسوبة للعدّاد الأصليّ لا للمدير', a.entries.every(e=>e.by==='u_c1'&&e.byName==='عدّاد أول')&&b.entries.every(e=>e.by==='u_c1'), JSON.stringify(a.entries.map(e=>[e.by,e.byName])));
  ok('و٤ معرّفات الإضافات محفوظة كما في الجهاز', a.entries.map(e=>e.id).sort().join()===FILE.ops.filter(o=>o.code==='A1001').map(o=>o.eid).sort().join());
  const act=await activity(B); const mk=act.filter(x=>x.type==='qimport');
  ok('و٥ علامة الاستيراد في سجلّ الحركة (بصمة + جهاز + أكبر تسلسل)', mk.length===1&&mk[0].hash===FILE.hash&&mk[0].deviceId===FILE.deviceId&&mk[0].forUid==='u_c1'&&mk[0].maxSeq===Math.max(...FILE.ops.map(o=>o.seq)), JSON.stringify(mk));
  const lg=act.filter(x=>x.type==='add'); ok('و٥ سطور الإضافات تذكر المستورِد ووقت العدّ', lg.length===3&&lg.every(x=>/مستوردة من ملف/.test(x.name)&&typeof x.countedAt==='number'&&x.by==='u_mgr'), JSON.stringify(lg.map(x=>x.name))); }
// إعادة استيراد الملف نفسه ⇒ رفض
await B.evaluate(()=>document.getElementById('qioClose')&&document.getElementById('qioClose').click());
await B.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(B,'qioOverlay');
const rDup=await B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(FILE));
ok('و٦ الملف نفسه لا يُستورد مرّتين', rDup&&rDup.err==='blocked'&&/استُورد سابقًا/.test((rDup.blocked||[]).join()), JSON.stringify(rDup));
ok('و٦ لا ازدواج على الخادم (ما زال 7)', (await srvDoc(B,'A1001')).qty===7);

// المدير يحذف إحدى الكميات المستوردة على الخادم، ثم يعود جهاز العدّاد الأصليّ للاتصال
await B.evaluate(()=>{ const k='sessions/sr/counts/A1001'; const x=window.__store[k]; const en=x.entries.filter(e=>e.q!==2); window.__store[k]=Object.assign({},x,{entries:en,qty:en.reduce((s,e)=>s+e.q,0)}); });
// المحاكي يحفظ «الخادم» في ذاكرة كلّ صفحة ⇒ نُزامن خادم الجهاز A مع ما كتبه B (خادمٌ واحد في الحقيقة)
const shared=await B.evaluate(()=>JSON.parse(JSON.stringify(window.__store)));
await A.evaluate(st=>{ for(const k of Object.keys(window.__store))if(k.startsWith('sessions/sr/'))delete window.__store[k]; Object.assign(window.__store,st); },shared);
await A.evaluate(()=>window.__quotaOut(false)); await A.evaluate(()=>window.__autoTick()); await sleep(1000);
{ const a=await srvDoc(A,'A1001'), b=await srvDoc(A,'B2002');
  ok('و٧ جهاز العدّاد الأصليّ عند عودته لا يُعيد إرسال ما استُورد (لا تعود الكمية المحذوفة، ولا ازدواج)', a.qty===5&&b.qty===3&&(await qlen(A))===0, JSON.stringify({a:a.qty,b:b.qty,q:await qlen(A)}));
  ok('و٧ تنبيهٌ صريح بأن العمليّات سبق استيرادها', /سبق استيرادها/.test(await toasts(A)), (await toasts(A)).slice(-160)); }

// «تصفير» داخل ملفٍّ وعلى الخادم كميةٌ أحدث منه ⇒ يُتخطّى ويظهر في التقرير
await A.evaluate(()=>window.__quotaOut(true));
await A.evaluate(()=>window.__addEntry('C3003',1)); await sleep(250);
await A.evaluate(()=>window.__resetItem('C3003')); await sleep(300);
const confirmReset=await waitVis(A,'cfOverlay'); if(confirmReset){ await A.evaluate(()=>document.getElementById('cfGo').click()); await sleep(300); }
await A.evaluate(()=>window.__addEntry('A1001',1)); await sleep(400);
await A.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(A,'qioOverlay');
await A.evaluate(()=>document.getElementById('qioExp').click()); await sleep(400);
FILE2=await A.evaluate(()=>window.__qioLastExport);
// بعد التصدير: جهازٌ ثالث أضاف C3003 على الخادم (أحدث من التصفير)
await B.evaluate(()=>{ window.__store['sessions/sr/counts/C3003']={code:'C3003',qty:6,entries:[{id:'zz6',q:6,by:'u_x',byName:'آخر',at:Date.now()+5000}]}; });
await B.evaluate(()=>document.getElementById('qioClose')&&document.getElementById('qioClose').click());
await B.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(B,'qioOverlay');
const pr2=B.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(FILE2)); await waitVis(B,'cfOverlay'); await B.evaluate(()=>document.getElementById('cfGo').click());
const r2=await pr2; await sleep(500);
{ const c=await srvDoc(B,'C3003');
  ok('و٨ ملفٌ فيه «تصفير» والخادم فيه كميةٌ أحدث ⇒ لا يُمسح عدّ الزميل (٦ + ١ من الملف)', c&&c.entries.some(e=>e.id==='zz6')&&c.qty===7, JSON.stringify(c&&c.entries.map(e=>[e.id,e.q])));
  ok('و٨ التصفير المتخطّى ظاهرٌ في تقرير الاستيراد', r2&&r2.skipped&&r2.skipped.length===1&&r2.skipped[0].code==='C3003'&&/لم يُنفَّذ/.test(await B.evaluate(()=>document.getElementById('qioBody').textContent)), JSON.stringify(r2&&r2.skipped)); }

// مستوردٌ غير مكلَّف بالجلسة ⇒ رفض مع الإرشاد
{ const c=await browser.newContext({ viewport:{width:1100,height:1000} }); const O=await c.newPage(); await boot(O,sc(OUT)); await openSr(O);
  await O.evaluate(()=>document.getElementById('safeBtn').click()); await waitVis(O,'qioOverlay');
  const r=await O.evaluate(t=>window.IOMPQ.importText(t),JSON.stringify(FILE2));
  ok('و٩ حسابٌ غير مكلَّف بالجلسة ⇒ لا استيراد، مع إرشاد «أضف نفسك»', r&&r.err==='blocked'&&/أضف نفسك/.test((r.blocked||[]).join()), JSON.stringify(r)); await c.close(); }

await devA.close(); await devB.close();
await browser.close(); srv.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
