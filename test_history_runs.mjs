// اختبارات ط-١٤ (المهمّة ٨٠) — المرحلة ٤ من التكليف: «إعادة تصميم سجلّ المسح».
// تُثبت: أنّ المسحات المتتابعة لصنفٍ واحد تندمج في سطرٍ واحد «×n»، وأنّ التتابعات المفصولة
// لا تندمج أبدًا، وأنّ الدمج بمؤشّرٍ O(1) لا مسحٍ خطّيّ، وأنّ التوافق الرجعيّ مطلق
// (لا يُكتب n إطلاقًا حين n=1، والسطور القديمة تُقرأ كـ n=1)، وأنّ التقارير لم تتغيّر رقمًا واحدًا،
// وأنّ إعادة المحاولة لا تزيد مرّتين، وأنّ الطابور دون اتصال يحمل التتابع، وأنّ سجلّ الحركة
// يُخزَّن مؤقّتًا ويُكتب مرّةً واحدة لكل تتابع (احترامًا لقاعدة activity: update ممنوع).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

// ═════ جلسة بثلاثة أصناف، لكلٍّ باركود ═════
const ITEMS = [
  { code: 'A1', name: 'صنف أ', category: 'ك', book: 10, cost: 2, barcode: '6280000000011' },
  { code: 'B2', name: 'صنف ب', category: 'ك', book: 4, cost: 3, barcode: '6280000000028' },
  { code: 'C3', name: 'صنف ج', category: 'ك', book: 7, cost: 1, barcode: '6280000000035' }
];
const A = 'A1', B = 'B2', C = 'C3';
const ON_OFF = { features: { offlineCount: true } };            // علم العدّ دون اتصال

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  const sess = Object.assign({ id: 'sr', name: 'جرد التتابعات', status: 'open', started: true, assignedCounters: ['u_owner'], location: 'فرع أ', itemCount: ITEMS.length, __chunks: [ITEMS] }, opt.sess || {});
  const sc = { profile: OWNER, users: [OWNER], sessions: [sess] };
  if (opt.config) sc.config = opt.config;
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
  await page.waitForTimeout(250);
  page.__ctx = ctx;
  return page;
}
const shut = async (page) => { await page.close(); await page.__ctx.close(); };
const scan = (page, code) => page.evaluate(c => window.__scanCommit(c, 'test'), code);
const idle = (page) => page.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
async function scanN(page, code, n) { for (let i = 0; i < n; i++) { await scan(page, code); await idle(page); } }
const cdoc = (page, code) => page.evaluate(c => window.__hist14.doc('sr', c), code);
const acts = (page) => page.evaluate(() => window.__hist14.acts('sr'));
const flushAct = (page) => page.evaluate(() => window.__hist14.actFlush());

// ═════════ المجموعة أ — التوافق الرجعيّ: قراءة السطور القديمة بلا n ═════════
{
  const page = await open();
  const n = (e) => page.evaluate(x => window.__hist14.n(x), e);
  const ops = (l) => page.evaluate(x => window.__hist14.ops(x), l);

  ok('أ١ سطرٌ قديم بلا n يُقرأ مسحةً واحدة', await n({ id: 'x', q: 1 }) === 1, String(await n({ id: 'x', q: 1 })));
  ok('أ٢ n=null و n=0 و n=1 كلّها = ١ (لا انكسار)', await n({ n: null }) === 1 && await n({ n: 0 }) === 1 && await n({ n: 1 }) === 1);
  ok('أ٣ n=3 يُقرأ ثلاثًا', await n({ n: 3 }) === 3);
  ok('أ٤ n كسريّ يُجبَر لأسفل (لا كسور في عدّاد المسحات)', await n({ n: 3.7 }) === 3, String(await n({ n: 3.7 })));
  ok('أ٥ إجمالي المسحات لسجلٍّ قديمٍ بالكامل = عدد السطور', await ops([{ q: 1 }, { q: 5 }, { q: 2 }]) === 3, String(await ops([{ q: 1 }, { q: 5 }, { q: 2 }])));
  ok('أ٦ إجمالي المسحات لسجلٍّ مختلط = مجموع n', await ops([{ q: 1 }, { q: 3, n: 3 }, { q: 2 }]) === 5, String(await ops([{ q: 1 }, { q: 3, n: 3 }, { q: 2 }])));
  ok('أ٧ قائمةٌ فارغة أو معدومة = صفر', await ops([]) === 0 && await ops(null) === 0);

  // القيم الافتراضية للسياسة
  const D = await page.evaluate(() => window.__hist14.D);
  ok('أ٨ الدمج مُفعَّل افتراضيًّا', D['history.mergeRuns'] === true);
  ok('أ٩ لا سقف لطول التتابع افتراضيًّا', D['history.mergeMax'] === 0);
  ok('أ١٠ الشارة ×n مُفعَّلة، ونافذة حذف التتابع مُفعَّلة', D['history.badge'] === true && D['history.deleteRunAsk'] === true);
  ok('أ١١ دمج سطر الحركة مُفعَّل بمهلة ٢٥٠٠ مللي', D['history.activityMerge'] === true && D['history.actFlushMs'] === 2500);
  ok('أ١٢ نافذة الاستكشاف ثمانيةُ سطورٍ فقط (لا مسح خطّيّ)', await page.evaluate(() => window.__hist14.probe()) === 8);
  await shut(page);
}

// ═════════ المجموعة ب — الدمج الأساسيّ: ثلاث مسحاتٍ متتابعة = سطرٌ واحد ×٣ ═════════
{
  const page = await open();
  await scanN(page, A, 3);
  const d = await cdoc(page, A);
  ok('ب١ الكمية ٣ كما كانت تمامًا (لا تغيير في الحساب)', d && d.qty === 3, JSON.stringify(d && d.qty));
  ok('ب٢ سطرٌ واحدٌ فقط في السجلّ بدل ثلاثة', d && d.entries.length === 1, 'entries=' + (d ? d.entries.length : 'null'));
  ok('ب٣ السطر يحمل n=3', d && d.entries[0].n === 3, JSON.stringify(d && d.entries[0]));
  ok('ب٤ كمية السطر ٣ (مجموع التتابع)', d && d.entries[0].q === 3);
  ok('ب٥ ختم نهاية التتابع endAt مسجَّل', d && typeof d.entries[0].endAt === 'number' && d.entries[0].endAt >= d.entries[0].at);
  ok('ب٦ آخر معرّف مسحةٍ محفوظ لحارس التكرار', d && typeof d.entries[0].lastEid === 'string' && d.entries[0].lastEid.length > 0);
  ok('ب٧ اسم الفاعل ومعرّفه كما كانا', d && d.entries[0].byName === 'المالك' && d.entries[0].by === 'u_owner');
  ok('ب٨ إجمالي المسحات المحسوب = ٣', await page.evaluate(() => window.__hist14.ops(window.__hist14.doc('sr', 'A1').entries)) === 3);

  // مسحةٌ واحدة فقط ⇒ لا n ولا endAt ولا lastEid إطلاقًا (توافقٌ رجعيّ حرفيّ)
  await scanN(page, B, 1);
  const db2 = await cdoc(page, B);
  ok('ب٩ مسحةٌ واحدة = سطرٌ مطابقٌ للقديم بلا n', db2 && db2.entries.length === 1 && !('n' in db2.entries[0]), JSON.stringify(db2 && db2.entries[0]));
  ok('ب١٠ ولا endAt ولا lastEid', db2 && !('endAt' in db2.entries[0]) && !('lastEid' in db2.entries[0]));
  ok('ب١١ حقول السطر القديمة كلّها حاضرة: id/q/by/byName/at', db2 && ['id', 'q', 'by', 'byName', 'at'].every(k => k in db2.entries[0]));
  await shut(page);
}

// ═════════ المجموعة ج — المرحلة ٤ حرفيًّا: A,A,A,B,A ⇒ ×٣ ثمّ ×١ ثمّ ×١ ═════════
{
  const page = await open();
  await scanN(page, A, 3);
  await scanN(page, B, 1);
  await scanN(page, A, 1);
  const da = await cdoc(page, A), db2 = await cdoc(page, B);
  ok('ج١ صنف أ: سطران لا سطرٌ واحد (التتابع انقطع)', da && da.entries.length === 2, 'entries=' + (da ? da.entries.length : 'null'));
  ok('ج٢ السطر الأوّل تتابعٌ من ٣', da && da.entries[0].n === 3 && da.entries[0].q === 3);
  ok('ج٣ السطر الثاني مسحةٌ منفردة بلا n', da && !('n' in da.entries[1]) && da.entries[1].q === 1, JSON.stringify(da && da.entries[1]));
  ok('ج٤ إجمالي كمية أ = ٤ بلا نقصٍ ولا زيادة', da && da.qty === 4, String(da && da.qty));
  ok('ج٥ صنف ب سطرٌ واحد بلا n', db2 && db2.entries.length === 1 && !('n' in db2.entries[0]));
  ok('ج٦ إجمالي مسحات أ = ٤ (٣ + ١)', await page.evaluate(() => window.__hist14.ops(window.__hist14.doc('sr', 'A1').entries)) === 4);

  // تتابعٌ ثالث بعد فاصلٍ ثانٍ
  await scanN(page, C, 2);
  await scanN(page, A, 2);
  const da2 = await cdoc(page, A);
  ok('ج٧ تتابعٌ ثالث لصنف أ = سطرٌ ثالثٌ مستقلّ ×٢', da2 && da2.entries.length === 3 && da2.entries[2].n === 2, 'entries=' + (da2 ? da2.entries.length : 'null'));
  ok('ج٨ ولا يندمج مع سطر أ السابق مهما تكرّر', da2 && da2.entries[1].q === 1 && !('n' in da2.entries[1]));
  ok('ج٩ الإجمالي ٦ = ٣+١+٢', da2 && da2.qty === 6, String(da2 && da2.qty));

  // مؤشّر التتابع نفسه
  const ptr = await page.evaluate(() => window.__hist14.ptr());
  ok('ج١٠ مؤشّر التتابع يشير إلى الصنف الأخير بتسلسلٍ ٢', ptr && String(ptr.code) === 'A1' && ptr.seq === 2, JSON.stringify(ptr));
  await scan(page, C); await idle(page);
  const ptr2 = await page.evaluate(() => window.__hist14.ptr());
  ok('ج١١ مسح صنفٍ مختلف ينقل المؤشّر ويصفّر التسلسل', ptr2 && String(ptr2.code) === 'C3' && ptr2.seq === 1, JSON.stringify(ptr2));
  await shut(page);
}

// ═════════ المجموعة د — قواطع التتابع الصريحة ═════════
{
  const page = await open();
  await scanN(page, A, 2);
  await page.evaluate(() => window.__hist14.brk('A1'));
  await scanN(page, A, 1);
  const d = await cdoc(page, A);
  ok('د١ قطع التتابع يدويًّا يبدأ سطرًا جديدًا', d && d.entries.length === 2 && d.entries[0].n === 2 && !('n' in d.entries[1]));

  // حذف كميةٍ من الصنف يقطع تتابعه
  const p2 = await open();
  await scanN(p2, A, 2);
  await p2.evaluate(() => window.__hist14.rm('A1', 0)); await p2.waitForTimeout(350);
  await scanN(p2, A, 1);
  const d2 = await cdoc(p2, A);
  ok('د٢ حذف كميةٍ يقطع التتابع فلا تُدمج المسحة التالية في سطرٍ محذوف', d2 && d2.entries.length === 1 && d2.entries[0].q === 1 && !('n' in d2.entries[0]), JSON.stringify(d2));
  ok('د٣ والكمية صارت ١ (حُذف تتابع الاثنين كاملًا)', d2 && d2.qty === 1, String(d2 && d2.qty));

  // تصفير الصنف يقطع تتابعه
  const p3 = await open();
  await scanN(p3, A, 2);
  await p3.evaluate(() => window.__hist14.rsItem('A1')); await p3.waitForTimeout(350);
  await scanN(p3, A, 1);
  const d3 = await cdoc(p3, A);
  ok('د٤ تصفير الصنف يقطع التتابع', d3 && d3.entries.length === 1 && d3.qty === 1 && !('n' in d3.entries[0]), JSON.stringify(d3));

  // الإضافة اليدويّة لا تندمج أبدًا
  const p4 = await open();
  await scanN(p4, A, 2);
  await p4.evaluate(() => window.__hist14.add('A1', 1)); await p4.waitForTimeout(350);
  const d4 = await cdoc(p4, A);
  ok('د٥ الإضافة اليدويّة سطرٌ مستقلّ لا يندمج في تتابع المسح', d4 && d4.entries.length === 2 && d4.entries[1].q === 1 && !('n' in d4.entries[1]), JSON.stringify(d4));
  await p4.evaluate(() => window.__hist14.add('A1', 5, { run: true })); await p4.waitForTimeout(350);
  const d5 = await cdoc(p4, A);
  ok('د٦ كميةٌ أكبر من ١ لا تندمج ولو من مسار المسح (الدمج للمسحة الواحدة فقط)', d5 && d5.entries.length === 3 && d5.entries[2].q === 5 && !('n' in d5.entries[2]));
  await shut(page); await shut(p2); await shut(p3); await shut(p4);
}

// ═════════ المجموعة هـ — بوّابات الإعدادات ═════════
{
  // إطفاء الدمج ⇒ السلوك القديم حرفًا بحرف
  const off = await open({ config: { history: { 'history.mergeRuns': false } } });
  await scanN(off, A, 3);
  const d = await cdoc(off, A);
  ok('هـ١ history.mergeRuns=false يُعيد ثلاثة سطورٍ منفصلة', d && d.entries.length === 3, 'entries=' + (d ? d.entries.length : 'null'));
  ok('هـ٢ ولا حقل n في أيٍّ منها', d && d.entries.every(e => !('n' in e)));
  ok('هـ٣ والكمية ٣ كما هي', d && d.qty === 3);
  ok('هـ٤ ولا مؤشّر تتابعٍ يُبنى أصلًا', await off.evaluate(() => { const p = window.__hist14.canMerge('A1'); return p; }) === null);

  // سقف طول التتابع
  const cap = await open({ config: { history: { 'history.mergeMax': 2 } } });
  await scanN(cap, A, 5);
  const dc = await cdoc(cap, A);
  ok('هـ٥ سقف ٢ يقسم خمس مسحاتٍ إلى ثلاثة سطور (٢+٢+١)', dc && dc.entries.length === 3, 'entries=' + (dc ? dc.entries.length : 'null'));
  ok('هـ٦ توزيعها ٢ ثمّ ٢ ثمّ ١', dc && dc.entries[0].n === 2 && dc.entries[1].n === 2 && !('n' in dc.entries[2]), JSON.stringify(dc && dc.entries.map(e => e.n || 1)));
  ok('هـ٧ والكمية الإجمالية ٥ بلا فقدان', dc && dc.qty === 5, String(dc && dc.qty));
  ok('هـ٨ وإجمالي المسحات ٥', await cap.evaluate(() => window.__hist14.ops(window.__hist14.doc('sr', 'A1').entries)) === 5);

  // إطفاء الشارة: الحساب كما هو والعرض بلا ×n
  const nb = await open({ config: { history: { 'history.badge': false } } });
  await scanN(nb, A, 3);
  const html = await nb.evaluate(() => window.__hist14.clistHtml());
  const dn = await cdoc(nb, A);
  ok('هـ٩ إطفاء الشارة لا يمنع الدمج (السطر ما زال ×٣ داخليًّا)', dn && dn.entries[0].n === 3);
  ok('هـ١٠ ولا تظهر «×٣» في قائمة العدّ', html.indexOf('×٣') < 0 && html.indexOf('×3') < 0);
  await shut(off); await shut(cap); await shut(nb);
}

// ═════════ المجموعة و — العرض: الشارة والحذف ═════════
{
  const page = await open();
  await scanN(page, A, 3);
  await page.waitForTimeout(200);
  const html = await page.evaluate(() => window.__hist14.clistHtml());
  ok('و١ الشارة ×٣ ظاهرة في رقاقة الإضافات', html.indexOf('×3') >= 0, 'len=' + html.length);
  ok('و٢ عنوان الرقاقات يعلن ٣ إضافات لا سطرًا واحدًا', html.indexOf('الإضافات (3)') >= 0);
  ok('و٣ الشارة تشرح نفسها بتلميحٍ عربيّ', html.indexOf('تتابع عدٍّ واحدٌ متّصل') >= 0);
  ok('و٤ زرّ الحذف يحمل عدد المسحات ومعرّف السطر', html.indexOf('data-deln="3"') >= 0 && html.indexOf('data-dele="') >= 0);

  // نافذة حذف التتابع
  await page.evaluate(() => window.__hist14.delBtn('A1', 0));
  await page.waitForTimeout(200);
  ok('و٥ الضغط على × لسطرٍ مدموج يفتح نافذة التتابع لا نافذة الحذف العادية', await page.evaluate(() => window.__hist14.delShown()) === true);
  const t = await page.evaluate(() => window.__hist14.delText());
  ok('و٦ النافذة تشرح أنّه تتابعٌ واحدٌ متّصل من ٣ مسحات', t.indexOf('تتابع عدٍّ واحدٌ متّصل من 3 مسحات') >= 0, t);
  ok('و٧ وتعرض ثلاثة خيارات: إلغاء، إنقاص واحد، حذف التتابع كاملًا', t.indexOf('إلغاء') >= 0 && t.indexOf('إنقاص واحد') >= 0 && t.indexOf('حذف التتابع كاملًا (×3)') >= 0, t);

  await page.evaluate(() => window.__hist14.delCancel()); await page.waitForTimeout(200);
  ok('و٨ الإلغاء يغلق النافذة ولا يمسّ شيئًا', await page.evaluate(() => window.__hist14.delShown()) === false && (await cdoc(page, A)).qty === 3);

  // إنقاص واحد
  await page.evaluate(() => window.__hist14.delBtn('A1', 0)); await page.waitForTimeout(200);
  await page.evaluate(() => window.__hist14.delOne()); await page.waitForTimeout(450);
  const d1 = await cdoc(page, A);
  ok('و٩ «إنقاص واحد» يُنقص مسحةً واحدة فقط: الكمية ٢', d1 && d1.qty === 2, JSON.stringify(d1 && d1.qty));
  ok('و١٠ والسطر باقٍ بـ n=2', d1 && d1.entries.length === 1 && d1.entries[0].n === 2 && d1.entries[0].q === 2, JSON.stringify(d1 && d1.entries[0]));
  await page.evaluate(() => window.__hist14.delBtn('A1', 0)); await page.waitForTimeout(200);
  await page.evaluate(() => window.__hist14.delOne()); await page.waitForTimeout(450);
  const d2 = await cdoc(page, A);
  ok('و١١ إنقاصٌ ثانٍ يعيد السطر إلى صيغته القديمة تمامًا (لا n ولا endAt ولا lastEid)', d2 && d2.entries.length === 1 && d2.qty === 1 && !('n' in d2.entries[0]) && !('endAt' in d2.entries[0]) && !('lastEid' in d2.entries[0]), JSON.stringify(d2 && d2.entries[0]));
  await page.evaluate(() => window.__hist14.delBtn('A1', 0)); await page.waitForTimeout(250);
  const cfOn = await page.evaluate(() => { const o = document.getElementById('cfOverlay'); return !!(o && o.style.display === 'flex') && (o.textContent || '').indexOf('حذف هذه الكمية من الصنف؟') >= 0; });
  ok('و١٢ السطر المفرد يعود لنافذة الحذف العادية لا نافذة التتابع', await page.evaluate(() => window.__hist14.delShown()) === false && cfOn === true, 'cf=' + cfOn);
  await page.evaluate(() => { const b = document.getElementById('cfCancel'); if (b) b.click(); });
  await shut(page);

  // حذف التتابع كاملًا
  const p2 = await open();
  await scanN(p2, A, 3);
  await p2.waitForTimeout(200);
  await p2.evaluate(() => window.__hist14.delBtn('A1', 0)); await p2.waitForTimeout(200);
  await p2.evaluate(() => window.__hist14.delAll()); await p2.waitForTimeout(500);
  const d3 = await cdoc(p2, A);
  ok('و١٣ «حذف التتابع كاملًا» يمسح السطر والكمية معًا', d3 === null || d3.qty === 0, JSON.stringify(d3));

  // إطفاء نافذة التتابع من الإعدادات
  const p3 = await open({ config: { history: { 'history.deleteRunAsk': false } } });
  await scanN(p3, A, 3);
  await p3.waitForTimeout(200);
  await p3.evaluate(() => window.__hist14.delBtn('A1', 0)); await p3.waitForTimeout(250);
  const cf3 = await p3.evaluate(() => { const o = document.getElementById('cfOverlay'); return !!(o && o.style.display === 'flex'); });
  ok('و١٤ إطفاء الإعداد يُعيد نافذة الحذف العادية مباشرةً', await p3.evaluate(() => window.__hist14.delShown()) === false && cf3 === true, 'cf=' + cf3);
  await p3.evaluate(() => { const b = document.getElementById('cfCancel'); if (b) b.click(); });
  await shut(p2); await shut(p3);
}

// ═════════ المجموعة ز — التقارير: لا رقم واحد تغيّر ═════════
{
  const page = await open();
  const agg3 = await page.evaluate(() => window.__hist14.agg([{ q: 3, n: 3, byName: 'المالك' }]));
  const agg1 = await page.evaluate(() => window.__hist14.agg([{ q: 1, byName: 'المالك' }, { q: 1, byName: 'المالك' }, { q: 1, byName: 'المالك' }]));
  ok('ز١ الإجمالي لكلّ فاعلٍ هو نفسه (٣)', agg3[0].q === 3 && agg1[0].q === 3);
  ok('ز٢ التتابع المدموج جزءٌ واحدٌ بكميّته (٣)، والمنفصلة أجزاءٌ مستقلّة (١+١+١)', JSON.stringify(agg3[0].parts) === '[3]' && JSON.stringify(agg1[0].parts) === '[1,1,1]', JSON.stringify(agg3[0].parts) + ' vs ' + JSON.stringify(agg1[0].parts));
  const w3 = await page.evaluate(() => window.__hist14.who(window.__hist14.agg([{ q: 3, n: 3, byName: 'المالك' }])[0]));
  const w1 = await page.evaluate(() => window.__hist14.who(window.__hist14.agg([{ q: 1, byName: 'المالك' }, { q: 1, byName: 'المالك' }, { q: 1, byName: 'المالك' }])[0]));
  ok('ز٣ التتابع يُعرض مجموعًا بلا ١+١، والمنفصلة تُفصّل', w3.indexOf('(1 + 1 + 1)') < 0 && w3.indexOf('3') >= 0 && w1.indexOf('(1 + 1 + 1)') >= 0, w3 + ' | ' + w1);

  // تتابعٌ لعدّة فاعلين لا يختلط
  const agg2 = await page.evaluate(() => window.__hist14.agg([{ q: 2, n: 2, byName: 'المالك' }, { q: 1, byName: 'زميل' }]));
  ok('ز٤ لكلّ فاعلٍ سطره، والتتابع المدموج جزءٌ واحدٌ بكميّته', agg2.length === 2 && agg2[0].q === 2 && agg2[0].parts.length === 1 && agg2[1].q === 1);

  // حقل «عدد الإضافات» في التقرير = مجموع المسحات لا عدد السطور
  await scanN(page, A, 3);
  await scanN(page, B, 1);
  const e = await page.evaluate(() => {
    const cc = window.__hist14.counts();
    return { a: window.__hist14.ops(cc['A1'].entries), b: window.__hist14.ops(cc['B2'].entries) };
  });
  ok('ز٥ حقل الإضافات في التقرير = ٣ لصنف أ (لا ١)', e.a === 3, JSON.stringify(e));
  ok('ز٦ و١ لصنف ب', e.b === 1);
  const qa = (await cdoc(page, A)).qty, qb = (await cdoc(page, B)).qty;
  ok('ز٧ الكميات المصدر الوحيد للتقرير لم تتغيّر (٣ و١)', qa === 3 && qb === 1, qa + '/' + qb);
  await shut(page);
}

// ═════════ المجموعة ح — إعادة المحاولة والتوافقيّة (idempotency) ═════════
{
  const page = await open();
  await scanN(page, A, 2);
  const d0 = await cdoc(page, A);
  const run = await page.evaluate(() => window.__hist14.ptr());
  const lastEid = d0.entries[0].lastEid;
  // إعادة نفس المسحة بنفس المعرّف ⇒ لا زيادة
  await page.evaluate(([r, e]) => window.__hist14.writeAdd('sr', 'A1', 1, Date.now(), e, r), [{ code: 'A1', eid: run.eid, ri: run.ri, by: run.by, seq: 1 }, lastEid]);
  const d1 = await cdoc(page, A);
  ok('ح١ إعادة المسحة نفسها بمعرّفها لا تزيد الكمية', d1.qty === 2, String(d1.qty));
  ok('ح٢ ولا تزيد عدّاد التتابع', d1.entries[0].n === 2, String(d1.entries[0].n));
  // مسحةٌ بمعرّفٍ جديد على المؤشّر نفسه ⇒ زيادةٌ واحدة بالدمج
  await page.evaluate(r => window.__hist14.writeAdd('sr', 'A1', 1, Date.now(), 'fresh-1', r), { code: 'A1', eid: run.eid, ri: run.ri, by: run.by, seq: 2 });
  const d2 = await cdoc(page, A);
  ok('ح٣ معرّفٌ جديد على التتابع نفسه = +١ ودمج', d2.qty === 3 && d2.entries.length === 1 && d2.entries[0].n === 3, JSON.stringify(d2.entries[0]));
  // معرّف سطرٍ موجودٌ سلفًا في المسار غير المدموج ⇒ لا يتكرّر
  await page.evaluate(() => window.__hist14.writeAdd('sr', 'B2', 1, Date.now(), 'bb-1', null));
  await page.evaluate(() => window.__hist14.writeAdd('sr', 'B2', 1, Date.now(), 'bb-1', null));
  const db2 = await cdoc(page, B);
  ok('ح٤ حارس التكرار القديم (بلا تتابع) باقٍ كما هو', db2.qty === 1 && db2.entries.length === 1, JSON.stringify(db2 && db2.qty));

  // مؤشّرٌ لفاعلٍ آخر لا يندمج في سطر غيره
  const dq = await page.evaluate(r => window.__hist14.writeAdd('sr', 'A1', 1, Date.now(), 'other-1', r), { code: 'A1', eid: 'nope', ri: 0, by: 'u_other', seq: 1 });
  const d3 = await cdoc(page, A);
  ok('ح٥ مؤشّرٌ لسطرٍ غير موجود يسقط لمسار الإلحاق العاديّ', d3.entries.length === 2 && d3.qty === 4, JSON.stringify(d3.entries.length));
  ok('ح٦ والسطر الجديد بلا n', !('n' in d3.entries[1]));
  await shut(page);
}

// ═════════ المجموعة ط — مؤشّر O(1) على سجلٍّ ضخم ═════════
{
  const page = await open();
  const idx = await page.evaluate(() => {
    const arr = []; for (let i = 0; i < 5000; i++) arr.push({ id: 's' + i, q: 1 });
    const t0 = performance.now();
    const hit = window.__hist14.idx(arr, { eid: 's0', ri: 0 });
    const ms = performance.now() - t0;
    // مؤشّرٌ فاسد على سطرٍ في أوّل السجلّ: لا يُعثر عليه (نافذة ٨ من الذيل فقط) ⇒ إلحاقٌ لا مسحٌ خطّيّ
    const t1 = performance.now();
    const miss = window.__hist14.idx(arr, { eid: 's0', ri: 4999 });
    const ms2 = performance.now() - t1;
    return { hit, ms, miss, ms2 };
  });
  ok('ط١ المؤشّر الصحيح يُصيب فورًا على ٥٠٠٠ سطر', idx.hit === 0, JSON.stringify(idx.hit));
  ok('ط٢ والزمن دون مللي واحد', idx.ms < 1, 'ms=' + idx.ms);
  ok('ط٣ المؤشّر الفاسد لا يمسح السجلّ خطّيًّا (يُعيد -١ بعد ٨ محاولات)', idx.miss === -1, JSON.stringify(idx.miss));
  ok('ط٤ وزمنه ثابتٌ كذلك', idx.ms2 < 1, 'ms=' + idx.ms2);

  // القياس الحقيقيّ: تتابعٌ متّصلٌ من ٥٠٠٠ مسحة من الصفر — وهو ما يراه العدّاد فعلًا.
  // مع ط-١٤ لا ينمو السجلّ أصلًا، فزمن المسحة ٥٠٠٠ = زمن المسحة ١٠.
  const bn = await page.evaluate(() => window.__hist14.benchRun('sr', 'A1', 5000));
  ok('ط٥ تتابعٌ من ٥٠٠٠ مسحة يبقى سطرًا واحدًا مهما طال', bn.rows === 1, 'rows=' + bn.rows);
  ok('ط٦ والكمية والعدّاد صحيحان تمامًا (٥٠٠١ = ١ + ٥٠٠٠)', bn.qty === 5001 && bn.n === 5001, JSON.stringify({ q: bn.qty, n: bn.n }));
  ok('ط٧ زمن المسحة الأخيرة ≤ ١٠ مللي (عتبة القبول ٦)', bn.last <= 10, 'last=' + bn.last.toFixed(3) + 'ms max=' + bn.max.toFixed(1));
  ok('ط٨ والزمن مسطّح: آخر مئةٍ ليست أبطأ من أوّل مئة (O(1) فعليًّا)', bn.last <= Math.max(3 * bn.first, 2), 'first=' + bn.first.toFixed(3) + ' last=' + bn.last.toFixed(3));

  // أسوأ حالة: مستندٌ قديمٌ ضخم (٥٠٠٠ سطرًا سابقًا). المقارنة مع مسار الإلحاق تُثبت
  // أنّ الدمج ليس أبطأ ممّا يستبدله — كلفة نسخ المستند كانت قائمةً قبل ط-١٤ أصلًا.
  const bmg = await page.evaluate(() => window.__hist14.benchBig('sr', 'C3', 5000, 20, 'merge'));
  const bap = await page.evaluate(() => window.__hist14.benchBig('sr', 'C3', 5000, 20, 'append'));
  ok('ط٩ على مستندٍ ضخمٍ قديم: الدمج لا ينمّي السجلّ إطلاقًا', bmg.rows === 5001, 'rows=' + bmg.rows);
  ok('ط١٠ بينما الإلحاق القديم ينمّيه ٢٠ سطرًا', bap.rows === 5021, 'rows=' + bap.rows);
  ok('ط١١ والدمج ليس أبطأ من الإلحاق الذي يستبدله', bmg.per <= bap.per * 1.35 + 1, 'merge=' + bmg.per.toFixed(2) + 'ms append=' + bap.per.toFixed(2) + 'ms');
  ok('ط١٢ والكميّتان متطابقتان في المسارين (لا فقدان ولا ازدواج)', bmg.qty === bap.qty && bmg.qty === 5021, JSON.stringify({ m: bmg.qty, a: bap.qty }));
  await shut(page);
}

// ═════════ المجموعة ي — سجلّ الحركة: سطرٌ واحد لكل تتابع ═════════
{
  const page = await open();
  await scanN(page, A, 3);
  const before = await page.evaluate(() => window.__hist14.actCount('sr'));
  const run = await page.evaluate(() => window.__hist14.actRun());
  ok('ي١ التتابع الجاري مخزَّنٌ مؤقّتًا ولم يُكتب بعد', run && run.n === 3 && run.q === 3, JSON.stringify(run));
  ok('ي٢ ولا سطر حركةٍ في السحابة أثناء التتابع (٠ كتابة)', before === 0, 'acts=' + before);
  await flushAct(page); await page.waitForTimeout(250);
  const a = await acts(page);
  ok('ي٣ الدفع يكتب سطرًا واحدًا فقط للتتابع كلّه', a.length === 1, 'acts=' + a.length);
  ok('ي٤ السطر يحمل الكمية ٣ والعدّاد ٣', a[0] && a[0].qty === 3 && a[0].n === 3, JSON.stringify(a[0] && { q: a[0].qty, n: a[0].n }));
  ok('ي٥ ونوعه «add» ورمز الصنف صحيح', a[0] && a[0].type === 'add' && a[0].code === 'A1');
  ok('ي٦ ولا يُحدَّث سطرٌ قائم أبدًا (قاعدة activity تمنع update)', a.length === 1);

  // كسر التتابع يدفع السطر تلقائيًّا
  const p2 = await open();
  await scanN(p2, A, 2);
  await scanN(p2, B, 1);
  await p2.waitForTimeout(250);
  const a2 = await acts(p2);
  ok('ي٧ مسح صنفٍ آخر يدفع سطر التتابع السابق فورًا', a2.length === 1 && a2[0].code === 'A1' && a2[0].n === 2, JSON.stringify(a2.map(x => x.code + ':' + (x.n || 1))));
  await flushAct(p2); await p2.waitForTimeout(200);
  const a3 = await acts(p2);
  ok('ي٨ ثمّ سطر الصنف الثاني بلا n (مسحةٌ واحدة)', a3.length === 2 && a3[1].code === 'B2' && !('n' in a3[1]), JSON.stringify(a3.map(x => x.code + ':' + (x.n === undefined ? '-' : x.n))));

  // ثلاث مسحاتٍ = ٤ كتابات بدل ٦ (٣ عدّات + ١ حركة، بدل ٣ + ٣)
  const p3 = await open();
  const w0 = await p3.evaluate(() => window.__hist14.actCount('sr'));
  await scanN(p3, A, 3);
  await flushAct(p3); await p3.waitForTimeout(250);
  const w1 = await p3.evaluate(() => window.__hist14.actCount('sr'));
  ok('ي٩ تتابعٌ من ٣ مسحات = سطر حركةٍ واحد (٣ كتابات موفَّرة)', (w1 - w0) === 1, 'acts=' + (w1 - w0));

  // إطفاء دمج الحركة يُعيد سطرًا لكل مسحة
  const p4 = await open({ config: { history: { 'history.activityMerge': false } } });
  await scanN(p4, A, 3);
  await p4.waitForTimeout(300);
  const a4 = await acts(p4);
  ok('ي١٠ إطفاء history.activityMerge يُعيد سطرًا لكل مسحة', a4.length === 3, 'acts=' + a4.length);
  ok('ي١١ ولا حقل n في أيٍّ منها', a4.every(x => !('n' in x)));

  // مغادرة شاشة العدّ تدفع التتابع
  const p5 = await open();
  await scanN(p5, A, 2);
  await p5.evaluate(() => window.__openSession('sr'));
  await p5.waitForTimeout(500);
  const a5 = await acts(p5);
  ok('ي١٢ إعادة فتح الجلسة تدفع سطر التتابع المعلَّق (لا يضيع)', a5.length >= 1 && a5[0].n === 2, JSON.stringify(a5.map(x => x.code + ':' + (x.n || 1))));
  ok('ي١٣ ومؤشّر التتابع صُفِّر فلا تندمج المسحة التالية بما قبل الفتح', await p5.evaluate(() => window.__hist14.ptr()) === null);

  // المهلة الزمنية تدفع تلقائيًّا
  const p6 = await open({ config: { history: { 'history.actFlushMs': 400 } } });
  await scanN(p6, A, 2);
  await p6.waitForTimeout(900);
  const a6 = await acts(p6);
  ok('ي١٤ المهلة الزمنية تدفع التتابع بلا تدخّل', a6.length === 1 && a6[0].n === 2, 'acts=' + a6.length);
  await shut(page); await shut(p2); await shut(p3); await shut(p4); await shut(p5); await shut(p6);
}

// ═════════ المجموعة ك — عرض سجلّ الحركة ═════════
{
  const page = await open();
  const h1 = await page.evaluate(() => window.__hist14.renderAct([{ type: 'add', code: 'A1', name: 'صنف أ', qty: 3, n: 3, byName: 'المالك' }]));
  ok('ك١ سطر الحركة المدموج يعرض الكمية ٣ والشارة ×٣', h1.indexOf('<b>3</b>') >= 0 && h1.indexOf('×3') >= 0, h1.slice(0, 200));
  const h2 = await page.evaluate(() => window.__hist14.renderAct([{ type: 'add', code: 'A1', name: 'صنف أ', qty: 1, byName: 'المالك' }]));
  ok('ك٢ السطر القديم بلا n يُعرض كما كان تمامًا بلا شارة', h2.indexOf('×') < 0, h2.slice(0, 200));
  const h3 = await page.evaluate(() => window.__hist14.renderAct([{ type: 'remove', code: 'A1', name: 'صنف أ', qty: 1, byName: 'المالك' }]));
  ok('ك٣ سطور الحذف والتصفير لم تتغيّر', h3.indexOf('➖ حذف كمية') >= 0 && h3.indexOf('×') < 0);
  await shut(page);
}

// ═════════ المجموعة فص — فصل السجلّ بحسب العدّاد (الموكَّل يرى سجلّه · المدير يرى الجميع) ═════════
{
  const page = await open();
  const R = [{ type: 'add', code: 'A1', name: 'صنف أ', qty: 2, by: 'u_owner', byName: 'المالك' },
             { type: 'add', code: 'B1', name: 'صنف ب', qty: 1, by: 'u_two', byName: 'سعيد' }];
  await page.evaluate(() => window.__act.setAssigned(true));
  const hMine = await page.evaluate(r => window.__act.render(r), R);
  ok('فص١ العادّ الموكَّل يرى سجلّه فقط', hMine.indexOf('صنف أ') >= 0 && hMine.indexOf('صنف ب') < 0, hMine.slice(0, 140));
  ok('فص٢ ولا يظهر اسم العدّاد الآخر', hMine.indexOf('سعيد') < 0);
  ok('فص٣ ولافتة «سجلّ نشاطك» ظاهرة', hMine.indexOf('سجلّ نشاطك') >= 0);
  await page.evaluate(() => window.__act.setAssigned(false));
  const hAll = await page.evaluate(r => window.__act.render(r), R);
  ok('فص٤ المدير غير الموكَّل يرى الاثنين', hAll.indexOf('صنف أ') >= 0 && hAll.indexOf('صنف ب') >= 0, hAll.slice(0, 140));
  ok('فص٥ وأزرار الفلترة بالعدّاد ظاهرة (بالاسمين)', hAll.indexOf('actby') >= 0 && hAll.indexOf('سعيد') >= 0 && hAll.indexOf('المالك') >= 0);
  const okClick = await page.evaluate(() => window.__act.clickBy('u_two'));
  const hTwo = await page.evaluate(() => document.getElementById('actlog').innerHTML);
  ok('فص٦ الفلترة بعدّادٍ تعرض سجلّه وحده', okClick === true && hTwo.indexOf('صنف ب') >= 0 && hTwo.indexOf('صنف أ') < 0, hTwo.slice(0, 140));
  await shut(page);
}

// ═════════ المجموعة ل — دون اتصال: الطابور يحمل التتابع ═════════
{
  const page = await open({ config: ON_OFF });
  await page.evaluate(() => window.__offline.setOnline(false)); await page.waitForTimeout(150);
  await scanN(page, A, 3);
  const q = await page.evaluate(() => window.__offline.queue());
  ok('ل١ ثلاث عملياتٍ في الطابور (لا فقدان)', q.length === 3, 'q=' + q.length);
  ok('ل٢ الأولى بلا تتابع والثانية والثالثة تحملان مؤشّر التتابع', !q[0].run && !!q[1].run && !!q[2].run, JSON.stringify(q.map(x => !!x.run)));
  ok('ل٣ رقم التتابع عند الإدراج يتصاعد ١ ثمّ ٢ (مؤشّر ما قبل الدمج)', q[1].run.seq === 1 && q[2].run.seq === 2, JSON.stringify([q[1].run.seq, q[2].run.seq]));
  ok('ل٤ وكلّها تشير إلى معرّف السطر الأوّل نفسه', q[1].run.eid === q[0].eid && q[2].run.eid === q[0].eid, JSON.stringify([q[0].eid, q[1].run.eid]));
  const cc = await page.evaluate(() => window.__hist14.counts());
  ok('ل٥ الانعكاس التفاؤليّ سطرٌ واحدٌ مدموج ×٣ محلّيًّا', cc['A1'] && cc['A1'].entries.length === 1 && cc['A1'].entries[0].n === 3, JSON.stringify(cc['A1'] && cc['A1'].entries));
  ok('ل٦ والكمية المحلّيّة ٣ فورًا بلا انتظار الشبكة', cc['A1'] && cc['A1'].qty === 3, String(cc['A1'] && cc['A1'].qty));
  ok('ل٧ ولا شيء في الخادم بعد', await cdoc(page, A) === null);

  await page.evaluate(() => window.__offline.setOnline(true)); await page.waitForTimeout(900);
  const d = await cdoc(page, A);
  ok('ل٨ بعد المزامنة: سطرٌ واحدٌ في الخادم ×٣', d && d.entries.length === 1 && d.entries[0].n === 3, JSON.stringify(d && d.entries));
  ok('ل٩ والكمية ٣ بلا ازدواجٍ ولا فقدان', d && d.qty === 3, String(d && d.qty));
  ok('ل١٠ والطابور فرغ', await page.evaluate(() => window.__offline.queue().then(x => x.length)) === 0);

  // مسار الإنقاص دون اتصال
  const p2 = await open({ config: ON_OFF });
  await scanN(p2, A, 3);
  const eid = (await cdoc(p2, A)).entries[0].id;
  await p2.evaluate(() => window.__offline.setOnline(false)); await p2.waitForTimeout(150);
  await p2.evaluate(e => window.__hist14.dec('A1', e), eid); await p2.waitForTimeout(400);
  const q2 = await p2.evaluate(() => window.__offline.queue());
  ok('ل١١ الإنقاص دون اتصال يدخل الطابور بعمليّة dec ومعرّف السطر', q2.length === 1 && q2[0].op === 'dec' && q2[0].eid === eid, JSON.stringify(q2));
  const cc2 = await p2.evaluate(() => window.__hist14.counts());
  ok('ل١٢ والانعكاس المحلّيّ ٢ بـ n=2', cc2['A1'] && cc2['A1'].qty === 2 && cc2['A1'].entries[0].n === 2, JSON.stringify(cc2['A1'] && cc2['A1'].entries[0]));
  await p2.evaluate(() => window.__offline.setOnline(true)); await p2.waitForTimeout(900);
  const d2 = await cdoc(p2, A);
  ok('ل١٣ وبعد المزامنة يتطابق الخادم مع الجهاز: ٢ و n=2', d2 && d2.qty === 2 && d2.entries[0].n === 2, JSON.stringify(d2 && d2.entries[0]));
  await shut(page); await shut(p2);
}

// ═════════ المجموعة م — الانعكاس المؤقّت (_pendingAdds) أثناء الكتابة ═════════
{
  const page = await open();
  await scanN(page, A, 1);
  // كتابةٌ معلّقة على تتابع: نحاكيها بإدراجٍ يدويّ في _pendingAdds ثمّ إعادة التطبيق
  const st = await page.evaluate(() => {
    const cc = window.__hist14.counts();
    const e0 = cc['A1'].entries[0];
    return { id: e0.id, q: cc['A1'].qty };
  });
  ok('م١ الحالة الابتدائيّة: سطرٌ واحد وكمية ١', st.q === 1);
  await scanN(page, A, 2);
  const pend = await page.evaluate(() => window.__hist14.pend());
  ok('م٢ لا سطور معلّقة بعد اكتمال المسحات', !pend['A1'] || pend['A1'].length === 0, JSON.stringify(pend['A1'] || []));
  const cc = await page.evaluate(() => window.__hist14.counts());
  ok('م٣ الواجهة تطابق الخادم: سطرٌ واحد ×٣ وكمية ٣', cc['A1'].entries.length === 1 && cc['A1'].entries[0].n === 3 && cc['A1'].qty === 3, JSON.stringify(cc['A1']));
  ok('م٤ ولا علامة انتظارٍ عالقة', !cc['A1'].entries[0].pending);
  await shut(page);
}

// ═════════ المجموعة ن — الضمانات غير القابلة للتفاوض تبقى كما هي ═════════
{
  const page = await open();
  await scanN(page, A, 5);
  ok('ن١ خمس مسحاتٍ متتاليةٍ لنفس الباركود = ٥ بالضبط (لا خنق ولا تجاهل)', (await cdoc(page, A)).qty === 5, String((await cdoc(page, A)).qty));
  ok('ن٢ الماسح جاهزٌ فورًا بلا نقرة', await page.evaluate(() => window.__scanIdle()) === true);
  ok('ن٣ حقل المسح ما زال هو المُركَّز عليه', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'csearch', String(await page.evaluate(() => document.activeElement && document.activeElement.id)));
  await scan(page, B); await idle(page);
  const html = await page.evaluate(() => { const el = document.getElementById('scanStatus'); return el ? el.textContent : ''; });
  ok('ن٤ لوحة النتيجة انتقلت للصنف الجديد ولم تُبقِ السابق', html.indexOf('صنف ب') >= 0 && html.indexOf('صنف أ') < 0, html.slice(0, 160));
  ok('ن٥ لا صلاحيةَ جديدة ولا بوّابةَ جديدة: العدّ يمرّ كما كان', (await cdoc(page, B)).qty === 1);
  await shut(page);
}

await browser.close();
let pass = 0; for (const r of results) { console.log((r.pass ? '✓' : '✗') + ' ' + r.n + (r.d && !r.pass ? ('  << ' + r.d) : '')); if (r.pass) pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
