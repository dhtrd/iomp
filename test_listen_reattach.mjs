// إعادة ربط المستمعين العامّين بعد عودة الحصّة (طلب المالك ٢١-١٠-٢٠٢٦، اكتُشف في محاكاة الجرد الكامل):
// عند نفاد الحصّة يموت كل مستمع؛ مستمعو شاشة العدّ كانوا يُعاد ربطهم (cntReattach) أمّا مستمع الصلاحيات
// (config/permissions) وقوائم الجلسات في الرئيسيّة/الجلسات فكانت تبقى ميتة حتى تحديث الصفحة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CNT = { uid:'u_c1', email:'c1@dhtrd.com', name:'عدّاد أ', role:'عدّاد', active:true };
const ITEMS = [{code:'A1001',name:'صنف أ',category:'ك',book:5,cost:1}];
const S1 = { id:'s1', name:'جرد الفرع', status:'open', started:true, assignedCounters:['u_c1','u_owner'], location:'فرع أ', itemCount:1, createdAt:{__ts:1}, __chunks:[ITEMS] };
const ON = { features:{ offlineCount:true } };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
async function boot(sc){ const ctx=await browser.newContext({ viewport:{width:1200,height:1000} }); const page=await ctx.newPage();
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await sleep(1300); return {ctx,page}; } // بعد مزامنة الإقلاع (١ ث)
const txt=(page,id)=>page.evaluate(i=>{ const e=document.getElementById(i); return e?e.textContent:null; },id);
// دورة نفادٍ ثم عودة: المستمعون يموتون، ثم دورة المزامنة التلقائيّة الأولى بعد انتهاء نافذة التدهور
async function outageCycle(page){ await page.evaluate(()=>window.__quotaOut(true)); await sleep(150);
  await page.evaluate(()=>{ window.__quotaOut(false); window.__qDownClear(); }); await page.evaluate(()=>window.__autoTick()); await sleep(400); }

// L1 — مستمع الصلاحيات يعود: تغييرٌ في الإعداد بعد عودة الحصّة يصل الجهاز دون تحديث الصفحة
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('config/permissions',{features:{offlineCount:true,suppliers:true}})); await sleep(300);
  const f=await page.evaluate(()=>{ const c=window.__permCfg(); return c&&c.features&&c.features.suppliers===true; });
  ok('L1 بعد عودة الحصّة: تغيير الصلاحيات/الأعلام يصل الجهاز حيًّا', f===true, 'suppliers='+f);
  await ctx.close(); }

// L2 — لا إعادة رسمٍ متكرّرة أثناء النفاد: محاولة الربط والحصّة ما زالت نافدة لا تُعيد رسم الشاشة (لا ضياع لما يكتبه المستخدم)
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(150);
  await page.evaluate(()=>{ document.getElementById('appContent').firstElementChild.setAttribute('data-keep','1'); window.__qDownClear(); });
  await page.evaluate(()=>window.__autoTick()); await sleep(400);
  const kept=await page.evaluate(()=>!!document.querySelector('#appContent [data-keep="1"]'));
  ok('L2 محاولة الربط أثناء النفاد (الإعداد لم يتغيّر) لا تعيد رسم الشاشة', kept, 'kept='+kept);
  await ctx.close(); }

// L3 — قائمة جلسات العدّاد في الرئيسيّة تعود حيّة
{ const {ctx,page}=await boot({profile:CNT,users:[CNT,OWNER],config:ON,sessions:[S1]});
  const before=await txt(page,'counterSess');
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(150);
  const during=await txt(page,'counterSess');
  await page.evaluate(()=>{ window.__quotaOut(false); window.__qDownClear(); }); await page.evaluate(()=>window.__autoTick()); await sleep(400);
  await page.evaluate(()=>window.__mockSet('sessions/s2',{id:'s2',name:'جرد المستودع الجديد',status:'open',started:true,assignedCounters:['u_c1'],location:'م',itemCount:3,createdAt:{__ts:2}})); await sleep(300);
  const after=await txt(page,'counterSess');
  ok('L3 قائمة «جلسات الجرد المتاحة» للعدّاد تعود حيّة بعد عودة الحصّة', (before||'').includes('جرد الفرع')&&/تعذّر/.test(during||'')&&(after||'').includes('جرد المستودع الجديد'), 'before='+String(before).slice(0,40)+' during='+String(during).slice(0,40)+' after='+String(after).slice(0,80));
  await ctx.close(); }

// L4 — تبويب «جلسات الجرد»: القائمة تعود دون مسح ما كُتب في نموذج الإنشاء
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await page.evaluate(()=>window.__setTab('sessions')); await sleep(500);
  await page.evaluate(()=>{ const i=document.getElementById('s_name'); if(i){ i.value='جرد نهاية السنة'; } });
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('sessions/s3',{id:'s3',name:'جلسة أُضيفت بعد العودة',status:'open',started:false,location:'م',itemCount:0,createdAt:{__ts:3}})); await sleep(300);
  const v=await page.evaluate(()=>{ const i=document.getElementById('s_name'); return i?i.value:null; });
  const list=await txt(page,'sessList');
  ok('L4 قائمة الجلسات تعود حيّة بعد عودة الحصّة', (list||'').includes('جلسة أُضيفت بعد العودة'), String(list).slice(0,120));
  ok('L4 وما كُتب في نموذج «جلسة جديدة» لم يُمسح', v==='جرد نهاية السنة', 'value='+v);
  await ctx.close(); }

// L5 — لوحة المدير (مركز الإجراءات) تعود حيّة
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('sessions/s4',{id:'s4',name:'جلسة بانتظار المراجعة',status:'review',started:true,location:'م',itemCount:2,createdAt:{__ts:4}})); await sleep(300);
  const ac=await txt(page,'actionCenter');
  ok('L5 مركز الإجراءات في الرئيسيّة يعود حيًّا بعد عودة الحصّة', (ac||'').includes('جلسة بانتظار المراجعة'), String(ac).slice(0,120));
  await ctx.close(); }

// L6 — داخل شاشة العدّ: إعادة الربط العامّة لا تُخرج العدّاد من الشاشة، وعدّات الآخرين تعود حيّة
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await page.evaluate(()=>window.__openSession('s1')); await sleep(500);
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('config/permissions',{features:{offlineCount:true,suppliers:true}})); await sleep(300);
  await page.evaluate(()=>window.__mockSet('sessions/s1/counts/A1001',{code:'A1001',qty:2,entries:[{id:'x1',q:2,by:'u_other',byName:'آخر',at:1,src:'scan'}]})); await sleep(300);
  const st=await page.evaluate(()=>({ clist:window.__has('clist'), q:window.__qtyOf('A1001') }));
  ok('L6 العدّاد يبقى في شاشة العدّ وعدّات الأجهزة الأخرى تصل (٢)', st.clist===true&&st.q===2, JSON.stringify(st));
  await ctx.close(); }

// L7 — لا تكرار ولا تسرّب: الانتقال بين الشاشات قبل دورة الربط لا يُبقي مستمعَين على قائمة الجلسات
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:ON,sessions:[S1]});
  await page.evaluate(()=>window.__setTab('sessions')); await sleep(400);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(150);
  await page.evaluate(()=>window.__quotaOut(false));
  for(const t of ['warehouses','sessions']){ await page.evaluate(x=>window.__setTab(x),t); await sleep(300); } // المستخدم يتنقّل قبل الدورة التالية
  await page.evaluate(()=>window.__qDownClear()); await page.evaluate(()=>window.__autoTick()); await sleep(400);
  const onTab=await page.evaluate(()=>window.__lisN('sessions'));
  ok('L7 بعد التنقّل ثم دورة الربط: مستمعٌ واحد فقط على الجلسات (لا مستمع مكرّر يُفوتَر مرّتين)', onTab===1, 'listeners='+onTab);
  for(let i=0;i<3;i++){ await page.evaluate(()=>window.__setTab('warehouses')); await sleep(200); await page.evaluate(()=>window.__setTab('sessions')); await sleep(200); }
  await page.evaluate(()=>window.__setTab('warehouses')); await sleep(300);
  const away=await page.evaluate(()=>window.__lisN('sessions'));
  ok('L7 زيارة «جلسات الجرد» ثلاث مرّات ثم مغادرتها: لا مستمع متسرّب على الجلسات (كان يتراكم)', away===0, 'listeners='+away);
  await ctx.close(); }

// L8 — والعلم «العدّ دون اتصال» مطفأ: مستمع الصلاحيات يعود أيضًا في الدورة الدوريّة
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:{features:{}},sessions:[S1]});
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('config/permissions',{features:{suppliers:true}})); await sleep(300);
  const f=await page.evaluate(()=>{ const c=window.__permCfg(); return !!(c&&c.features&&c.features.suppliers===true); });
  ok('L8 العلم مطفأ: تغيير الصلاحيات يصل بعد عودة الحصّة', f, 'suppliers='+f);
  await ctx.close(); }

// L9 — فتح جلسة العدّ من «الجلسات المتاحة» يُلغي مستمع قائمة الجلسات (لا فوترة لكل تغيير جلسةٍ أثناء العدّ)
{ const {ctx,page}=await boot({profile:CNT,users:[CNT,OWNER],config:ON,sessions:[S1]});
  const onHome=await page.evaluate(()=>window.__lisN('sessions'));
  await page.evaluate(()=>window.__openSession('s1')); await sleep(500);
  const inCount=await page.evaluate(()=>window.__lisN('sessions'));
  ok('L9 مستمع قائمة الجلسات يُلغى عند فتح شاشة العدّ', onHome===1&&inCount===0, 'home='+onHome+' counting='+inCount);
  await ctx.close(); }

// L10 — العلم مطفأ وداخل شاشة العدّ: عدّات الأجهزة الأخرى تعود حيّة بعد عودة الحصّة
{ const {ctx,page}=await boot({profile:OWNER,users:[OWNER],config:{features:{}},sessions:[S1]});
  await page.evaluate(()=>window.__openSession('s1')); await sleep(500);
  await outageCycle(page);
  await page.evaluate(()=>window.__mockSet('sessions/s1/counts/A1001',{code:'A1001',qty:3,entries:[{id:'y1',q:3,by:'u_other',byName:'آخر',at:1,src:'scan'}]})); await sleep(300);
  const q=await page.evaluate(()=>window.__qtyOf('A1001'));
  ok('L10 العلم مطفأ: عدّات الآخرين تصل شاشة العدّ بعد عودة الحصّة (٣)', q===3, 'qty='+q);
  await ctx.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
