// اختبارات ط-١١ + ط-١٢: استيراد ملفّ الكتالوج وتقريره
// تُثبت: أعمدة حوار «إضافة صنف يدوياً» نفسها إلزامًا واختيارًا، والمعاينة لا تكتب حرفًا،
// والتقطيع يمسّ القطع المتّسخة وحدها، وحذف القطع الفائضة، والتقرير عيّنةٌ بعدّاداتٍ كاملة،
// وحجب الأعمدة الماليّة حذفًا لا إخفاءً، وألّا تتجمّد الواجهة على ٢٠٬٠٠٠ صفّ.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

const pad = (i) => String(i).padStart(5, '0');
const bc = (i) => '6285000' + pad(i);
// كتالوجٌ قائم: ٩٠٠ صنفًا ⇒ ٣ قطع (٤٠٠+٤٠٠+١٠٠)
const CAT_N = 900;
const mkCat = (i) => ({ barcode: bc(i), code: bc(i), name: 'صنف ' + i, category: 'ق' + (i % 7), cost: (i % 13) + 1, unit: 'حبة', book: i % 5 });
const CAT = []; for (let i = 1; i <= CAT_N; i++) CAT.push(mkCat(i));
const chunkify = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const CHUNKS = chunkify(CAT, 400);
// صفّ ملفٍّ بترتيب القالب: باركود · اسم · فئة · تكلفة · وحدة · دفتريّ
const row = (b, n, c, co, u, bk) => [b, n, c, co, u === undefined ? '' : u, bk === undefined ? '' : bk];

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const sc = { profile: opt.profile || OWNER, users: [OWNER], sessions: [] };
  if (!opt.noSeed) { sc.catalogMeta = { ver: 'v1', count: CAT_N, at: 1750000000000 }; sc.catalogChunks = opt.chunks || CHUNKS; }
  if (opt.config) sc.config = opt.config;
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  if (!opt.noSeed) await page.evaluate(() => window.__cat.ensure());
  page.__ctx = ctx;
  return page;
}
const shut = async (p) => { await p.close(); await p.__ctx.close(); };
const plan = (p, rows) => p.evaluate(r => window.__cimp.plan(r), rows);

// ═════════ المجموعة أ — الإلزاميّ والاختياريّ: أعمدة حوار الإضافة اليدويّة نفسها ═════════
{
  const page = await open();
  const rows = [
    row(bc(9001), 'جديد أ', 'فئة جديدة', 10, 'حبة', 5),   // سليم
    row('', 'بلا باركود', 'ق1', 3),                        // رفض: الباركود إلزاميّ
    row(bc(9002), '', 'ق1', 3),                            // رفض: الاسم إلزاميّ
    row(bc(9003), 'بلا فئة', '', 3),                       // رفض: الفئة إلزاميّة
    row(bc(9004), 'تكلفة نصّيّة', 'ق1', 'كثير'),            // رفض: التكلفة غير رقميّة
    row(bc(9005), 'تكلفة سالبة', 'ق1', -4),                // رفض: سالبة
    row(bc(9006), 'بلا وحدة ولا دفتريّ', 'ق1', 7),          // سليم — الاختياريّ فارغ
  ];
  const P = await plan(page, rows);
  ok('أ١ الباركود إلزاميّ — الصفّ الفارغ يُرفض', P.rej.some(r => r.w.includes('الباركود إلزامي')), JSON.stringify(P.rej.map(r => r.w)));
  ok('أ٢ الاسم إلزاميّ', P.rej.some(r => r.w.includes('اسم المنتج إلزامي')));
  ok('أ٣ الفئة إلزاميّة', P.rej.some(r => r.w.includes('الفئة إلزاميّة')));
  ok('أ٤ التكلفة إلزاميّة ورقميّة', P.rej.some(r => r.w.includes('غير رقميّة')));
  ok('أ٥ التكلفة السالبة تُرفض', P.rej.some(r => r.w.includes('سالبة')));
  ok('أ٦ الوحدة والدفتريّ اختياريّان — الصفّ يمرّ بدونهما', P.neu.some(x => x.name === 'بلا وحدة ولا دفتريّ'), 'neu=' + P.neu.length);
  ok('أ٧ خمسة مرفوضة وصنفان جديدان بالضبط', P.rej.length === 5 && P.neu.length === 2, 'rej=' + P.rej.length + ' neu=' + P.neu.length);
  ok('أ٨ رقم السطر في الرفض يشير للملفّ (ترويسة + ١)', P.rej[0].l === 3, 'l=' + P.rej[0].l);

  // التكلفة صفر: مقبولة افتراضًا، ومرفوضة عند تفعيل المفتاح
  const z = [row(bc(9100), 'صفر', 'ق1', 0)];
  const P0 = await plan(page, z);
  ok('أ٩ التكلفة صفر مقبولة افتراضًا', P0.neu.length === 1 && P0.rej.length === 0, 'neu=' + P0.neu.length);
  await page.evaluate(() => window.__cimp.setOpt({ 'import.rejectZeroCost': true }));
  const P0b = await plan(page, z);
  ok('أ١٠ وتُرفض حين يُفعَّل import.rejectZeroCost', P0b.rej.length === 1 && P0b.neu.length === 0, JSON.stringify(P0b.rej));
  await page.evaluate(() => window.__cimp.clrOpt());
  await shut(page);
}

// ═════════ المجموعة ب — المطابقة والتطبيع ═════════
{
  const page = await open();
  ok('ب١ الأصفار البادئة تُجرَّد فتطابق القائم', await page.evaluate(() => window.__cimp.key('000123')) === '123');
  ok('ب٢ الفواصل والشرطات تُزال', await page.evaluate(() => window.__cimp.key('62 850-00')) === '6285000');
  ok('ب٣ الأرقام العربيّة تُترجَم', await page.evaluate(() => window.__cimp.key('٦٢٨٥')) === '6285');
  ok('ب٤ باركودٌ فارغ ⇒ مفتاحٌ فارغ', await page.evaluate(() => window.__cimp.key('  ')) === '');

  // صفٌّ بأصفارٍ بادئة يطابق صنفًا قائمًا ⇒ تحديثٌ لا إنشاء
  const P = await plan(page, [row('000' + bc(5), 'اسم معدَّل', 'ق5', 99, 'حبة', 0)]);
  ok('ب٥ الأصفار البادئة تُطابق القائم ⇒ تحديث لا إنشاء', P.upd.length === 1 && P.neu.length === 0, 'upd=' + P.upd.length + ' neu=' + P.neu.length);

  // التكرار داخل الملفّ: آخر صفٍّ يفوز، والأوّل يُخبَر عنه
  const D = await plan(page, [row(bc(9200), 'أوّل', 'ق1', 5), row(bc(9200), 'ثانٍ', 'ق1', 8)]);
  ok('ب٦ التكرار داخل الملفّ: آخر صفٍّ يفوز', D.neu.length === 1 && D.neu[0].name === 'ثانٍ', JSON.stringify(D.neu.map(x => x.name)));
  ok('ب٧ ويُخبَر عنه في المرفوضات لا يُبتلَع صامتًا', D.rej.length === 1 && D.rej[0].w.includes('مكرّر داخل الملفّ'), JSON.stringify(D.rej));
  await shut(page);
}

// ═════════ المجموعة ج — أقسام التقرير السبعة ═════════
{
  const page = await open();
  const rows = [
    row(bc(1), 'صنف 1', 'ق1', 2, 'حبة', 1),                       // بلا تغيير (مطابق للأصل)
    row(bc(2), 'اسم جديد', 'ق2', 3, 'حبة', 2),                    // تغيير الاسم فقط
    row(bc(3), 'صنف 3', 'ق3', 999, 'حبة', 3),                     // قفزة تكلفة
    row(bc(9300), 'وافد', 'فئة وافدة', 20, 'كرتون', 4),           // جديد
    row('', 'مرفوض', 'ق1', 1),                                    // مرفوض
  ];
  const P = await plan(page, rows);
  ok('ج١ «بلا تغيير» يُحصى ولا يُكتب', P.unchanged === 1, 'unchanged=' + P.unchanged);
  ok('ج٢ المحدَّثة تُفصَّل حقلًا حقلًا', P.upd.length === 2 && P.upd[0].ch.length >= 1, JSON.stringify(P.upd.map(u => u.ch.map(c => c.f))));
  ok('ج٣ عدّاد التغيير لكلّ حقل', P.byField.name >= 1 && P.byField.cost >= 1, JSON.stringify(P.byField));
  ok('ج٤ قفزة التكلفة تُعلَّم بنسبتها', P.jump === 1 && P.upd.some(u => u.ch.some(c => c.j)), 'jump=' + P.jump);
  ok('ج٥ الجديدة تُفصل عن المحدَّثة', P.neu.length === 1 && P.neu[0].name === 'وافد', 'neu=' + P.neu.length);
  ok('ج٦ الفئة الجديدة تُرصد', P.newCats.indexOf('فئة وافدة') >= 0, JSON.stringify(P.newCats));
  ok('ج٧ الغائبة عن الملفّ تُحصى كاملةً', P.miss.length === CAT_N - 3, 'miss=' + P.miss.length);
  ok('ج٨ المرفوضة بسببها', P.rej.length === 1, 'rej=' + P.rej.length);
  ok('ج٩ صافي أثر التكلفة يُحسَب', P.netCost === (999 - 4) + (3 - 3), 'net=' + P.netCost);
  ok('ج١٠ قيمة الرصيد المرفوع للجديد فقط', P.newValue === 20 * 4, 'val=' + P.newValue);
  ok('ج١١ صفوفٌ مقروءة وصفوفٌ مطبَّقة مُعلَنتان', P.rowsRead === 5 && P.rowsApplied === 4, P.rowsRead + '/' + P.rowsApplied);
  await shut(page);
}

// ═════════ المجموعة د — المعاينة لا تكتب حرفًا (قرار ٢-٣) ═════════
{
  const page = await open();
  const before = await page.evaluate(() => Object.keys(window.__store).length);
  await plan(page, [row(bc(9400), 'وافد', 'ق9', 5), row(bc(1), 'اسم مغيَّر', 'ق1', 2)]);
  const after = await page.evaluate(() => Object.keys(window.__store).length);
  ok('د١ بناء الخطّة لا يُنشئ مستندًا واحدًا', before === after, before + '→' + after);
  const ver = await page.evaluate(() => window.__cat.ver());
  ok('د٢ ونسخة الكتالوج لم تتغيّر بالمعاينة', ver === 'v1', 'ver=' + ver);
  const cnt = await page.evaluate(() => window.__cat.count());
  ok('د٣ والذاكرة لم تُمَسّ', cnt === CAT_N, 'count=' + cnt);
  await shut(page);
}

// ═════════ المجموعة هـ — التقطيع: القطع المتّسخة وحدها ═════════
{
  const page = await open();
  // إضافةٌ محضة: صنفان جديدان يذهبان إلى القطعة ٢ (الجزئيّة) وحدها
  const P1 = await plan(page, [row(bc(9500), 'وافد أ', 'ق1', 5), row(bc(9501), 'وافد ب', 'ق1', 6)]);
  const m1 = await page.evaluate(p => window.__cimp.merge(p, true, false), P1);
  ok('هـ١ الإضافة المحضة تمسّ القطعة الجزئيّة وحدها', m1.dirty.length === 1 && m1.dirty[0] === 2, JSON.stringify(m1.dirty));
  ok('هـ٢ ولا حذف لأيّ قطعة', m1.del.length === 0, JSON.stringify(m1.del));
  ok('هـ٣ والطول ٩٠٢', m1.n === 902, 'n=' + m1.n);

  // تحديثٌ لصنفٍ في القطعة ١ فقط
  const P2 = await plan(page, [row(bc(500), 'اسم مغيَّر', 'ق' + (500 % 7), 500 % 13 + 1, 'حبة', 500 % 5)]);
  const m2 = await page.evaluate(p => window.__cimp.merge(p, false, true), P2);
  ok('هـ٤ تحديث صنفٍ واحد يمسّ قطعته وحدها', m2.dirty.length === 1 && m2.dirty[0] === 1, JSON.stringify(m2.dirty));
  ok('هـ٥ ولا يُغيّر طول الكتالوج', m2.n === CAT_N, 'n=' + m2.n);

  // إلغاء تأشير «الجديدة» يمنع كتابتها
  const m3 = await page.evaluate(p => window.__cimp.merge(p, false, false), P1);
  ok('هـ٦ إلغاء التأشير ⇒ لا قطعة متّسخة ولا نموّ', m3.dirty.length === 0 && m3.n === CAT_N, JSON.stringify(m3.dirty) + ' n=' + m3.n);

  // وضع «الملفّ كتالوجٌ كامل»: الغائب يُسقَط والقطع الفائضة تُحذف
  await page.evaluate(() => window.__cimp.setOpt({ 'import.fileIsFullCatalog': true }));
  const small = []; for (let i = 1; i <= 300; i++) small.push(row(bc(i), 'صنف ' + i, 'ق' + (i % 7), (i % 13) + 1, 'حبة', i % 5));
  const P4 = await plan(page, small);
  const m4 = await page.evaluate(p => window.__cimp.merge(p, true, true), P4);
  ok('هـ٧ الاستبدال يُسقط الغائب: ٩٠٠ ⇒ ٣٠٠', m4.n === 300, 'n=' + m4.n);
  ok('هـ٨ والقطعتان الفائضتان تُحذفان صراحةً', m4.del.length === 2 && m4.del[0] === 1 && m4.del[1] === 2, JSON.stringify(m4.del));
  await page.evaluate(() => window.__cimp.clrOpt());
  await shut(page);
}

// ═════════ المجموعة و — التنفيذ الفعليّ يكتب ما وعد به ═════════
{
  const page = await open();
  const P = await plan(page, [row(bc(9600), 'وافد', 'ق1', 5, 'حبة', 2), row(bc(7), 'اسم بعد الاستيراد', 'ق0', 8, 'حبة', 2)]);
  const before = await page.evaluate(() => Object.keys(window.__store).filter(k => k.startsWith('catalogChunks/')).length);
  const w = await page.evaluate(p => window.__cimp.write(p, true, true), P);
  ok('و١ نسخةٌ جديدة تُكتب', !!w.ver && w.ver !== 'v1', 'ver=' + w.ver);
  const st = await page.evaluate(() => ({
    chunks: Object.keys(window.__store).filter(k => k.startsWith('catalogChunks/')).length,
    meta: window.__store['catalogMeta/version'],
    c2: (window.__store['catalogChunks/chunk_0002'] || {}).items.length
  }));
  ok('و٢ عدد القطع لم يتغيّر (٩٠١ ⇒ ٣ قطع)', st.chunks === before && before === 3, before + '→' + st.chunks);
  ok('و٣ مستند النسخة يحمل العدّ الصحيح', st.meta && st.meta.count === 901, JSON.stringify(st.meta && st.meta.count));
  ok('و٤ القطعة الأخيرة نمت إلى ١٠١', st.c2 === 101, 'c2=' + st.c2);
  const found = await page.evaluate(c => { const it = window.__cat.find(c); return it && it.name; }, bc(9600));
  ok('و٥ الوافد الجديد يُعثر عليه فورًا بالمسح', found === 'وافد', 'found=' + found);
  const upd = await page.evaluate(c => { const it = window.__cat.find(c); return it && it.name; }, bc(7));
  ok('و٦ والمحدَّث يعكس الاسم الجديد', upd === 'اسم بعد الاستيراد', 'name=' + upd);
  const mir = await page.evaluate(() => window.__cat.mirrorGet());
  ok('و٧ والمرآة المحليّة كُتبت بالنسخة نفسها', mir && mir.items.length === 901 && String(mir.ver) === String(w.ver), mir ? mir.items.length + '/' + mir.ver : 'null');
  await shut(page);
}

// ═════════ المجموعة ز — التقرير المحفوظ: عيّنةٌ بعدّاداتٍ كاملة ═════════
{
  const page = await open();
  await page.evaluate(() => window.__cimp.setOpt({ 'import.samplePerSection': 5 }));
  const rows = []; for (let i = 1; i <= 40; i++) rows.push(row(bc(20000 + i), 'وافد ' + i, 'ق1', i, 'حبة', 1));
  const P = await plan(page, rows);
  const d = await page.evaluate(p => window.__cimp.report(p, true, false, 940), P);
  ok('ز١ العدّادات كاملةٌ في المستند', d.counts.neu === 40 && d.counts.miss === CAT_N, JSON.stringify(d.counts));
  ok('ز٢ والعيّنة محدودةٌ بالإعداد', d.sample.neu.length === 5 && d.sample.miss.length === 5, d.sample.neu.length + '/' + d.sample.miss.length);
  ok('ز٣ والاقتطاع مُعلَنٌ صراحةً لا مخفيّ', d.truncated === true && d.sampleSize === 5, JSON.stringify({ t: d.truncated, s: d.sampleSize }));
  ok('ز٤ حجم المستند دون سقف ١ ميبي‑بايت', JSON.stringify(d).length < 700000, 'len=' + JSON.stringify(d).length);

  // إعادة الترطيب: العدّادات تُقرأ من counts لا من طول العيّنة — وهذا لبّ العيب المُصلَح
  const R = await page.evaluate(x => { const P2 = window.__cimp.saved(x); return { n: window.__cimp.n(P2, 'neu'), miss: window.__cimp.n(P2, 'miss'), len: P2.neu.length, tr: P2._trunc }; }, d);
  ok('ز٥ التقرير المحفوظ يُظهر ٤٠ جديدًا لا ٥', R.n === 40 && R.miss === CAT_N, JSON.stringify(R));
  ok('ز٦ مع بقاء الجدول عيّنةً', R.len === 5 && R.tr === true, JSON.stringify(R));
  await page.evaluate(() => window.__cimp.clrOpt());
  await shut(page);
}

// ═════════ المجموعة ح — الماليّة تُحذف حذفًا لا تُخفى ═════════
{
  // أمين مستودعٍ ليس المالك: يملك warehouse.manage ولا يملك report.finance
  const WH = { uid: 'u_wh', email: 'wh@dhtrd.com', name: 'أمين المستودع', role: 'مدير', active: true };
  const page = await open({ profile: WH, config: { users: { u_wh: { 'warehouse.manage': true, 'report.finance': false } } } });
  const P = await plan(page, [row(bc(9700), 'وافد', 'ق1', 5, 'حبة', 2)]);
  const fin = await page.evaluate(() => window.__cimp.fin());
  const sec = await page.evaluate(p => window.__cimp.sec(p, 'A', false), P); // fin=false صراحةً
  ok('ح١ الحساب بلا صلاحيّة ماليّة', fin === false, 'fin=' + fin);
  ok('ح٢ عمود التكلفة محذوفٌ من الترويسة', sec.h.indexOf('التكلفة') < 0, JSON.stringify(sec.h));
  ok('ح٣ ومحذوفٌ من كلّ صفّ — لا وجود له في DOM أصلًا', sec.rows.every(r => r.length === sec.h.length), 'h=' + sec.h.length + ' r0=' + (sec.rows[0] || []).length);
  const html = await page.evaluate(p => window.__cimp.render(p, 'preview'), P);
  ok('ح٤ ولا بطاقة أثرٍ ماليّ في الرسم', html.indexOf('صافي أثر التكلفة') < 0 && html.indexOf('قيمة الرصيد المرفوع') < 0);
  const aoa = await page.evaluate(p => window.__cimp.aoa(p), P);
  ok('ح٥ والتصدير نفسه خالٍ من الأرقام الماليّة', JSON.stringify(aoa).indexOf('صافي أثر التكلفة') < 0);

  const sec2 = await page.evaluate(p => window.__cimp.sec(p, 'A', true), P);
  ok('ح٦ ولمن يملكها العمود حاضر', sec2.h.indexOf('التكلفة') >= 0 && sec2.h.length === sec.h.length + 1, JSON.stringify(sec2.h));
  await shut(page);
}

// ═════════ المجموعة ط — الحدّ الأقصى والإلغاء وعدم التجميد (عتبة القبول ٧) ═════════
{
  const page = await open();
  await page.evaluate(() => window.__cimp.setOpt({ 'import.maxRows': 50 }));
  const many = []; for (let i = 1; i <= 120; i++) many.push(row(bc(30000 + i), 'س ' + i, 'ق1', 1));
  const Pm = await plan(page, many);
  ok('ط١ الحدّ الأقصى يُقصّ ويُعلن الفائض', Pm.neu.length === 50 && Pm.overMax === 70, 'neu=' + Pm.neu.length + ' over=' + Pm.overMax);
  await page.evaluate(() => window.__cimp.clrOpt());

  // الإلغاء أثناء التحليل يعيد null ولا يُبقي خطّةً معلّقة
  const abrt = await page.evaluate(async () => { window.__cimp.abort(true); const P = await window.__cimp.plan([['1', 'a', 'c', '1']]); window.__cimp.abort(false); return P; });
  ok('ط٢ الإلغاء يُنهي التحليل بلا خطّة', abrt === null, JSON.stringify(abrt));

  // ٢٠٬٠٠٠ صفّ: لا تجميد يتجاوز ٢٠٠ مللي بين تسليمَي الخيط
  const big = await page.evaluate(async (n) => {
    const rows = []; for (let i = 1; i <= n; i++) rows.push(['7' + String(i).padStart(11, '0'), 'ضخم ' + i, 'ق' + (i % 9), (i % 20) + 1, 'حبة', i % 7]);
    return await window.__cimp.planTimed(rows);
  }, 20000);
  ok('ط٣ عشرون ألف صفٍّ تُحلَّل كاملةً', big.ok && big.rowsRead === 20000 && big.neu === 20000, JSON.stringify(big));
  ok('ط٤ وأطول تجميدٍ للواجهة دون ٢٠٠ مللي (عتبة القبول ٧)', big.worst < 200, 'worst=' + Math.round(big.worst) + 'ms');
  await shut(page);
}

// ═════════ المجموعة ي — العَلَم والصلاحيّة ═════════
{
  const page = await open();
  ok('ي١ الكتالوج الرئيسيّ مُفعَّلٌ افتراضيًّا', await page.evaluate(() => window.__cimp.on()) === true);
  await page.evaluate(() => window.__cimp.setFeat(false));
  ok('ي٢ ويُطفأ من الإعدادات', await page.evaluate(() => window.__cimp.on()) === false);
  await page.evaluate(() => window.__cimp.setFeat(true));

  const nav = await page.evaluate(() => window.__cimp.nav());
  ok('ي٣ التبويب يظهر لمن يملك warehouse.manage', nav.indexOf('الكتالوج الرئيسيّ') >= 0);
  ok('ي٤ ولا صلاحيّة جديدة استُحدثت — warehouse.manage نفسها', nav.indexOf('data-tab="catalog"') >= 0);
  await shut(page);
}

// ═════════ المجموعة ك — الحارس: مسار رفع الجلسة لم يتغيّر ═════════
{
  const page = await open();
  const lbl = await page.evaluate(() => window.__cimp.mapLbl());
  ok('ك١ زرّ رفع الجلسة يبقى «رفع الأصناف» بعد إعادة الاستعمال', lbl === 'رفع الأصناف', 'lbl=' + lbl);
  const two = await page.evaluate(() => window.__cimp.shared());
  ok('ك٢ قارئ الملفّات مشترَك وسلوك handleFile محفوظ', two === true);
  await shut(page);
}

await browser.close();
const pass = results.filter(r => r.pass).length;
results.forEach(r => console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.n + (r.pass ? '' : '  ← ' + r.d)));
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
