// اختبارات إصلاح م٦ — قصّ أعمدة الطباعة العريضة (شكوى العميل: «الطباعة لا تحتوي على كل البيانات»).
// السبب: جدول «تقرير مفصل» (١٢+ عمودًا) أعرض من الورقة فتُقصّ أعمدته اليسرى (القيم).
// الإصلاح: (أ) table-layout:fixed + colgroup موزون + بنط تلقائي حسب عدد الأعمدة ⇒ الجدول كله داخل الورقة دائمًا؛
//          (ب) تفعيل «حجم الورق/اتجاه الصفحة» من إعدادات المخرجات فعليًّا عبر @page (كانت بلا مستهلك)؛
//          (ج) كسر الكلمات في خلايا الطباعة بدل البتر.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const VW={uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع الفرع',role:'مطّلع',active:true};
const CH=[[{code:'99916382',name:'نجف لد سندريلا 400+300/ 7711',category:'انارة / علاقيات',book:24,cost:80},
          {code:'99916629',name:'نجف مودرن 3 دور حلقات 200+300+600/ 7273',category:'انارة / علاقيات',book:6,cost:112},
          {code:'B1',name:'صنف بلا عد',category:'أثاث',book:2,cost:60}]];
const CN=[{code:'99916382',qty:24},{code:'99916629',qty:6}];
const NT=[{code:'99916382',notes:[{text:'ملاحظة وقت العد',byName:'عدّاد ١'}]}];
const S1={id:'s1',name:'جرد مستودع الاثاث',status:'approved',started:true,location:'مستودع الاثاث',itemCount:3,createdBy:'u_owner',__chunks:CH,__counts:CN,__notes:NT};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} window.print=()=>{}; });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
async function openRep(page){ await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(450); }
const count=(s,needle)=>s.split(needle).length-1;

// ===== P1 — المفصّل (١٣ عمودًا مع الملاحظات): colgroup مطابق للأعمدة + بنط تلقائي + table-layout:fixed + @page =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  const cols=count(html,'<col style'); const ths=count(html.split('<thead>')[1].split('</thead>')[0],'<th');
  ok('P1 colgroup موجود وعدد <col> يساوي عدد رؤوس الأعمدة', html.includes('<colgroup')&&cols===ths&&cols===13, `cols=${cols} ths=${ths}`);
  ok('P1 الجدول table-layout:fixed وبنط تلقائي 9.5px للأعمدة الكثيرة', html.includes('table-layout:fixed')&&html.includes('font-size:9.5px'));
  ok('P1 ‎@page مُفعّل (A4 عمودي افتراضيًّا)', html.includes('@page{size:A4}'), html.slice(0,60));
  ok('P1 كل بيانات الأعمدة حاضرة في المطبوعة (القيم والملاحظات والتكلفة)', html.includes('القيمة الدفترية')&&html.includes('القيمة الفعلية')&&html.includes('قيمة الفرق')&&html.includes('التكلفة')&&html.includes('الملاحظات')&&html.includes('ملاحظة وقت العد'));
  const ws=[...html.matchAll(/<col style="width:([\d.]+)%"/g)].map(m=>Number(m[1])); const sum=ws.reduce((a,b)=>a+b,0);
  ok('P1 أوزان colgroup تجمع ≈١٠٠٪', Math.abs(sum-100)<1.5, String(sum));
  await page.close(); }

// ===== P2 — «مراجعة الفرع» (٦ أعمدة): بنط كامل 11.5px وستة <col> =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P2 ثمانية أعمدة (٦ + من أضاف + الملاحظات التلقائية) وبنط 10.8px', count(html,'<col style')===8&&html.includes('font-size:10.8px')&&html.includes('من أضاف'), 'cols='+count(html,'<col style'));
  await page.close(); }

// ===== P3 — إعدادات المخرجات تعمل فعليًّا: أفقي + A5 =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],
    config:{settings:{print:{orientation:'landscape',paperSize:'A5'}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P3 ‎@page{size:A5 landscape} من الإعدادات', html.includes('@page{size:A5 landscape}'), html.slice(0,60));
  await page.close(); }

// ===== P4 — حجم ورق غير معروف ⇒ تراجع آمن إلى A4 =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],
    config:{settings:{print:{paperSize:'Tabloid'}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P4 حجم غير مدعوم يرتد إلى A4', html.includes('@page{size:A4}'), html.slice(0,60));
  await page.close(); }

// ===== P5 — قواعد CSS للطباعة (الاحتواء وكسر الكلمات) موجودة في الصفحة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const cssOk=await page.evaluate(()=>[...document.querySelectorAll('style')].some(s=>s.textContent.includes('table-layout:fixed!important')&&s.textContent.includes('word-break:break-word')));
  ok('P5 قاعدتا الاحتواء وكسر الكلمات في CSS الطباعة', cssOk===true);
  await page.close(); }

// ===== P6 — طباعة شاشة التقارير كذلك: @page + table-layout:fixed =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await page.evaluate(()=>window.__setTab('reports'));
  await page.waitForFunction('window.__repxReady&&window.__repxReady()===true',{timeout:9000});
  const html=await page.evaluate(()=>window.__repxPrintHtml('sessions'));
  ok('P6 مطبوعة شاشة التقارير: @page واحتواء العرض', html.includes('@page{size:')&&html.includes('table-layout:fixed'));
  await page.close(); }

// ===== P7 — محضر اللجنة: كتلة التواقيع باقية مع الإصلاح (لا انحدار) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('custody'));
  ok('P7 محضر بجدول (عهدة): التواقيع والجدول (colgroup) معًا', html.includes('التوقيع')&&html.includes('<colgroup')&&html.includes('رئيس اللجنة'));
  const hc=await page.evaluate(()=>window.__buildReasonPrint('committee'));
  ok('P7 محضر اللجنة الملخّص: تواقيع باقية بلا جدول', hc.includes('التوقيع')&&hc.includes('رئيس اللجنة')&&!hc.includes('<colgroup'));
  await page.close(); }

// ===== P8 — تكامل مع م٦: مطبوعة المطّلع «مراجعة الفرع» ستة أعمدة كمّية بلا مالية =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P8 المطّلع: colgroup ستة أعمدة (بلا ملاحظات لهذه الصفوف؟ تُحسب إن ظهرت) بلا أعمدة مالية', count(html,'<col style')>=6&&!html.includes('التكلفة')&&html.includes('الكمية الفعلية'), 'cols='+count(html,'<col style'));
  await page.close(); }

// ===== P9 — «من أضاف» يظهر في طباعة مراجعة الفرع: مجموعةً لكلّ عدّاد (تتابعٌ بلا ١+١، ومنفصلةٌ مفصّلة) =====
{ const page=await ctx.newPage();
  const CN2=[{code:'99916382',qty:3,entries:[{id:'e1',q:3,n:3,by:'u_owner',byName:'عبدالكريم الضيفي'}]},
             {code:'99916629',qty:6,entries:[{id:'e2',q:4,by:'u_owner',byName:'عبدالكريم الضيفي'},{id:'e3',q:2,by:'u_owner',byName:'عبدالكريم الضيفي'}]}];
  const S9=Object.assign({},S1,{__counts:CN2,__notes:[]});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[S9]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P9 «من أضاف» يظهر في طباعة الفرع والتتابع مجموعٌ (عبدالكريم: 3 بلا ١+١)', html.includes('من أضاف')&&html.includes('عبدالكريم الضيفي: 3')&&!html.includes('(1 + 1 + 1)'), 'a='+html.includes('عبدالكريم الضيفي: 3'));
  ok('P9 والإضافات المنفصلة الحقيقيّة تبقى مفصّلة (٤ + ٢)', html.includes('عبدالكريم الضيفي: 6')&&html.includes('(4 + 2)'), 'b='+html.includes('(4 + 2)'));
  await page.close(); }

// ===== P10 (ط-١٩) — حجم خط الطباعة من الإدارة فعّال: ٨ نقاط ⇒ خطٌّ ٨px وحشوٌ أضيق (صفحاتٌ أقلّ) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:8}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P10 خط الطباعة ٨ من الإدارة مُطبَّق (يتجاوز التلقائي 10.8) وحشوٌ أضيق', html.includes('font-size:8px')&&!html.includes('font-size:10.8px')&&html.includes('padding:2px 4px'), 'f8='+html.includes('font-size:8px'));
  await page.close(); }

// ===== P11 (ط-١٩) — خطٌّ أكبر (١٣) على المفصّل ⇒ ١٣px (يتجاوز التلقائي 9.5) مع بقاء colgroup (بلا قصّ) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:13}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P11 خط ١٣ يتجاوز التلقائي (9.5) على المفصّل ⇒ صفحاتٌ أكثر', html.includes('font-size:13px')&&!html.includes('font-size:9.5px'), 'f13='+html.includes('font-size:13px'));
  ok('P11 colgroup باقٍ فالأعمدة تبقى داخل الورقة رغم الخط الأكبر', html.includes('<colgroup')&&count(html,'<col style')===13, 'cols='+count(html,'<col style'));
  await page.close(); }

// ===== P12 (ط-١٩) — خطٌّ صغيرٌ على المفصّل العريض (١٣ عمودًا) ⇒ ٨px مع بقاء كلّ الأعمدة (بلا فقدان بيانات) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:8}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P12 المفصّل العريض بخط ٨: البنط مُطبَّق وكلّ أعمدة القيم حاضرة (بلا قصّ)', html.includes('font-size:8px')&&count(html,'<col style')===13&&html.includes('القيمة الدفترية')&&html.includes('قيمة الفرق'), 'f8='+html.includes('font-size:8px')+' cols='+count(html,'<col style'));
  await page.close(); }

// ===== P13 (ط-١٩) — «تلقائي» (فارغ) يعود للاحتساب حسب الأعمدة (سلوك م٦): مراجعة الفرع 10.8px =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:'auto'}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P13 «تلقائي» يعيد البنط الآليّ (10.8 لمراجعة الفرع)', html.includes('font-size:10.8px'), 'auto='+html.includes('font-size:10.8px'));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
