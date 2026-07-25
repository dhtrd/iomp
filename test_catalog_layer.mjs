// اختبارات ط-١٠ (المهمّة ٦٤): طبقة الكتالوج الرئيسيّ
// تُثبت: سلّم القراءات (ذاكرة ← مرآة ← مستند نسخة ← قطع)، وأنّ البحث وقت المسح O(1)
// ولا يمسّ Firestore إطلاقًا، وأنّ الأعطال لا تمحو المرآة، وأنّ الطبقة قراءةٌ محضة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

const CAT_N = 900;                                        // ٩٠٠ صنف ⇒ ٣ قطع (٤٠٠+٤٠٠+١٠٠)
const pad = (i) => String(i).padStart(5, '0');
const bcat = (i) => '6285000' + pad(i);
const mkCat = (i) => ({ barcode: bcat(i), code: 'C' + pad(i), name: 'صنف كتالوج ' + i, category: 'ق' + (i % 7), cost: (i % 13) + 1, unit: 'حبة' });
const CAT = []; for (let i = 1; i <= CAT_N; i++) CAT.push(mkCat(i));
const chunkify = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const CHUNKS = chunkify(CAT, 400);                        // ٣ قطع
const EXTRA = []; for (let i = CAT_N + 1; i <= CAT_N + 120; i++) EXTRA.push(mkCat(i)); // قطعة رابعة للنسخة v2

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

// كلّ فتحةٍ في سياقٍ مستقلّ ⇒ عزل كامل لـ localStorage (المرآة على file:// تسكن فيه)
async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const sc = { profile: OWNER, users: [OWNER], sessions: [] };
  if (!opt.noMeta) sc.catalogMeta = opt.meta || { ver: 'v1', count: CAT_N, at: 1750000000000 };
  if (!opt.noChunks) sc.catalogChunks = opt.chunks || CHUNKS;
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  page.__ctx = ctx;
  return page;
}
const shut = async (page) => { await page.close(); await page.__ctx.close(); };
const ens = (page, o) => page.evaluate(x => window.__cat.ensure(x), o || null);

// ═════════ المجموعة أ — الثوابت وسلّم القراءات ═════════
{
  const page = await open();

  ok('أ١ حجم القطعة ٤٠٠ — نمط لقطة الجلسة نفسه', await page.evaluate(() => window.__cat.chunkSize()) === 400,
    'ch=' + await page.evaluate(() => window.__cat.chunkSize()));
  ok('أ١ب مفتاح المرآة iomp-catalog-v1', await page.evaluate(() => window.__cat.cacheKey()) === 'iomp-catalog-v1');

  // لا تحميل تلقائيّ ولا مستمع دائم: صفر قراءات قبل أوّل طلبٍ صريح
  ok('أ٢ لا قراءة تلقائيّة عند الإقلاع', await page.evaluate(() => window.__cat.reads()) === 0 && await page.evaluate(() => window.__cat.loaded()) === false,
    'reads=' + await page.evaluate(() => window.__cat.reads()) + ' loaded=' + await page.evaluate(() => window.__cat.loaded()));

  const r1 = await ens(page);
  ok('أ٣ أوّل ضمان يُنزّل من السحابة', r1.source === 'cloud' && r1.count === CAT_N && r1.ver === 'v1', JSON.stringify(r1));
  ok('أ٣ب كلفته = مستند نسخة + ٣ قطع = ٤ قراءات', r1.reads === 4, 'reads=' + r1.reads);

  const m = await page.evaluate(() => window.__cat.mirrorGet());
  ok('أ٤ المرآة كُتبت كاملةً بالنسخة', !!m && m.items.length === CAT_N && m.ver === 'v1', m ? (m.items.length + '/' + m.ver) : 'null');

  const r2 = await ens(page);
  ok('أ٥ الضمان الثاني من الذاكرة بصفر قراءات', r2.source === 'memory' && r2.reads === 0, JSON.stringify(r2));

  await page.evaluate(() => window.__cat.clear());
  const r3 = await ens(page);
  ok('أ٦ بعد مسح الذاكرة: المرآة بقراءةٍ واحدة فقط', r3.source === 'mirror' && r3.reads === 1 && r3.count === CAT_N, JSON.stringify(r3));

  // تغيّر النسخة ⇒ إعادة تنزيل القطع (٤ قطع الآن)
  await page.evaluate(items => { window.__store['catalogChunks/chunk_0003'] = { items }; window.__store['catalogMeta/version'].ver = 'v2'; }, EXTRA);
  await page.evaluate(() => window.__cat.clear());
  const r4 = await ens(page);
  ok('أ٧ تغيّر النسخة يُعيد التنزيل', r4.source === 'cloud' && r4.count === CAT_N + EXTRA.length && r4.ver === 'v2', JSON.stringify(r4));
  ok('أ٧ب كلفته = مستند نسخة + ٤ قطع = ٥ قراءات', r4.reads === 5, 'reads=' + r4.reads);

  const m2 = await page.evaluate(() => window.__cat.mirrorGet());
  ok('أ٨ المرآة حُدِّثت إلى النسخة الجديدة', !!m2 && m2.ver === 'v2' && m2.items.length === CAT_N + EXTRA.length, m2 ? (m2.ver + '/' + m2.items.length) : 'null');

  // الطبقة قراءةٌ محضة: لا تكتب في Firestore حرفًا
  const kBefore = await page.evaluate(() => Object.keys(window.__store).length);
  await ens(page, { force: true });
  const kAfter = await page.evaluate(() => Object.keys(window.__store).length);
  ok('أ٩ الطبقة لا تكتب في Firestore إطلاقًا', kBefore === kAfter, kBefore + '→' + kAfter);

  await shut(page);
}

// ═════════ المجموعة ب — الأعطال ودون اتصال: المرآة لا تُمحى أبدًا ═════════
{
  const page = await open();
  await ens(page);                                                     // ملء المرآة أوّلًا

  await page.evaluate(() => window.__offline.setOnlineNoFlush(false));
  await page.evaluate(() => window.__cat.clear());
  const r = await ens(page);
  ok('ب١ دون اتصال: المرآة تخدم بصفر قراءات', r.source === 'mirror-offline' && r.reads === 0 && r.count === CAT_N && r.ok === true, JSON.stringify(r));
  ok('ب١ب البحث يعمل دون اتصال', await page.evaluate(() => !!window.__cat.find('6285000' + '00007')) === true);

  await page.evaluate(() => window.__offline.setOnlineNoFlush(true));
  await page.evaluate(() => window.__failRead('catalogMeta/version', true));
  await page.evaluate(() => window.__cat.clear());
  const r2 = await ens(page);
  ok('ب٢ عطل مستند النسخة لا يمحو المرآة', r2.source === 'mirror-neterr' && r2.count === CAT_N && r2.ok === true, JSON.stringify(r2));
  await page.evaluate(() => window.__failRead('catalogMeta/version', false));

  await page.evaluate(() => { window.__store['catalogMeta/version'].ver = 'v9'; window.__failRead('catalogChunks', true); });
  await page.evaluate(() => window.__cat.clear());
  const r3 = await ens(page);
  ok('ب٣ عطل تنزيل القطع لا يمحو المرآة', r3.source === 'mirror-fallback' && r3.count === CAT_N && r3.error === 'chunks', JSON.stringify(r3));
  await page.evaluate(() => window.__failRead('catalogChunks', false));

  await shut(page);
}

// ═════════ المجموعة ج — الحالات الحدّية: بلا مرآة، وبلا كتالوج أصلًا ═════════
{
  const page = await open();
  await page.evaluate(() => window.__offline.setOnlineNoFlush(false));
  const r = await ens(page);
  ok('ج١ دون اتصال وبلا مرآة: فشلٌ صريح لا انهيار', r.ok === false && r.source === 'none' && r.reads === 0 && r.count === 0, JSON.stringify(r));
  await shut(page);
}
{
  const page = await open({ noMeta: true, noChunks: true });
  const r = await ens(page);
  ok('ج٢ لا كتالوج منشور بعد: نتيجة فارغة بقراءةٍ واحدة', r.ok === true && r.source === 'empty' && r.reads === 1 && r.count === 0, JSON.stringify(r));
  ok('ج٢ب البحث في كتالوجٍ فارغ يعيد null', await page.evaluate(() => window.__cat.find('123')) === null);
  await shut(page);
}

// ═════════ المجموعة د — الفهرس والبحث ═════════
{
  const page = await open();
  await ens(page);

  const byBar = await page.evaluate(() => window.__cat.find('628500000007'));
  ok('د١ البحث بالباركود', !!byBar && byBar.code === 'C00007', JSON.stringify(byBar));
  const byCode = await page.evaluate(() => window.__cat.find('C00007'));
  ok('د٢ البحث بكود الصنف', !!byCode && byCode.barcode === '628500000007', JSON.stringify(byCode));
  const trimmed = await page.evaluate(() => window.__cat.find('   628500000007   '));
  ok('د٣ تطبيع المسافات', !!trimmed && trimmed.code === 'C00007');
  ok('د٤ باركود مجهول يعيد null', await page.evaluate(() => window.__cat.find('9999999999999')) === null);
  ok('د٥ مدخل فارغ يعيد null', await page.evaluate(() => window.__cat.find('')) === null && await page.evaluate(() => window.__cat.find(null)) === null);

  // ترتيب القطع محفوظ: صنفٌ من القطعة الثانية والثالثة
  const b401 = await page.evaluate(() => window.__cat.find('628500000401'));
  const b900 = await page.evaluate(() => window.__cat.find('628500000900'));
  ok('د٦ الدمج بين القطع مرتَّب (صنف ٤٠١ من القطعة ٢)', !!b401 && b401.name === 'صنف كتالوج 401', JSON.stringify(b401));
  ok('د٦ب آخر صنف من القطعة الأخيرة موجود', !!b900 && b900.name === 'صنف كتالوج 900', JSON.stringify(b900));

  // الفهرس كسول: يُبنى عند أوّل بحثٍ بعد كلّ تحميل
  await page.evaluate(() => window.__cat.seed([{ barcode: 'X1', code: 'X1', name: 'س' }], 'vx'));
  const lazyBefore = await page.evaluate(() => window.__cat.indexed());
  await page.evaluate(() => window.__cat.find('X1'));
  const lazyAfter = await page.evaluate(() => window.__cat.indexed());
  ok('د٧ الفهرس يُبنى كسولًا مرّةً واحدة بعد كلّ تحميل', lazyBefore === false && lazyAfter === true, lazyBefore + '→' + lazyAfter);

  // البحث لا يكلّف قراءةً واحدة — جوهر المرحلة ٥
  await ens(page, { force: true });
  const readsBefore = await page.evaluate(() => window.__cat.reads());
  await page.evaluate(() => { for (let i = 1; i <= 5000; i++) window.__cat.find('6285000' + String((i % 900) + 1).padStart(5, '0')); });
  const readsAfter = await page.evaluate(() => window.__cat.reads());
  ok('د٨ ٥٬٠٠٠ بحثٍ = صفر قراءة Firestore', readsBefore === readsAfter, readsBefore + '→' + readsAfter);

  await shut(page);
}

// ═════════ المجموعة هـ — إثبات O(1) بالقياس ═════════
{
  const page = await open({ noMeta: true, noChunks: true });
  const bench = await page.evaluate(() => {
    const mk = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) { const s = String(1000000 + i); a[i] = { barcode: '628' + s, code: 'C' + s, name: 'ص' + i, category: 'ق', cost: 1 }; } return a; };
    const probes = (n, step) => { const p = []; for (let i = 0; i < n; i += step) p.push('628' + String(1000000 + i)); return p; };
    window.__cat.seed(mk(1000));  const t0 = performance.now(); const small = window.__cat.bench(probes(1000, 7), 300);   const b0 = performance.now() - t0;
    window.__cat.seed(mk(20000)); const t1 = performance.now(); const big   = window.__cat.bench(probes(20000, 137), 300); const b1 = performance.now() - t1;
    return { small, big, ratio: big / (small || 1e-9), b0, b1 };
  });
  ok('هـ١ متوسّط المطابقة عند ٢٠٬٠٠٠ صنف ≤ ٠٫٠٢ مللي', bench.big <= 0.02, 'big=' + bench.big.toFixed(6) + 'ms');
  // لو كان البحث خطّيًّا لبلغت النسبة ~٢٠ (٢٠٬٠٠٠ ÷ ١٬٠٠٠). نشترط ≤ ٥ لاستيعاب ضجيج ذاكرة التخزين المؤقّت.
  ok('هـ٢ الزمن لا ينمو مع ٢٠ ضعفًا من الأصناف (نسبة ≤ ٥ لا ~٢٠)', bench.ratio <= 5, 'ratio=' + bench.ratio.toFixed(3) + ' small=' + bench.small.toFixed(6) + ' big=' + bench.big.toFixed(6));
  ok('هـ٣ ٢٠٬٠٠٠ صنف تُفهرس وتُبحث دون تجميد (> ٢٠٠ مللي مرفوض)', bench.b1 < 200, 'b1=' + bench.b1.toFixed(1) + 'ms');

  // حجم القطعة آمن مقابل حدّ المستند ١ MiB
  const chunkBytes = await page.evaluate(() => {
    const a = []; for (let i = 0; i < 400; i++) a.push({ barcode: '6285000' + String(i).padStart(5, '0'), code: 'C' + String(i).padStart(5, '0'), name: 'اسم صنفٍ طويلٌ نسبيًّا للاختبار رقم ' + i, category: 'تصنيفٌ فرعيّ', cost: 123.45, unit: 'كرتون', book: 99 });
    return new TextEncoder().encode(JSON.stringify({ items: a })).length;
  });
  ok('هـ٤ قطعة ٤٠٠ صنفٍ أصغر بكثير من حدّ المستند ١ MiB', chunkBytes < 1048576 / 4, 'bytes=' + chunkBytes);

  await shut(page);
}

// ═════════ المجموعة و — التزامن: رحلةٌ واحدة لا ثلاث ═════════
{
  const page = await open();
  const r = await page.evaluate(async () => {
    const before = window.__cat.reads();
    const rs = await Promise.all([window.__cat.ensure(), window.__cat.ensure(), window.__cat.ensure()]);
    return { after: window.__cat.reads(), before, sources: rs.map(x => x.source), counts: rs.map(x => x.count) };
  });
  ok('و١ ثلاثة طلباتٍ متزامنة = ٤ قراءات فقط', (r.after - r.before) === 4, 'delta=' + (r.after - r.before) + ' ' + JSON.stringify(r.sources));
  ok('و١ب الثلاثة تعيد النتيجة نفسها', r.counts.every(c => c === CAT_N) && new Set(r.sources).size === 1, JSON.stringify(r));
  await shut(page);
}

await browser.close();
let pass = 0; for (const r of results) { console.log((r.pass ? '✓' : '✗') + ' ' + r.n + (r.d && !r.pass ? ('  << ' + r.d) : '')); if (r.pass) pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
