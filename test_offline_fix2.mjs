// اختبارات إصلاح-٢ (الأوفلاين) — ثلاثية الطابور: (٣أ) لا تسميم، (٣ب) لا سباق مزامنة مزدوجة، (٣ج) الحذف بالمعرّف لا بالفهرس.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const SESS = [{ id:'sr', name:'جرد', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2,
  __chunks:[[{code:'A1',name:'أ',category:'ك',book:5,cost:1},{code:'B2',name:'ب',category:'ك',book:3,cost:1}]] }];
const ON = { features:{ offlineCount:true } };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(250); }
async function openSr(page){ await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(450); }
const qlen=(page)=>page.evaluate(()=>window.__offline.queue().then(q=>q.length));
const storeEntries=(page,code)=>page.evaluate(c=>{ const d=window.__store['sessions/sr/counts/'+c]; return d?(d.entries||[]).map(e=>e.q):null; }, code);

// ===== F1 (٣أ) — تسميم الطابور: عملية مرفوضة (صلاحية) تُزال وتُسجَّل ولا تحجب الطابور =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(80);
  await page.evaluate(()=>window.__addEntry('A1',3)); await page.evaluate(()=>window.__addEntry('B2',2)); await page.waitForTimeout(200);
  const qBefore=await qlen(page);
  // رفض (صلاحية/قاعدة) لكل العمليات ثم مزامنة
  await page.evaluate(()=>window.__offline.rejectNext(true));
  const res=await page.evaluate(()=>window.__offline.setOnlineNoFlush(true))||await page.evaluate(()=>window.__offline.flush());
  await page.waitForTimeout(200);
  const qAfter=await qlen(page);
  const rej=await page.evaluate(()=>window.__offline.rejected());
  ok('F1 قبل: عمليتان بالطابور', qBefore===2, 'qBefore='+qBefore);
  ok('F1 المرفوضة أُزيلت — الطابور لم يُسمَّم (طول ٠)', qAfter===0, 'qAfter='+qAfter);
  ok('F1 سُجّلت في «العمليات المرفوضة» (٢)', Array.isArray(rej)&&rej.length===2, 'rej='+(rej&&rej.length));
  // بعد رفع الرفض: عملية جديدة تُزامَن طبيعيًّا (الطابور غير مُعطَّل)
  await page.evaluate(()=>window.__offline.rejectNext(false));
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(60);
  await page.evaluate(()=>window.__addEntry('A1',4)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(300);
  const qEnd=await qlen(page); const eA=await storeEntries(page,'A1');
  ok('F1 بعد رفع الرفض: العملية الجديدة زُومنت (طابور ٠، A1 على الخادم)', qEnd===0 && Array.isArray(eA) && eA.includes(4), 'qEnd='+qEnd+' eA='+JSON.stringify(eA));
  await page.close(); }

// ===== F2 (٣ب) — سباق المزامنة: مزامنتان متزامنتان ⇒ إحداهما busy، والكمية تُطبَّق مرّة واحدة (لا مضاعفة) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(60);
  await page.evaluate(()=>window.__addEntry('A1',5)); await page.waitForTimeout(120);
  await page.evaluate(()=>window.__offline.setOnlineNoFlush(true)); await page.waitForTimeout(40);
  const race=await page.evaluate(async()=>{ const [r1,r2]=await Promise.all([window.__offline.flush(), window.__offline.flush()]); return {r1,r2}; });
  await page.waitForTimeout(200);
  const eA=await storeEntries(page,'A1'); const busy=(race.r1&&race.r1.busy)||(race.r2&&race.r2.busy);
  const total=(eA||[]).reduce((a,q)=>a+q,0);
  ok('F2 إحدى المزامنتين رجعت busy (القفل قبل أول await)', busy===true, JSON.stringify(race));
  ok('F2 الكمية طُبِّقت مرّة واحدة (لا مضاعفة) — المجموع ٥', total===5, 'entries='+JSON.stringify(eA));
  await page.close(); }

// ===== F3 (٣ج) — الحذف بالمعرّف: حذف أوفلاين يستهدف السطر الصحيح رغم إدراج سطر زميل يُزحزح الفهرس =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS});
  await openSr(page);
  // سطران على الخادم: q5 ثم q7
  await page.evaluate(()=>window.__addEntry('A1',5)); await page.waitForTimeout(150);
  await page.evaluate(()=>window.__addEntry('A1',7)); await page.waitForTimeout(150);
  const before=await storeEntries(page,'A1');
  // دون اتصال: احذف السطر رقم ١ (q7) ⇒ يلتقط معرّفه
  await page.evaluate(()=>window.__offline.setOnline(false)); await page.waitForTimeout(60);
  await page.evaluate(()=>window.__removeEntry('A1',1)); await page.waitForTimeout(150);
  const rq=await page.evaluate(()=>window.__offline.queue()); const rop=(rq||[]).find(o=>o.op==='remove');
  // زميل آخر يُدرِج سطرًا q99 في مقدّمة الخادم (يُزحزح الفهارس) قبل المزامنة
  await page.evaluate(()=>{ const d=window.__store['sessions/sr/counts/A1']; d.entries.unshift({id:'eX',q:99,by:'u_other',byName:'زميل',at:Date.now()}); d.qty=(d.qty||0)+99; });
  // إعادة الاتصال والمزامنة
  await page.evaluate(()=>window.__offline.setOnline(true)); await page.waitForTimeout(350);
  const after=await storeEntries(page,'A1');
  ok('F3 قبل: [5,7] والحذف التقط معرّفًا للسطر', JSON.stringify(before)==='[5,7]' && !!(rop&&rop.eid), 'before='+JSON.stringify(before)+' eid='+(rop&&rop.eid));
  ok('F3 بعد المزامنة: حُذف q7 الصحيح (بالمعرّف) وبقي q5 و q99', JSON.stringify(after)==='[99,5]', 'after='+JSON.stringify(after));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
