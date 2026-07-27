// اختبارات ط-١٨ — فلترا التقرير المنبثقان المتعدّدان (الفئات + الحالات) وبلاطة «من الكتالوج»
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const VW = { uid:'u_vw', email:'vw@dhtrd.com', name:'مطّلع', role:'مطّلع', active:true };
// ٦ أصناف أساس بفئاتٍ متمايزة + صنفا كتالوج (manual+src=catalog) بفئة «أثاث»
const CATI=[[
  {code:'A1',name:'صنف أ',category:'سجّاد تركي',book:10,cost:5},
  {code:'A2',name:'صنف ب',category:'سجّاد صيني',book:4,cost:5},
  {code:'A3',name:'صنف ج',category:'سجّاد مسجد',book:6,cost:5},
  {code:'B1',name:'صنف د',category:'ستائر رول',book:3,cost:10},
  {code:'B2',name:'صنف هـ',category:'ستائر شيفون',book:2,cost:10},
  {code:'C1',name:'صنف و',category:'أثاث',book:5,cost:20},
]];
const CATX=[{code:'K1',name:'صنف كتالوج ١',category:'أثاث',cost:7,book:0,src:'catalog'},
            {code:'K2',name:'صنف كتالوج ٢',category:'أثاث',cost:9,book:0,src:'catalog'}];
const CATC=[{code:'A1',qty:10},{code:'C1',qty:5}]; // A1,C1 معدودان (مطابقان) — لاختبار فلتر «المعدود»
const CATSESS={id:'s1',name:'جرد الفئات',status:'approved',location:'فرع أ',assignedCounters:['u_owner'],itemCount:8,__chunks:CATI,__extras:CATX,__counts:CATC};
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
async function openRep(page){ await page.evaluate(()=>window.__openReport('s1'));
  await page.waitForFunction('window.__mf&&window.__mf("repCatBox").present()&&window.__mf("repCatBox").tableRows()===8',{timeout:9000}); await page.waitForTimeout(120); }

// ===================== الفئات (منبثق متعدّد) — المجموعة ط =====================
// ط١ — منبثق حاضر، لا اختيار، الزرّ «كلّ الفئات»، كلّ الصفوف (٨)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); return {present:C.present(),label:C.label(),count:C.count(),rows:C.tableRows(),fc:C.filteredCount()}; });
  ok('ط١ فلتر الفئات منبثق: زرٌّ «كلّ الفئات»، لا اختيار = ٨ صفوف', r.present&&r.label==='كلّ الفئات'&&r.count===0&&r.rows===8&&r.fc===8, JSON.stringify(r));
  await page.close(); }

// ط٢ — الفئات المتمايزة الستّ مدرجة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>window.__mf('repCatBox').options());
  const set=new Set(r);
  ok('ط٢ الفئات الستّ مدرجة', r.length===6&&set.has('أثاث')&&set.has('ستائر رول')&&set.has('سجّاد تركي'), JSON.stringify(r));
  await page.close(); }

// ط٣ — تبديل «أثاث» ⇒ ٣ صفوف (C1 + صنفا الكتالوج) + عدّاد ١ + الزرّ يعرض الفئة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.toggle('أثاث'); return {count:C.count(),rows:C.tableRows(),label:C.label(),fc:C.filteredCount()}; });
  ok('ط٣ تبديل «أثاث» ⇒ ٣ صفوف + الزرّ «أثاث»', r.count===1&&r.rows===3&&r.label==='أثاث'&&r.fc===3, JSON.stringify(r));
  await page.close(); }

// ط٤ — الطباعة/التصدير (filteredReportRows) تحترم الاختيار
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.toggle('أثاث'); return {fc:C.filteredCount(),cats:C.filteredCats()}; });
  ok('ط٤ الطباعة/التصدير تحترم اختيار «أثاث» (٣ صفوف فئتها أثاث)', r.fc===3&&r.cats.length===1&&r.cats[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط٥ — «مسح الكلّ» يعيد ٨ صفوف والزرّ «كلّ الفئات»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.toggle('أثاث'); C.toggle('ستائر رول'); const mid=C.count(); C.clear(); return {mid,count:C.count(),rows:C.tableRows(),label:C.label()}; });
  ok('ط٥ «مسح الكلّ» يُلغي الفلتر (٨ صفوف)', r.mid===2&&r.count===0&&r.rows===8&&r.label==='كلّ الفئات', JSON.stringify(r));
  await page.close(); }

// ط٦ — البحث «ستائر» ⇒ نتيجتان + الملاحظة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('ستائر'); return {res:C.results(),rows:C.rows(),note:C.note()}; });
  ok('ط٦ البحث «ستائر» ⇒ نتيجتان في القائمة والملاحظة', r.res.length===2&&r.rows.length===2&&r.note.indexOf('ستائر')>=0&&/[2٢]/.test(r.note), JSON.stringify(r));
  await page.close(); }

// ط٧ — Enter يختار كلّ النتائج («سجاد» ⇒ ٣ فئات، ٣ صفوف)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('سجاد'); C.enter(); return {count:C.count(),rows:C.tableRows(),fc:C.filteredCount(),sel:C.selected()}; });
  ok('ط٧ Enter = اختيار كلّ نتائج «سجاد» (٣ فئات، ٣ صفوف)', r.count===3&&r.rows===3&&r.fc===3&&r.sel.every(s=>s.indexOf('سجّاد')===0), JSON.stringify(r));
  await page.close(); }

// ط٨ — زرّ «اختر كلّ النتائج» يختار المطابق
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('سجاد'); C.selectAll(); return {count:C.count(),rows:C.tableRows()}; });
  ok('ط٨ «اختر كلّ النتائج» يختار المطابق (٣)', r.count===3&&r.rows===3, JSON.stringify(r));
  await page.close(); }

// ط٩ — التطبيع العربيّ: «اثاث» يطابق «أثاث»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('اثاث'); const res=C.results(); C.enter(); return {res,count:C.count(),sel:C.selected()}; });
  ok('ط٩ التطبيع: «اثاث» يطابق «أثاث»', r.res.length===1&&r.res[0]==='أثاث'&&r.count===1&&r.sel[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ط١٠ — الزرّ يعرض العدد حين يتجاوز الاختيار واحدًا («٣ فئات»)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('سجاد'); C.enter(); return C.label(); });
  ok('ط١٠ زرّ الفئات يعرض «٣ فئات» عند تعدّد الاختيار', /3\s*فئات/.test(r), r);
  await page.close(); }

// ط١١ — Backspace على بحثٍ فارغٍ يزيل آخر مختار
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.toggle('سجّاد تركي'); C.toggle('ستائر رول'); C.key('Backspace'); return {count:C.count(),sel:C.selected()}; });
  ok('ط١١ Backspace يزيل آخر مختار', r.count===1&&r.sel[0]==='سجّاد تركي', JSON.stringify(r));
  await page.close(); }

// ط١٢ — ↓ ينقل التظليل والمسافة تبدّل المظلَّل
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.key('ArrowDown'); const hl=C.hl(); const t=C.results()[hl]; C.key(' '); return {hl,t,sel:C.selected()}; });
  ok('ط١٢ ↓ + مسافة تبدّل المظلَّل', r.hl===1&&r.sel.length===1&&r.sel[0]===r.t, JSON.stringify(r));
  await page.close(); }

// ط١٣ — «مسح الكلّ» معطّلٌ بلا اختيار ونشطٌ بعده
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); const d0=C.clrDisabled(); C.toggle('أثاث'); return {d0,d1:C.clrDisabled()}; });
  ok('ط١٣ «مسح الكلّ» معطّلٌ بلا اختيار ونشطٌ بعده', r.d0===true&&r.d1===false, JSON.stringify(r));
  await page.close(); }

// ط١٤ — «اختر كلّ النتائج» معطّلٌ بلا نتائج
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); C.type('zzxx'); return {res:C.results().length,dis:C.selAllDisabled()}; });
  ok('ط١٤ «اختر كلّ النتائج» معطّلٌ بلا نتائج', r.res===0&&r.dis===true, JSON.stringify(r));
  await page.close(); }

// ط١٥ — زرّ الفئات يفتح ويغلق المنبثق (ظهورٌ فعليٌّ لا مجرّد صنف open)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'); const a=C.popShown(); C.open(); const b=C.popShown(); C.close(); const c=C.popShown(); return {a,b,c}; });
  ok('ط١٥ الزرّ يفتح المنبثق ويُخفيه فعليًّا عند الإغلاق', r.a===false&&r.b===true&&r.c===false, JSON.stringify(r));
  await page.close(); }

// ط١٥ب — النقر على الزرّ ذاته وهو مفتوحٌ يُغلقه فعليًّا (toggle)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const btn=document.getElementById('repStatBox_btn'); const S=window.__mf('repStatBox'); btn.click(); const open=S.popShown(); btn.click(); const closed=S.popShown(); return {open,closed}; });
  ok('ط١٥ب نقر الزرّ يفتح ثمّ يغلق فعليًّا (toggle)', r.open===true&&r.closed===false, JSON.stringify(r));
  await page.close(); }

// ط١٥ج — فتح منبثقٍ يُخفي الآخر فعليًّا (لا يظهر الاثنان معًا)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'),S=window.__mf('repStatBox'); C.open(); const catOpen=C.popShown(); S.open(); return {catThenStat_cat:C.popShown(),catThenStat_stat:S.popShown(),catWasOpen:catOpen}; });
  ok('ط١٥ج فتح الحالات يُخفي الفئات (منبثقٌ واحدٌ ظاهرٌ فقط)', r.catWasOpen===true&&r.catThenStat_stat===true&&r.catThenStat_cat===false, JSON.stringify(r));
  await page.close(); }

// ط١٦ — لا فيض أفقيّ على عرض هونر (٤٨٨) مع الفلترين المنبثقين
{ const mctx=await browser.newContext({ viewport:{width:488,height:900} }); const page=await mctx.newPage();
  await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,vw:window.innerWidth,cat:window.__mf('repCatBox').present(),stat:window.__mf('repStatBox').present()}));
  ok('ط١٦ لا تمرير أفقيّ على ٤٨٨ مع الفلترين', r.cat&&r.stat&&r.sw<=r.vw, JSON.stringify(r));
  await page.close(); await mctx.close(); }

// ===================== الحالات (منبثق متعدّد) — المجموعة ح =====================
// ح١ — الحالات منبثق متعدّد بلا بحث، زرّ «كلّ الحالات»، وخيار «من الكتالوج» مدرج
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); return {present:S.present(),label:S.label(),hasSearch:S.hasSearch(),opts:S.options()}; });
  ok('ح١ الحالات منبثق متعدّد + خيار «من الكتالوج»', r.present&&r.label==='كلّ الحالات'&&r.hasSearch===false&&r.opts.includes('catalog')&&r.opts.includes('surplus'), JSON.stringify(r.opts));
  await page.close(); }

// ح٢ — تبديل «المعدود فقط» ⇒ صفّان (A1,C1) + الزرّ يعرض الحالة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.toggle('counted'); return {rows:S.tableRows(),fc:S.filteredCount(),label:S.label()}; });
  ok('ح٢ «المعدود فقط» ⇒ صفّان + الزرّ يعرض الحالة', r.rows===2&&r.fc===2&&r.label==='المعدود فقط', JSON.stringify(r));
  await page.close(); }

// ح٣ — اختيار متعدّد للحالات: «المعدود» + «من الكتالوج» ⇒ اتّحاد ٤ صفوف + الزرّ «٢ حالات»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.toggle('counted'); S.toggle('catalog'); return {count:S.count(),rows:S.tableRows(),fc:S.filteredCount(),label:S.label()}; });
  ok('ح٣ حالات متعدّدة (معدود+كتالوج) = اتّحاد ٤ صفوف', r.count===2&&r.rows===4&&r.fc===4&&/2\s*حالات/.test(r.label), JSON.stringify(r));
  await page.close(); }

// ح٤ — «مسح الكلّ» للحالات يعيد ٨ صفوف
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.toggle('counted'); S.toggle('catalog'); S.clear(); return {count:S.count(),rows:S.tableRows(),label:S.label()}; });
  ok('ح٤ «مسح الكلّ» للحالات يعيد ٨ صفوف', r.count===0&&r.rows===8&&r.label==='كلّ الحالات', JSON.stringify(r));
  await page.close(); }

// ح٥ — نقر بلاطة «زيادة» يضبط فلتر الحالات على surplus (الزرّ يزامن)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.tile('surplus'); return {sel:S.selected(),label:S.label(),active:S.tileActive('surplus')}; });
  ok('ح٥ بلاطة «زيادة» تضبط الحالات على surplus وتزامن الزرّ', r.sel.length===1&&r.sel[0]==='surplus'&&r.label.indexOf('الزيادات')>=0&&r.active===true, JSON.stringify(r));
  await page.close(); }

// ح٦ — نقر بلاطة «الأصناف» (الكل) يمسح فلتر الحالات
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.toggle('counted'); S.tile('all'); return {count:S.count(),rows:S.tableRows(),active:S.tileActive('all')}; });
  ok('ح٦ بلاطة «الأصناف» تمسح فلتر الحالات', r.count===0&&r.rows===8&&r.active===true, JSON.stringify(r));
  await page.close(); }

// ===================== بلاطة «من الكتالوج» — المجموعة ك =====================
// ك١ — البلاطة حاضرة وقيمتها = عدد أصناف الكتالوج (٢)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); return {val:S.tileVal('catalog')}; });
  ok('ك١ بلاطة «من الكتالوج» قيمتها ٢', r.val==='2', JSON.stringify(r));
  await page.close(); }

// ك٢ — البلاطة ظاهرة للمطّلع (وكلّ المستخدمين)
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); const t=[...document.querySelectorAll('#repTiles [data-f]')].find(x=>x.getAttribute('data-f')==='catalog'); return {present:!!t,val:S.tileVal('catalog')}; });
  ok('ك٢ بلاطة الكتالوج ظاهرة للمطّلع', r.present&&r.val==='2', JSON.stringify(r));
  await page.close(); }

// ك٣ — نقر البلاطة يفلتر لأصناف الكتالوج فقط (٢)، وتصير نشطة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const S=window.__mf('repStatBox'); S.tile('catalog'); return {rows:S.tableRows(),fc:S.filteredCount(),active:S.tileActive('catalog'),sel:S.selected(),cats:S.filteredCats()}; });
  ok('ك٣ نقر بلاطة الكتالوج ⇒ صنفا الكتالوج فقط', r.rows===2&&r.fc===2&&r.active===true&&r.sel[0]==='catalog'&&r.cats.length===1&&r.cats[0]==='أثاث', JSON.stringify(r));
  await page.close(); }

// ك٤ — تقاطع الفلترين: فئة «أثاث» + حالة «الكتالوج» ⇒ صنفا الكتالوج (لا C1)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[CATSESS]}); await openRep(page);
  const r=await page.evaluate(()=>{ const C=window.__mf('repCatBox'),S=window.__mf('repStatBox'); C.toggle('أثاث'); S.toggle('catalog'); return {rows:S.tableRows(),fc:S.filteredCount()}; });
  ok('ك٤ تقاطع (فئة أثاث ∩ حالة كتالوج) ⇒ صنفا الكتالوج (٢)', r.rows===2&&r.fc===2, JSON.stringify(r));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
