// اختبارات ط-١٧ — فلتر الفئات المتعدّد (النمط B: بحث + صناديق + رقائق) في شاشة تقرير الفروقات
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// فئاتٌ متمايزة (كلّ فئةٍ قيمةٌ مستقلّة) — بحث «سجاد» يطابق ثلاثًا، «ستائر» يطابق اثنتين
const CATI=[[
  {code:'A1',name:'صنف أ',category:'سجّاد تركي',book:10,cost:5},
  {code:'A2',name:'صنف ب',category:'سجّاد صيني',book:4,cost:5},
  {code:'A3',name:'صنف ج',category:'سجّاد مسجد',book:6,cost:5},
  {code:'B1',name:'صنف د',category:'ستائر رول',book:3,cost:10},
  {code:'B2',name:'صنف هـ',category:'ستائر شيفون',book:2,cost:10},
  {code:'C1',name:'صنف و',category:'أثاث',book:5,cost:20},
]];
const CATC=[{code:'A1',qty:10},{code:'C1',qty:5}];
const CATSESS={id:'s1',name:'جرد الفئات',status:'approved',location:'فرع أ',assignedCounters:['u_owner'],itemCount:6,__chunks:CATI,__counts:CATC};
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
async function openRep(page){ await page.evaluate(()=>window.__openReport('s1'));
  await page.waitForFunction('window.__catf&&window.__catf.present()&&window.__catf.tableRows()===6',{timeout:9000}); await page.waitForTimeout(120); }

// ط١ — الحالة الابتدائيّة: اللوحة حاضرة، لا اختيار، كلّ الصفوف (٦) ظاهرة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>({ present:window.__catf.present(), count:window.__catf.count(), rows:window.__catf.tableRows(), fc:window.__catf.filteredCount(), ct:window.__catf.countText() }));
  ok('ط١ الابتدائيّة: لوحةٌ حاضرة، لا اختيار = كلّ الصفوف (٦)', r.present&&r.count===0&&r.rows===6&&r.fc===6, JSON.stringify(r));
  await page.close(); }

// ط٢ — كلّ الفئات المتمايزة مدرجةٌ في القائمة (٦ فئات)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>({ cats:window.__catf.cats(), rowNames:window.__catf.rowNames() }));
  const set=new Set(r.cats);
  ok('ط٢ الفئات المتمايزة الستّ مدرجةٌ كلّها', r.cats.length===6&&set.has('أثاث')&&set.has('ستائر رول')&&set.has('سجّاد تركي')&&r.rowNames.length===6, JSON.stringify(r.cats));
  await page.close(); }

// ط٣ — تبديل فئةٍ واحدة (أثاث) يفلتر الجدول لصنفٍ واحد + رقاقة + عدّاد
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); return { count:window.__catf.count(), rows:window.__catf.tableRows(), chips:window.__catf.chips(), sel:window.__catf.selected() }; });
  ok('ط٣ تبديل «أثاث» ⇒ صفٌّ واحد + رقاقةٌ واحدة + عدّاد ١', r.count===1&&r.rows===1&&r.chips.length===1&&r.chips[0]==='أثاث'&&r.sel[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط٤ — الطباعة/التصدير (filteredReportRows نفسها) تحترم الاختيار
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); return { fc:window.__catf.filteredCount(), cats:window.__catf.filteredCats() }; });
  ok('ط٤ الطباعة/التصدير يقرآن الاختيار: صفٌّ واحد فئته «أثاث»', r.fc===1&&r.cats.length===1&&r.cats[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط٥ — «مسح الكلّ» يعيد كلّ الصفوف (٦) والعدّاد ٠
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); window.__catf.toggle('ستائر رول'); const mid=window.__catf.count(); window.__catf.clear();
    return { mid, count:window.__catf.count(), rows:window.__catf.tableRows(), fc:window.__catf.filteredCount() }; });
  ok('ط٥ «مسح الكلّ» يُلغي الفلتر (٦ صفوف، عدّاد ٠)', r.mid===2&&r.count===0&&r.rows===6&&r.fc===6, JSON.stringify(r));
  await page.close(); }

// ط٦ — البحث «ستائر» يضيّق القائمة إلى نتيجتين، والملاحظة تذكر العدد
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('ستائر'); return { res:window.__catf.results(), rowNames:window.__catf.rowNames(), note:window.__catf.note() }; });
  ok('ط٦ البحث «ستائر» ⇒ نتيجتان في القائمة والملاحظة', r.res.length===2&&r.rowNames.length===2&&r.note.indexOf('ستائر')>=0&&/[2٢]/.test(r.note), JSON.stringify(r));
  await page.close(); }

// ط٧ — Enter يختار كلّ النتائج المطابقة («سجاد» ⇒ ٣) والجدول ٣ صفوف
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('سجاد'); window.__catf.enter(); return { count:window.__catf.count(), rows:window.__catf.tableRows(), fc:window.__catf.filteredCount(), sel:window.__catf.selected() }; });
  ok('ط٧ Enter = اختيار كلّ النتائج («سجاد» ⇒ ٣ صفوف)', r.count===3&&r.rows===3&&r.fc===3&&r.sel.every(s=>s.indexOf('سجّاد')===0), JSON.stringify(r));
  await page.close(); }

// ط٨ — زرّ «اختر كلّ النتائج» يختار المطابق (بحث «سجاد» ⇒ ٣)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('سجاد'); window.__catf.selectAll(); return { count:window.__catf.count(), rows:window.__catf.tableRows() }; });
  ok('ط٨ زرّ «اختر كلّ النتائج» يختار المطابق (٣)', r.count===3&&r.rows===3, JSON.stringify(r));
  await page.close(); }

// ط٩ — التطبيع العربيّ: «اثاث» (ألف عاديّة) يطابق «أثاث»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('اثاث'); const res=window.__catf.results(); window.__catf.enter(); return { res, count:window.__catf.count(), sel:window.__catf.selected() }; });
  ok('ط٩ التطبيع: «اثاث» يطابق «أثاث» ويختاره', r.res.length===1&&r.res[0]==='أثاث'&&r.count===1&&r.sel[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط١٠ — إزالة رقاقةٍ تُلغي فئتها من الاختيار والجدول
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); window.__catf.toggle('ستائر رول'); const before=window.__catf.count();
    window.__catf.removeChip('أثاث'); return { before, count:window.__catf.count(), chips:window.__catf.chips(), fc:window.__catf.filteredCount() }; });
  ok('ط١٠ إزالة رقاقة «أثاث» ⇒ تبقى «ستائر رول» فقط', r.before===2&&r.count===1&&r.chips.length===1&&r.chips[0]==='ستائر رول'&&r.fc===1, JSON.stringify(r));
  await page.close(); }

// ط١١ — Backspace على بحثٍ فارغٍ يزيل آخر رقاقة مُضافة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); window.__catf.toggle('ستائر رول'); window.__catf.search(''); window.__catf.key('Backspace');
    return { count:window.__catf.count(), sel:window.__catf.selected() }; });
  ok('ط١١ Backspace على بحثٍ فارغٍ يزيل آخر رقاقة', r.count===1&&r.sel[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط١٢ — ↓ ينقل التظليل، والمسافة تبدّل المظلَّل (بحثٌ فارغ)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.search(''); window.__catf.key('ArrowDown'); const hl=window.__catf.hl(); const target=window.__catf.results()[hl];
    window.__catf.key(' '); return { hl, target, sel:window.__catf.selected() }; });
  ok('ط١٢ ↓ ينقل التظليل والمسافة تبدّل المظلَّل', r.hl===1&&r.sel.length===1&&r.sel[0]===r.target, JSON.stringify(r));
  await page.close(); }

// ط١٣ — «مسح الكلّ» معطّلٌ بلا اختيار، ونشطٌ بعده
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const d0=window.__catf.clrDisabled(); window.__catf.toggle('أثاث'); const d1=window.__catf.clrDisabled(); return { d0, d1 }; });
  ok('ط١٣ «مسح الكلّ» معطّلٌ بلا اختيار ونشطٌ بعده', r.d0===true&&r.d1===false, JSON.stringify(r));
  await page.close(); }

// ط١٤ — «اختر كلّ النتائج» معطّلٌ حين لا نتائج مطابقة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('لا-يوجد-كذا'); return { res:window.__catf.results().length, dis:window.__catf.selAllDisabled() }; });
  ok('ط١٤ «اختر كلّ النتائج» معطّلٌ بلا نتائج', r.res===0&&r.dis===true, JSON.stringify(r));
  await page.close(); }

// ط١٥ — بحثٌ لا يطابق يُظهر رسالة «لا فئة تطابق»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.type('zzزز'); const el=document.querySelector('#repCatList .catf-empty'); return { empty:!!el, txt:el?el.textContent:'' }; });
  ok('ط١٥ بحثٌ لا يطابق يُظهر «لا فئة تطابق»', r.empty&&r.txt.indexOf('لا فئة تطابق')>=0, JSON.stringify(r));
  await page.close(); }

// ط١٦ — الاختيار المتعدّد (فئتان) يجمع صفوفهما
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ window.__catf.toggle('أثاث'); window.__catf.toggle('ستائر رول');
    return { count:window.__catf.count(), rows:window.__catf.tableRows(), cats:window.__catf.filteredCats().slice().sort() }; });
  ok('ط١٦ اختيارٌ متعدّد (أثاث+ستائر رول) يجمع صفّيهما', r.count===2&&r.rows===2&&r.cats.length===2, JSON.stringify(r));
  await page.close(); }

// ط١٧ — لا فيضٌ أفقيٌّ على عرض هونر (٤٨٨px) مع لوحة الفلتر ظاهرة
{ const mctx=await browser.newContext({ viewport:{width:488,height:900} }); const page=await mctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>({ sw:document.documentElement.scrollWidth, vw:window.innerWidth, present:window.__catf.present() }));
  ok('ط١٧ لا تمرير أفقيّ على عرض ٤٨٨ مع لوحة الفلتر', r.present&&r.sw<=r.vw, JSON.stringify(r));
  await page.close(); await mctx.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
