// اختبارات إصلاح-٥ (المتوسطة) — بنود ٧،٨،١٠،١١،١٩ (منطقية/نقيّة، بتحقّق مستقل).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1000,height:1000} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(100); }

{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  // M8 — safeId لا يدمج أكوادًا مختلفة
  const ids=await page.evaluate(()=>({ a:window.__safeId('AB/1'), b:window.__safeId('AB.1'), c:window.__safeId('AB#1'), plain:window.__safeId('A1'), plain2:window.__safeId('SKU-100') }));
  ok('M8 «AB/1» و«AB.1» يُنتجان معرّفَين مختلفين (لا اندماج)', ids.a!==ids.b && ids.b!==ids.c && ids.a!==ids.c, JSON.stringify(ids));
  ok('M8 الأكواد البسيطة بلا رموز خاصة تبقى كما هي (لا كسر توافق)', ids.plain==='A1' && ids.plain2==='SKU-100', JSON.stringify(ids));

  // M10 — تحييد حقن صيغ CSV دون المساس بالأرقام السالبة
  const csv=await page.evaluate(()=>({ f:window.__repxCsvEsc('=HYPERLINK("x")'), p:window.__repxCsvEsc('+1+2'), at:window.__repxCsvEsc('@cmd'), neg:window.__repxCsvEsc('-16'), neg2:window.__repxCsvEsc('-3.5'), name:window.__repxCsvEsc('صنف عادي'), dash:window.__repxCsvEsc('-عجز') }));
  ok('M10 القيم الصيغية (= + @) تُسبَق بفاصلة عليا (ولو داخل اقتباس CSV)', /^"?'/.test(csv.f) && /^"?'/.test(csv.p) && /^"?'/.test(csv.at), JSON.stringify(csv));
  ok('M10 الأرقام السالبة لا تُمسّ', csv.neg==='-16' && csv.neg2==='-3.5', JSON.stringify(csv));
  ok('M10 نصّ يبدأ بشرطة (غير رقم) يُحيَّد؛ والنصّ العادي كما هو', csv.dash[0]==="'" && csv.name==='صنف عادي', JSON.stringify(csv));

  // M19 — فرق بأساس دفتري صفري يُنبّه (قيمة قصوى) بدل صفر
  const v0=await page.evaluate(()=>window.__sessVariancePct([{code:'X',book:0,cost:1}], {X:{code:'X',qty:500}}));
  const vN=await page.evaluate(()=>window.__sessVariancePct([{code:'Y',book:10,cost:1}], {Y:{code:'Y',qty:12}}));
  const vZ=await page.evaluate(()=>window.__sessVariancePct([{code:'Z',book:0,cost:1}], {Z:{code:'Z',qty:0}}));
  ok('M19 أساس صفري وفرق حقيقي ⇒ قيمة قصوى (>عتبة)', v0===9999, 'v0='+v0);
  ok('M19 حالة عادية تُحسب طبيعيًّا (20٪)', vN===20, 'vN='+vN);
  ok('M19 أساس صفري بلا فرق ⇒ صفر', vZ===0, 'vZ='+vZ);

  // M7 — مفتاح الإشعار يتضمّن الطابع الزمني (إعادة الاعتماد تُنتج مفتاحًا جديدًا)
  const keys=await page.evaluate(()=>{ const s1={id:'sX',status:'approved',approvedAt:{__ts:1000},location:'W',createdBy:'u_owner'}; const s2={id:'sX',status:'approved',approvedAt:{__ts:2000},location:'W',createdBy:'u_owner'};
    const k1=window.__deriveNotifsList([s1]).filter(x=>x.sid==='sX').map(x=>x.key); const k2=window.__deriveNotifsList([s2]).filter(x=>x.sid==='sX').map(x=>x.key); return {k1,k2}; });
  ok('M7 مفتاح الاعتماد يختلف باختلاف الطابع الزمني (إعادة الاعتماد تظهر)', JSON.stringify(keys.k1)!==JSON.stringify(keys.k2) && keys.k1.length>0, JSON.stringify(keys));
  await page.close(); }

// M11 — البصمة إلزامية + قفل «مدير يملك إدارة الصلاحيات» مفروض على المستعاد
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const noSum=await page.evaluate(()=>window.__acRestore(JSON.stringify({ data:{ settings:{varianceThreshold:7} } })));
  ok('M11 نسخة بلا بصمة ⇒ مرفوضة', noSum&&!!noSum.err&&/بصمة|تحقّقي/.test(noSum.err), JSON.stringify(noSum));
  // نسخة ببصمة صحيحة تحاول سحب perms.manage من دور «مدير» ⇒ يُفرض القفل
  const res=await page.evaluate(()=>{ const data={ roles:{ 'مدير':{ 'perms.manage':false, 'users.manage':false } }, settings:{varianceThreshold:7} }; const checksum=window.__acChecksum(JSON.stringify(data)); return window.__acRestore(JSON.stringify({ data, checksum })); });
  const roleMgr=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.roles&&c.roles['مدير']; });
  ok('M11 نسخة ببصمة صحيحة تُقبل', res&&res.ok===true, JSON.stringify(res));
  ok('M11 القفل مفروض: «مدير» يبقى يملك إدارة الصلاحيات والمستخدمين', roleMgr&&roleMgr['perms.manage']===true&&roleMgr['users.manage']===true, JSON.stringify(roleMgr));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
