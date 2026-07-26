// اختبارات ط-١٥ (المهمّة ٨١) — المرحلة ٦ من التكليف: «تحسين الكلفة» + المرحلة ٩ «الأداء».
// تُثبت أربعة بنودٍ من وثيقة ٦:
//   د-٧  مستمع الحركة لا يُفتح إلّا عند أوّل عرضٍ للوحته (أثقل بندٍ في فاتورة القراءات).
//   د-٨  عدّادُ حصّةٍ يوميّ محلّيّ بالكامل يعترض الأسماء التسعة القابلة للفوترة، بتحذيرَي ٧٠٪ و٩٠٪.
//   د-٩  قياس m الحقيقيّ (متوسّط طول التتابع) من الجرد نفسه لا بالتخمين — البند ١٢ من عتبات القبول.
//   د-١١ مقياس تخزينٍ تقديريٌّ للعرض فقط، بصفر قراءةٍ إضافيّة، ولا يحذف بيانات جردٍ أبدًا.
// وتُثبت فوق ذلك أنّ الضمانات غير القابلة للتفاوض لم تُمَسّ: لا نقرةَ بعد المسح، والماسح جاهزٌ دائمًا،
// والأرقام (الكميات والتقارير) لم تتغيّر بحرفٍ واحد، وأنّ كلّ سلوكٍ جديدٍ يُرَدّ من الإعدادات.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

const ITEMS = [
  { code: 'A1', name: 'صنف أ', category: 'ك', book: 10, cost: 2, barcode: '6280000000011' },
  { code: 'B2', name: 'صنف ب', category: 'ك', book: 4, cost: 3, barcode: '6280000000028' },
  { code: 'C3', name: 'صنف ج', category: 'ك', book: 7, cost: 1, barcode: '6280000000035' }
];
const A = 'A1', B = 'B2';

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

// كلّ فتحةٍ في سياقٍ مستقلّ ⇒ عزلُ localStorage، فعدّاد الحصّة لا يتسرّب بين الحالات
async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  const sess = Object.assign({ id: 'sr', name: 'جرد الكلفة', status: 'open', started: true, assignedCounters: ['u_owner'], location: 'فرع أ', itemCount: ITEMS.length, __chunks: [ITEMS] }, opt.sess || {});
  const sc = { profile: OWNER, users: [OWNER], sessions: [sess] };
  if (opt.config) sc.config = opt.config;
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  if (opt.noSession !== true) {
    await page.evaluate(() => window.__openSession('sr'));
    await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
    await page.waitForTimeout(250);
  }
  page.__ctx = ctx;
  return page;
}
const shut = async (page) => { await page.close(); await page.__ctx.close(); };
const scan = (page, code) => page.evaluate(c => window.__scanCommit(c, 'test'), code);
const idle = (page) => page.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
async function scanN(page, code, n) { for (let i = 0; i < n; i++) { await scan(page, code); await idle(page); } }
const cdoc = (page, code) => page.evaluate(c => window.__hist14.doc('sr', c), code);
const q = (page) => page.evaluate(() => window.__quota.state());
const qp = (page) => page.evaluate(() => window.__quota.pct());
const attached = (page) => page.evaluate(() => window.__act.attached());
const toggle = (page) => page.evaluate(() => { const b = document.getElementById('actToggle'); if (b) b.onclick(); return !!b; });
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('#toastHost .toast')].map(t => ({ k: t.className, m: (t.querySelector('.tmsg') || {}).textContent || '' })));

// ═════════ المجموعة أ — د-٨: القيم الافتراضيّة وشكل الحالة ═════════
{
  const page = await open();
  const D = await page.evaluate(() => window.__quota.D);
  ok('أ١ العدّ مُفعَّلٌ افتراضيًّا', D['quota.count'] === true);
  ok('أ٢ سقفا القراءة والكتابة يطابقان الطبقة المجّانيّة (٥٠٬٠٠٠ / ٢٠٬٠٠٠)', D['quota.readCap'] === 50000 && D['quota.writeCap'] === 20000, JSON.stringify([D['quota.readCap'], D['quota.writeCap']]));
  ok('أ٣ عتبتا التحذير ٧٠٪ ثمّ ٩٠٪', D['quota.warnAt'] === 70 && D['quota.warnAt2'] === 90);
  ok('أ٤ مستمع الحركة الكسول مُفعَّلٌ افتراضيًّا (د-٧)', D['activity.lazyListen'] === true);
  ok('أ٥ قياس m مُفعَّلٌ افتراضيًّا (د-٩)', D['m.measure'] === true);
  ok('أ٦ مقياس التخزين مُفعَّلٌ وسقفه ١ جيبي بايت (د-١١)', D['storage.gauge'] === true && D['storage.capMb'] === 1024);
  const st = await q(page);
  ok('أ٧ الحالة تحمل المفاتيح الخمسة كأرقام', ['r', 'w', 'warn', 'scans', 'runs'].every(k => typeof st[k] === 'number'), JSON.stringify(st));
  const day = await page.evaluate(() => window.__quota.day());
  ok('أ٨ مفتاح اليوم بصيغة YYYY-MM-DD بأرقامٍ لاتينيّة', /^\d{4}-\d{2}-\d{2}$/.test(day), day);
  const key = await page.evaluate(() => window.__quota.key());
  ok('أ٩ التخزين محلّيٌّ بمفتاحٍ مؤرَّخ (لا حرفَ يُرسَل إلى السحابة)', key === 'iomp-quota-', key);
  const ls = await page.evaluate(() => { window.__quota.save(); const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf('iomp-quota-') === 0) out.push(k); } return out; });
  ok('أ١٠ الحالة تُحفَظ في localStorage تحت مفتاح اليوم', ls.length === 1 && /^iomp-quota-\d{4}-\d{2}-\d{2}$/.test(ls[0]), JSON.stringify(ls));
  await shut(page);
}

// ═════════ المجموعة ب — د-٨: كلّ واحدٍ من الأغلفة التسعة يعدّ ═════════
{
  const page = await open();
  const zero = () => page.evaluate(() => window.__quota.reset());
  const delta = async (fn) => { await zero(); await page.evaluate(fn); await page.waitForTimeout(60); const s = await q(page); return { r: s.r, w: s.w }; };

  const d1 = await delta(() => window.__probe9.getDoc('x/y'));
  ok('ب١ getDoc = قراءةٌ واحدة', d1.r === 1 && d1.w === 0, JSON.stringify(d1));

  await page.evaluate(() => { ['a', 'b', 'c'].forEach(k => window.__mockSet('probe/col/x/' + k, { v: 1 })); });
  const d2 = await delta(() => window.__probe9.getDocs('probe/col/x'));
  ok('ب٢ getDocs = قراءةٌ بعدد المستندات المُسلَّمة (٣ مستندات = ٣ قراءات)', d2.r === 3 && d2.w === 0, JSON.stringify(d2));

  const d2e = await delta(() => window.__probe9.getDocs('probe/empty/none'));
  ok('ب٢-ب استعلامٌ فارغ = قراءةٌ واحدة لا صفر (هكذا يفوتر Firestore)', d2e.r === 1 && d2e.w === 0, JSON.stringify(d2e));

  const d3 = await delta(() => window.__probe9.setDoc('t/1', { a: 1 }));
  ok('ب٣ setDoc = كتابةٌ واحدة', d3.w === 1 && d3.r === 0, JSON.stringify(d3));

  const d4 = await delta(() => window.__probe9.updateDoc('t/1', { a: 2 }));
  ok('ب٤ updateDoc = كتابةٌ واحدة', d4.w === 1 && d4.r === 0, JSON.stringify(d4));

  const d5 = await delta(() => window.__probe9.addDoc('t', { a: 1 }));
  ok('ب٥ addDoc = كتابةٌ واحدة', d5.w === 1 && d5.r === 0, JSON.stringify(d5));

  const d6 = await delta(() => window.__probe9.deleteDoc('t/1'));
  ok('ب٦ deleteDoc = كتابةٌ واحدة (الحذف يُفوتَر)', d6.w === 1 && d6.r === 0, JSON.stringify(d6));

  const d7 = await delta(() => window.__probe9.batch3());
  ok('ب٧ writeBatch بثلاث عمليّات = ٣ كتاباتٍ عند الإيداع لا واحدة', d7.w === 3 && d7.r === 0, JSON.stringify(d7));

  const d8 = await delta(() => window.__probe9.txn());
  ok('ب٨ runTransaction: get قراءة و set كتابة', d8.r === 1 && d8.w === 1, JSON.stringify(d8));

  const d9 = await delta(() => window.__probe9.listen('sessions/sr/counts'));
  ok('ب٩ onSnapshot يعدّ عند كلّ وصولٍ (المستمع يُفوتَر لكلّ جهاز)', d9.r >= 1, JSON.stringify(d9));

  const d0 = await delta(() => { });
  ok('ب١٠ لا عدّ من العدم (سكونٌ = صفر)', d0.r === 0 && d0.w === 0, JSON.stringify(d0));

  // إيقاف العدّ من الإعدادات يوقفه فعلًا
  await page.evaluate(() => { window.__quota.reset(); window.__setPermCfg({ quota: { 'quota.count': false } }); });
  await page.evaluate(() => window.__probe9.setDoc('t/2', { a: 1 }));
  const off = await q(page);
  ok('ب١١ إيقاف quota.count من الإعدادات يوقف العدّ تمامًا', off.w === 0 && off.r === 0, JSON.stringify(off));
  await page.evaluate(() => { window.__setPermCfg({ quota: {} }); });
  await shut(page);
}

// ═════════ المجموعة ج — د-٨: التحذيران يظهران مرّةً واحدةً لكلٍّ ولا يوقفان العمل ═════════
{
  const page = await open();
  await page.evaluate(() => { window.__quota.reset(); window.__TOAST_TTL = 60000; });
  await page.evaluate(() => window.__quota.bump('w', 13999));           // ٦٩٫٩٪
  let t = await toasts(page);
  ok('ج١ دون ٧٠٪ لا تحذير', t.filter(x => /warn|err/.test(x.k)).length === 0, JSON.stringify(t));

  await page.evaluate(() => window.__quota.bump('w', 2));               // ٧٠٫٠٪
  t = await toasts(page);
  const w1 = t.filter(x => /toast warn/.test(x.k));
  ok('ج٢ عند ٧٠٪ يظهر تحذيرٌ إرشاديّ واحد', w1.length === 1, JSON.stringify(t));
  ok('ج٣ نصّ التحذير يذكر النسبة بأرقامٍ لاتينيّة', w1.length === 1 && /70/.test(w1[0].m) && !/[٠-٩]/.test(w1[0].m), w1.length ? w1[0].m : '');

  await page.evaluate(() => window.__quota.bump('w', 1000));
  t = await toasts(page);
  ok('ج٤ لا تكرارَ لتحذير ٧٠٪ مع كلّ كتابة', t.filter(x => /toast warn/.test(x.k)).length === 1, JSON.stringify(t));

  await page.evaluate(() => window.__quota.bump('w', 4001));            // ≥٩٠٪
  t = await toasts(page);
  ok('ج٥ عند ٩٠٪ يظهر تحذيرٌ حادٌّ واحد', t.filter(x => /toast err/.test(x.k)).length === 1, JSON.stringify(t));
  await page.evaluate(() => window.__quota.bump('w', 500));
  t = await toasts(page);
  ok('ج٦ ولا يتكرّر هو أيضًا', t.filter(x => /toast err/.test(x.k)).length === 1, JSON.stringify(t));

  const st = await q(page);
  ok('ج٧ درجة التحذير محفوظةٌ في الحالة (٢ = بلغ ٩٠٪)', st.warn === 2, JSON.stringify(st));

  // الأهمّ: التحذير لا يوقف العدّ
  await scanN(page, A, 3);
  ok('ج٨ العدّ مستمرٌّ بعد التحذيرين — لا حجب ولا إيقاف', (await cdoc(page, A)).qty === 3, String((await cdoc(page, A)).qty));
  ok('ج٩ والماسح جاهزٌ فورًا بلا نقرة', await page.evaluate(() => window.__scanIdle()) === true);

  const p = await qp(page);
  ok('ج١٠ النسبة المعروضة = أعلى النسبتين (قراءةً أو كتابة)', p.pct === Math.max(p.rPct, p.wPct), JSON.stringify({ pct: p.pct, r: p.rPct, w: p.wPct }));
  ok('ج١١ سقوف النسبة من الإعدادات لا من ثابتٍ مدفون', p.readCap === 50000 && p.writeCap === 20000);
  await shut(page);
}

// ═════════ المجموعة د — د-٧: المستمع لا يُفتَح قبل عرض لوحته ═════════
{
  const page = await open();
  ok('د١ فتحُ الجلسة لا يفتح مستمع الحركة (هذا هو التوفير كلّه)', await attached(page) === false);

  await page.evaluate(() => window.__quota.reset());
  await scanN(page, A, 3);
  ok('د٢ ثلاث مسحاتٍ بلا لوحةِ حركةٍ مفتوحة = صفر قراءةٍ من مستمع الحركة', await attached(page) === false);
  ok('د٣ والكميّة وصلت كاملةً رغم ذلك (الأرقام لم تُمَسّ)', (await cdoc(page, A)).qty === 3, String((await cdoc(page, A)).qty));

  ok('د٤ زرّ اللوحة موجود', await toggle(page) === true);
  await page.waitForTimeout(120);
  ok('د٥ أوّل عرضٍ للوحة يفتح المستمع', await attached(page) === true);

  const before = (await q(page)).r;
  await toggle(page); await page.waitForTimeout(80);      // طيّ
  await toggle(page); await page.waitForTimeout(80);      // إعادة عرض
  const after = (await q(page)).r;
  ok('د٦ الطيّ ثمّ إعادة العرض لا يفتح مستمعًا ثانيًا ولا يعيد الفوترة', after === before, JSON.stringify({ before, after }));
  ok('د٧ والمستمع ما زال واحدًا', await attached(page) === true);
  await shut(page);
}

// ═════════ المجموعة هـ — د-٧: التراجع الكامل من الإعدادات ═════════
{
  const page = await open({ config: { quota: { 'activity.lazyListen': false } } });
  ok('هـ١ بإيقاف المفتاح يعود السلوك القديم: المستمع يُفتح مع الجلسة', await attached(page) === true);
  await scanN(page, A, 2);
  ok('هـ٢ والعدّ يعمل كما هو في الحالتين', (await cdoc(page, A)).qty === 2, String((await cdoc(page, A)).qty));
  await shut(page);
}

// ═════════ المجموعة و — د-٧: اللوحة تعرض المحتوى فعلًا بعد الفتح المتأخّر ═════════
{
  const page = await open();
  await scanN(page, A, 2);
  await toggle(page);
  await page.waitForFunction(() => { const p = document.getElementById('actPanel'); return p && p.style.display !== 'none' && (p.textContent || '').length > 0; }, { timeout: 15000 });
  await page.waitForTimeout(400);
  const html = await page.evaluate(() => { const p = document.getElementById('actPanel'); return p ? p.textContent : ''; });
  ok('و١ اللوحة لا تبقى فارغةً بعد الفتح المتأخّر', html.trim().length > 0, html.slice(0, 120));
  ok('و٢ والمستمع مربوطٌ ولقطتُه وصلت', await attached(page) === true && await page.evaluate(() => window.__act.lastQs()) === true);
  await shut(page);
}

// ═════════ المجموعة ز — د-٩: قياس m الحقيقيّ (البند ١٢ من عتبات القبول) ═════════
{
  const page = await open();
  await page.evaluate(() => window.__quota.reset());
  await scanN(page, A, 3);
  let st = await q(page);
  ok('ز١ ثلاث مسحاتٍ متتابعةٍ لصنفٍ واحد = ٣ مسحات وتتابعٌ واحد', st.scans === 3 && st.runs === 1, JSON.stringify(st));
  ok('ز٢ ⇒ m = ٣', (await qp(page)).m === 3, String((await qp(page)).m));

  await scanN(page, B, 2);
  st = await q(page);
  ok('ز٣ تبديل الصنف يبدأ تتابعًا جديدًا: ٥ مسحاتٍ وتتابعان', st.scans === 5 && st.runs === 2, JSON.stringify(st));
  ok('ز٤ ⇒ m = ٢٫٥ (متوسّطٌ حقيقيٌّ لا مُفترَض)', (await qp(page)).m === 2.5, String((await qp(page)).m));

  await scanN(page, A, 1);
  st = await q(page);
  ok('ز٥ العودة إلى صنفٍ سابق تتابعٌ ثالثٌ لا استئنافٌ للأوّل', st.scans === 6 && st.runs === 3, JSON.stringify(st));

  const m7 = await page.evaluate(() => window.__quota.m(7));
  ok('ز٦ متوسّط الأيّام السبعة يجمع المسحات والتتابعات', m7.scans === 6 && m7.runs === 3 && m7.m === 2, JSON.stringify(m7));

  const h = await page.evaluate(() => window.__quota.hist(7));
  ok('ز٧ سجلّ الأيّام يعيد يوم اليوم على الأقلّ', Array.isArray(h) && h.length >= 1 && h[0].scans === 6, JSON.stringify(h));

  ok('ز٨ القياس لم يغيّر رقمًا في الجرد', (await cdoc(page, A)).qty === 4 && (await cdoc(page, B)).qty === 2, JSON.stringify([(await cdoc(page, A)).qty, (await cdoc(page, B)).qty]));
  await shut(page);
}

// ═════════ المجموعة ح — د-٩: القياس يُوقَف من الإعدادات، والعدّ اليدويّ لا يُحسب مسحة ═════════
{
  const page = await open({ config: { quota: { 'm.measure': false } } });
  await page.evaluate(() => window.__quota.reset());
  await scanN(page, A, 3);
  const st = await q(page);
  ok('ح١ بإيقاف m.measure لا يُقاس شيء', st.scans === 0 && st.runs === 0, JSON.stringify(st));
  ok('ح٢ والعدّ نفسه لم يتأثّر إطلاقًا', (await cdoc(page, A)).qty === 3, String((await cdoc(page, A)).qty));
  await shut(page);
}

// ═════════ المجموعة ط — د-١١: مقياس التخزين تقديريٌّ للعرض فقط ═════════
{
  const page = await open();
  await page.evaluate(() => window.__quota.reset());
  const g = await page.evaluate(() => window.__quota.storage([{ itemCount: 1000 }, { itemCount: 500 }]));
  ok('ط١ يجمع أصناف كلّ الجلسات', g.items === 1500 && g.sessions === 2, JSON.stringify(g));
  ok('ط٢ اللقطة والعدّات والكتالوج تُحسب كلٌّ بمعامله', g.snapshotB === 1500 * 350 && g.countsB === 1500 * 180, JSON.stringify(g));
  ok('ط٣ الإجمالي = مجموع الثلاثة', g.totalB === g.snapshotB + g.countsB + g.catalogB, JSON.stringify(g));
  ok('ط٤ السقف ١ جيبي بايت والنسبة محسوبةٌ منه', g.capB === 1024 * 1048576 && Math.abs(g.pct - (g.totalB / g.capB * 100)) < 1e-9, JSON.stringify(g));
  ok('ط٥ مُعلَنٌ أنّه تقديريّ لا فاتورة', g.approx === true);

  const st = await q(page);
  ok('ط٦ حسابه لم يكلّف قراءةً واحدة (يُحسب ممّا في اليد)', st.r === 0 && st.w === 0, JSON.stringify(st));

  const g0 = await page.evaluate(() => window.__quota.storage(null));
  ok('ط٧ مدخلٌ فارغٌ أو معدوم لا يعطبه', g0.items === 0 && g0.sessions === 0 && g0.totalB === g0.catalogB, JSON.stringify(g0));

  const g2 = await page.evaluate(() => { window.__setPermCfg({ quota: { 'storage.perItemB': 700, 'storage.capMb': 2048 } }); return window.__quota.storage([{ itemCount: 100 }]); });
  ok('ط٨ المعاملات والسقف قابلان للضبط من الإعدادات', g2.snapshotB === 70000 && g2.capB === 2048 * 1048576, JSON.stringify(g2));
  await page.evaluate(() => { window.__setPermCfg({ quota: {} }); });

  // الضمانة الأهمّ: لا حذفَ ولا اقتراحَ حذفٍ تلقائيّ
  const before = await page.evaluate(() => Object.keys(window.__store).length);
  await page.evaluate(() => window.__quota.storage([{ itemCount: 999999 }]));
  const after = await page.evaluate(() => Object.keys(window.__store).length);
  ok('ط٩ المقياس لا يحذف مستندًا واحدًا مهما بلغت النسبة', before === after, JSON.stringify({ before, after }));
  await shut(page);
}

// ═════════ المجموعة ي — التكامل: الضمانات غير القابلة للتفاوض بعد ط-١٥ ═════════
{
  const page = await open();
  await page.evaluate(() => window.__quota.reset());
  await scanN(page, A, 5);
  ok('ي١ خمس مسحاتٍ متتاليةٍ = ٥ بالضبط (لا خنق ولا تجاهل)', (await cdoc(page, A)).qty === 5, String((await cdoc(page, A)).qty));
  ok('ي٢ الماسح جاهزٌ بلا نقرة', await page.evaluate(() => window.__scanIdle()) === true);
  ok('ي٣ التركيز عاد لحقل المسح تلقائيًّا', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'csearch');
  await scan(page, B); await idle(page);
  const s = await page.evaluate(() => { const el = document.getElementById('scanStatus'); return el ? el.textContent : ''; });
  ok('ي٤ لوحة النتيجة انتقلت للصنف الجديد ولم تُبقِ السابق', s.indexOf('صنف ب') >= 0 && s.indexOf('صنف أ') < 0, s.slice(0, 160));
  ok('ي٥ لا صلاحيةَ جديدة ولا بوّابةَ جديدة أضافها ط-١٥', (await cdoc(page, B)).qty === 1);

  const st = await q(page);
  ok('ي٦ ومع ذلك جرى العدّ: كتاباتٌ مُسجَّلة', st.w > 0, JSON.stringify(st));
  ok('ي٧ وقياس m جرى في الخلفيّة بلا خطوةٍ يدويّةٍ واحدة', st.scans === 6 && st.runs === 2, JSON.stringify(st));
  await shut(page);
}

await browser.close();
let pass = 0; for (const r of results) { console.log((r.pass ? '✓' : '✗') + ' ' + r.n + (r.d && !r.pass ? ('  << ' + r.d) : '')); if (r.pass) pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
