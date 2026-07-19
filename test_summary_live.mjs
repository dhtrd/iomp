// اختبارات إصلاح-٤ (الكفاءة) — ملخّص الجلسة المشتقّ (بند ٤) + قيمة المخزون في الدفتر (بند ٦).
// المبدأ: العلم features.sessionSummary معطّل افتراضًا ⇒ سلوك اليوم حرفيًّا (فولد كامل). مفعّل ⇒ الإشعارات والفروع تقرأ الملخّص بلا طيّ لقطة/عدّات.
// تحقّق مستقلّ: نعيد حساب الملخّص في Node (calcSummary) ونطابقه بمخرجات التطبيق — لا نقل بلا إعادة حساب.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const TS = { __ts: 1700000000000 };
const r2 = n => Math.round((Number(n)+Number.EPSILON)*100)/100;

// إعادة حساب مستقلّة لملخّص الجلسة (تُطابق computeSessionSummary في التطبيق منطقيًّا، مكتوبة هنا استقلالًا)
function calcSummary(items, countsArr){
  const cm={}; countsArr.forEach(c=>cm[String(c.code)]=c);
  let counted=0,uncounted=0,match=0,surplus=0,deficit=0,bookVal=0,countedVal=0,netVar=0,base=0,vdiff=0,invVal=0;
  items.forEach(it=>{
    const cc=cm[String(it.code)]; const isC=!!cc; const cnt=isC?(cc.qty==null?0:Number(cc.qty)):null;
    const book=(it.book!=null&&!isNaN(it.book))?Number(it.book):null;
    const cost=(it.cost!=null&&!isNaN(it.cost))?Number(it.cost):null;
    let diff,hasDiff;
    if(isC){diff=cnt-(book!=null?book:0);hasDiff=true;} else if(book!=null){diff=-book;hasDiff=true;} else {diff=0;hasDiff=false;}
    let status; if(!isC)status='uncounted'; else if(book==null)status='nobook'; else if(Math.abs(diff)<1e-9)status='match'; else status=diff>0?'surplus':'deficit';
    if(isC)counted++; else uncounted++;
    if(status==='match')match++; else if(status==='surplus')surplus++; else if(status==='deficit')deficit++;
    const varValue=(cost!=null&&hasDiff)?diff*cost:null;
    const bookValue=(cost!=null&&book!=null)?book*cost:null;
    const countedValue=(cost!=null&&isC)?cnt*cost:null;
    if(bookValue!=null)bookVal+=bookValue;
    if(countedValue!=null)countedVal+=countedValue;
    if(varValue!=null)netVar+=varValue;
    if(isC&&book!=null){ base+=Math.abs(book); vdiff+=Math.abs(cnt-book); }
    const c2=(cost!=null?cost:0), q=(isC?(cnt||0):(book!=null?book:0)); invVal+=c2*q;
  });
  return { itemCount:items.length, counted, uncounted, match, surplus, deficit,
    netVar:r2(netVar), bookVal:r2(bookVal), countedVal:r2(countedVal), invValue:r2(invVal),
    varPct: base>0?r2(vdiff/base*100):0 };
}

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1100,height:1400} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:9000}); await page.waitForTimeout(120); }

// عيّنة موحّدة للفولد والملخّص
const ITEMS=[{code:'A',name:'أ',category:'ك',book:10,cost:2},{code:'B',name:'ب',category:'ك',book:20,cost:1},{code:'C',name:'ج',category:'ك',book:5,cost:4}];
const COUNTS=[{code:'A',qty:12},{code:'B',qty:20}]; // A فائض+2 (تكلفة2)، B مطابق، C غير معدود (عجز دفتري)
const EXP=calcSummary(ITEMS,COUNTS);

// ============ S1 — computeSessionSummary يطابق إعادة الحساب المستقلّة ============
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const cm={}; COUNTS.forEach(c=>cm[c.code]=c);
  const got=await page.evaluate(([items,counts])=>window.__computeSessionSummary(items,counts),[ITEMS,cm]);
  ok('S1 computeSessionSummary: itemCount/counted/match', got.itemCount===EXP.itemCount&&got.counted===EXP.counted&&got.match===EXP.match);
  ok('S1 netVar='+got.netVar+' (متوقّع '+EXP.netVar+')', got.netVar===EXP.netVar);
  ok('S1 bookVal/countedVal/invValue', got.bookVal===EXP.bookVal&&got.countedVal===EXP.countedVal&&got.invValue===EXP.invValue);
  ok('S1 varPct='+got.varPct+' (متوقّع '+EXP.varPct+')', got.varPct===EXP.varPct);
  await page.close(); }

// ============ S2 — بند ٦: ledLoadCatalog يُعبّئ التكلفة وقيمة المخزون تصبح > صفر ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{warehouseLedger:true,productCatalog:true}},
    products:[{sku:'SKU-1',cost:1500},{sku:'SKU-2',cost:0},{sku:'SKU-3'}]}); // SKU-3 بلا تكلفة ⇒ يُستثنى
  const cat=await page.evaluate(()=>window.__ledLoadCatalog());
  ok('S2 ledLoadCatalog: SKU-1=1500 و SKU-2=0 و SKU-3 مُستثنى', cat['SKU-1']===1500&&cat['SKU-2']===0&&!('SKU-3' in cat));
  // زرع حركة إدخال ثم حساب قيمة المخزون من الكتالوج
  await page.evaluate(()=>window.__ledSeed([{id:'m1',type:'in',sku:'SKU-1',qty:2,from:'',to:'RY',ref:'MV-0001'}]));
  const fold=await page.evaluate(()=>window.__ledFold());
  const sep=await page.evaluate(()=>window.__ledSep());
  let expVal=0; for(const k in fold){ const q=fold[k]; if(q>0){ const sku=k.split(sep)[1]; const c=cat[sku]!=null?cat[sku]:0; expVal+=q*c; } }
  const kpi=await page.evaluate(c=>window.__ledKpis(c),cat);
  ok('S2 قيمة المخزون من الكتالوج = '+kpi.value+' (>0، متوقّع '+r2(expVal)+')', kpi.value>0 && Math.abs(kpi.value-r2(expVal))<0.01);
  // قبل الإصلاح: كتالوج فارغ ⇒ صفر (نثبت أن الصفر كان بسبب غياب الكتالوج لا الحركات)
  const kpiEmpty=await page.evaluate(()=>window.__ledKpis({}));
  ok('S2 كتالوج فارغ ⇒ قيمة = 0 (يُثبت أن الإصلاح هو التعبئة)', kpiEmpty.value===0 && kpi.units===kpiEmpty.units && kpi.units>0);
  await page.close(); }

// ============ S3 — كتابة الملخّص: العلم مفعّل يكتب، معطّل لا يكتب ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{sessionSummary:true}},
    sessions:[{id:'sW',name:'جلسة',status:'review',location:'W',itemCount:3,__chunks:[ITEMS],__counts:COUNTS}]});
  const cm={}; COUNTS.forEach(c=>cm[c.code]=c);
  const wrote=await page.evaluate(([items,counts])=>window.__sessWriteSummary('sW',items,counts),[ITEMS,cm]);
  const stored=await page.evaluate(()=>window.__store['sessions/sW'].summary||null);
  ok('S3 العلم مفعّل: كُتب الملخّص في الجلسة', !!stored && stored.itemCount===EXP.itemCount && stored.varPct===EXP.varPct && stored.netVar===EXP.netVar);
  ok('S3 sessWriteSummary أعاد الملخّص', wrote && wrote.counted===EXP.counted);
  await page.close(); }
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{}}, // العلم معطّل
    sessions:[{id:'sW2',name:'جلسة',status:'review',location:'W',itemCount:3,__chunks:[ITEMS],__counts:COUNTS}]});
  const cm={}; COUNTS.forEach(c=>cm[c.code]=c);
  const wrote=await page.evaluate(([items,counts])=>window.__sessWriteSummary('sW2',items,counts),[ITEMS,cm]);
  const stored=await page.evaluate(()=>window.__store['sessions/sW2'].summary);
  ok('S3 العلم معطّل: لا يُكتب الملخّص (سلوك اليوم)', wrote===null && stored===undefined);
  await page.close(); }

// ============ S4 — الإشعارات تقرأ الملخّص (العلم مفعّل) بلا لقطة/عدّات ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{sessionSummary:true},settings:{varianceThreshold:5}}});
  // جلسة بلا لقطة/عدّات في المخزن، لكن لها ملخّص varPct=42.5 ⇒ إن استُعمل الملخّص فالنتيجة 42.5 (وإلا 0 بالفولد الفارغ)
  const list=[{id:'sN',deleted:false,status:'approved',approvedAt:TS,location:'W',summary:{varPct:42.5,itemCount:3,counted:2}}];
  const out=await page.evaluate(l=>window.__notifEnrichVariance(l),list);
  ok('S4 الإشعار استعمل ملخّص varPct=42.5 بلا فولد', out[0]._varPct===42.5);
  await page.close(); }

// ============ S5 — الإشعارات بلا ملخّص ⇒ فولد كامل (تراجع آمن) ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{sessionSummary:true},settings:{varianceThreshold:5}},
    sessions:[{id:'sF',name:'ج',status:'approved',location:'W',itemCount:3,approvedAt:TS,__chunks:[ITEMS],__counts:COUNTS}]});
  const list=[{id:'sF',deleted:false,status:'approved',approvedAt:TS,location:'W'}]; // لا ملخّص
  const out=await page.evaluate(l=>window.__notifEnrichVariance(l),list);
  ok('S5 بلا ملخّص: فولد يعطي varPct='+EXP.varPct, out[0]._varPct===EXP.varPct);
  await page.close(); }

// ============ S6 — العلم معطّل ⇒ يتجاهل الملخّص ويفولد (توافق خلفي) ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{},settings:{varianceThreshold:5}}, // العلم معطّل
    sessions:[{id:'sO',name:'ج',status:'approved',location:'W',itemCount:3,approvedAt:TS,__chunks:[ITEMS],__counts:COUNTS}]});
  const list=[{id:'sO',deleted:false,status:'approved',approvedAt:TS,location:'W',summary:{varPct:99}}]; // ملخّص كاذب 99
  const out=await page.evaluate(l=>window.__notifEnrichVariance(l),list);
  ok('S6 العلم معطّل: تجاهل الملخّص(99) وفولد إلى '+EXP.varPct, out[0]._varPct===EXP.varPct && out[0]._varPct!==99);
  await page.close(); }

// ============ S7 — الفروع تقرأ الملخّص (العلم مفعّل) بلا طيّ ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{branches:true,sessionSummary:true}},
    branches:[{id:'bS',name:'فرع',city:'ر',managerUid:'u_owner',warehouses:['W'],active:true}],
    // جلسة بملخّص فقط (بلا لقطة/عدّات) ⇒ إن طُوِيت لأعطت أصفارًا
    sessions:[{id:'sBs',name:'ج',status:'reviewed',location:'W',itemCount:10,assignedCounters:['u_c1'],summary:{itemCount:10,counted:8,match:6,netVar:-12}}]});
  await page.evaluate(()=>window.__brxLoad());
  const m=await page.evaluate(()=>window.__brxBranchModel('bS'));
  ok('S7 الفرع من الملخّص: أصناف=10 معدود=8', m&&m.items===10&&m.counted===8);
  ok('S7 الدقّة=75 والفروقات=-12 (من الملخّص لا الفولد)', m&&m.accuracyPct===75&&m.varianceValue===-12);
  await page.close(); }

// ============ S8 — الفروع بلا ملخّص ⇒ فولد (تراجع آمن) ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{branches:true,sessionSummary:true}},
    branches:[{id:'bF',name:'فرع',city:'ر',managerUid:'u_owner',warehouses:['W'],active:true}],
    sessions:[{id:'sBf',name:'ج',status:'reviewed',location:'W',itemCount:3,assignedCounters:['u_c1'],__chunks:[ITEMS],__counts:COUNTS}]});
  await page.evaluate(()=>window.__brxLoad());
  const m=await page.evaluate(()=>window.__brxBranchModel('bF'));
  ok('S8 بلا ملخّص: فولد أصناف=3 معدود='+EXP.counted, m&&m.items===3&&m.counted===EXP.counted);
  ok('S8 الفروقات المطويّة = '+EXP.netVar, m&&m.varianceValue===EXP.netVar);
  await page.close(); }

// ============ S9 — الفروع والعلم معطّل ⇒ يتجاهل الملخّص ويفولد ============
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],config:{features:{branches:true}}, // sessionSummary معطّل
    branches:[{id:'bO',name:'فرع',city:'ر',managerUid:'u_owner',warehouses:['W'],active:true}],
    sessions:[{id:'sBo',name:'ج',status:'reviewed',location:'W',itemCount:3,assignedCounters:['u_c1'],summary:{itemCount:99,counted:99,match:99,netVar:999},__chunks:[ITEMS],__counts:COUNTS}]});
  await page.evaluate(()=>window.__brxLoad());
  const m=await page.evaluate(()=>window.__brxBranchModel('bO'));
  ok('S9 العلم معطّل: تجاهل الملخّص(99) وفولد أصناف=3', m&&m.items===3&&m.items!==99&&m.counted===EXP.counted);
  await page.close(); }

// ============ التقرير ============
await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
