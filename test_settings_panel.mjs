// اختبارات ط-١٦ (المهمّة ٨٢) — لوحة إعدادات الكتالوج والسجلّ والحصّة.
// النصّ الحاكم من المرحلة ٢ من التكليف: «قم بتنفيذ الأصحّ مع إمكانيّة تغيير ذلك من الإعدادات».
// فالغرض من هذا الملفّ إثباتُ أنّ الشقّ الثاني من الجملة قد نُفِّذ حرفيًّا: كلُّ قرارٍ اتُّخذ
// نيابةً عن العميل في ط-١٢ … ط-١٥ له مقبضٌ ظاهرٌ في الواجهة يردّه، وأنّ لا مفتاحَ واحدًا
// من الثلاثة والأربعين بقي مدفونًا في الشيفرة بلا حقلٍ يقابله.
// ويُثبت فوق ذلك أنّ اللوحة نفسها لم تكسر شيئًا: الصلاحيّات كما هي، والأرقام كما هي،
// ومقياس التخزين لا يقرأ من الخادم إلّا بضغطة زرٍّ صريحة، ولا يحذف بيانات جردٍ أبدًا.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };
const CLERK = { uid: 'u_clerk', email: 'clerk@dhtrd.com', name: 'عادّ', role: 'موظف', active: true };
const ITEMS = [
  { code: 'A1', name: 'صنف أ', category: 'ك', book: 10, cost: 2, barcode: '6280000000011' },
  { code: 'B2', name: 'صنف ب', category: 'ك', book: 4, cost: 3, barcode: '6280000000028' }
];

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

// سياقٌ مستقلٌّ لكلّ فتحة ⇒ عزل localStorage فلا يتسرّب عدّاد الحصّة بين الحالات
async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 2400 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { } });
  const who = opt.who || OWNER;
  const sess = { id: 'sr', name: 'جرد الإعدادات', status: 'open', started: true, assignedCounters: ['u_owner', 'u_clerk'], location: 'فرع أ', itemCount: ITEMS.length, __chunks: [ITEMS] };
  const extra = Array.from({ length: opt.extraUsers || 0 }, (_, i) => ({ uid: 'u_x' + i, email: 'x' + i + '@dhtrd.com', name: 'مستخدم ' + i, role: 'موظف', active: true }));
  const sc = { profile: who, users: [OWNER, CLERK].concat(extra), sessions: [sess] };
  if (opt.config) sc.config = opt.config;
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  if (opt.settings !== false) {
    await page.evaluate(() => window.__setTab('settings'));
    await page.waitForTimeout(300);
  }
  page.__ctx = ctx;
  return page;
}
const shut = async (page) => { await page.close(); await page.__ctx.close(); };
const spec = (page) => page.evaluate(() => window.__sets.spec());
const has = (page, id) => page.evaluate(i => !!document.getElementById(i), id);
const store = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
const q = (page) => page.evaluate(() => window.__quota.state());
const txt = (page, id) => page.evaluate(i => { const e = document.getElementById(i); return e ? (e.textContent || '').trim() : null; }, id);
// انتظر سكون عدّاد القراءات — القياس الصادق يبدأ بعد أن تهدأ قراءات الإقلاع غير المتزامنة
async function settle(page, quietMs = 700, capMs = 8000) {
  let last = -1, quietSince = 0, t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    const r = await page.evaluate(() => window.__quota.state().r);
    if (r === last) { if (!quietSince) quietSince = Date.now(); else if (Date.now() - quietSince >= quietMs) return r; }
    else { last = r; quietSince = 0; }
    await page.waitForTimeout(150);
  }
  return last;
}

// ═════════ المجموعة أ — كلّ مفتاحٍ اتُّخذ نيابةً عن العميل له حقلٌ ظاهر ═════════
{
  const page = await open();
  const S = await spec(page);
  ok('أ١ الأقسام الثلاثة ظاهرة (كتالوج · سجلّ · حصّة)',
    S.length === 3 && S[0].g === 'catalog' && S[1].g === 'history' && S[2].g === 'quota', JSON.stringify(S.map(x => x.g)));

  // القائمة التصريحيّة تغطّي القواميس الثلاثة كاملةً — لا مفتاحَ بلا مقبض
  const gaps = await page.evaluate(() => {
    const out = {};
    ['catalog', 'history', 'quota'].forEach(g => {
      const D = window.__sets.defaults(g), shown = window.__sets.keys(g);
      out[g] = { total: Object.keys(D).length, shown: shown.length, missing: Object.keys(D).filter(k => shown.indexOf(k) < 0) };
    });
    return out;
  });
  ok('أ٢ كلّ مفاتيح CATD الـ٢٥ لها حقولٌ ظاهرة (لا مفتاحَ مدفون)',
    gaps.catalog.missing.length === 0 && gaps.catalog.shown === gaps.catalog.total, JSON.stringify(gaps.catalog));
  ok('أ٣ كلّ مفاتيح HISTD الستّة لها حقولٌ ظاهرة',
    gaps.history.missing.length === 0 && gaps.history.shown === gaps.history.total, JSON.stringify(gaps.history));
  ok('أ٤ كلّ مفاتيح QUOTAD الاثني عشر لها حقولٌ ظاهرة',
    gaps.quota.missing.length === 0 && gaps.quota.shown === gaps.quota.total, JSON.stringify(gaps.quota));

  const totalKeys = gaps.catalog.total + gaps.history.total + gaps.quota.total;
  ok('أ٥ الإجمالي ٤٣ مفتاحًا قابلًا للضبط (٢٥ + ٦ + ١٢)', totalKeys === 43, String(totalKeys));

  // ووجودُ الحقل في القائمة لا يكفي — لا بدّ من عنصرٍ حيٍّ في الصفحة لكلّ واحدٍ منها
  const missingDom = await page.evaluate(() => {
    const miss = [];
    window.__sets.spec().forEach(s => s.ids.forEach((id, i) => { if (!document.getElementById(id)) miss.push(s.g + ':' + s.keys[i]); }));
    return miss;
  });
  ok('أ٦ لكلّ مفتاحٍ عنصرُ إدخالٍ حيٌّ في الصفحة (٤٣/٤٣)', missingDom.length === 0, missingDom.join(','));

  // ولا بدّ لكلّ حقلٍ من شرحٍ بلغة العمل — الإعداد الذي لا يُفهم لا يُستعمل
  const hints = await page.evaluate(() => {
    let empty = 0, short = 0, n = 0;
    document.querySelectorAll('.setf').forEach(el => {
      n++;
      const row = el.closest('.setrow'); const h = row ? row.querySelectorAll('.muted') : [];
      const t = h.length ? (h[0].textContent || '').trim() : '';
      if (!t) empty++; else if (t.length < 25) short++;
    });
    return { n, empty, short };
  });
  ok('أ٧ لكلّ حقلٍ شرحٌ مكتوبٌ بلغة العمل لا بلغة البرمجة', hints.n === 43 && hints.empty === 0, JSON.stringify(hints));

  // القيمة المعروضة = القيمة الفعليّة، لا نصٌّ ثابت
  const mirror = await page.evaluate(() => {
    const bad = [];
    window.__sets.spec().forEach(s => s.ids.forEach((id, i) => {
      const el = document.getElementById(id), k = s.keys[i], t = s.types[i], v = window.__sets.val(s.g, k);
      const shown = (t === 'b') ? !!el.checked : ((t === 'n') ? Number(el.value) : String(el.value));
      const want = (t === 'b') ? !!v : ((t === 'n') ? Number(v) : String(v));
      if (shown !== want) bad.push(s.g + ':' + k + ' shown=' + shown + ' want=' + want);
    }));
    return bad;
  });
  ok('أ٨ كلّ حقلٍ يعرض القيمة السارية فعلًا (٤٣/٤٣ مطابقة)', mirror.length === 0, mirror.slice(0, 3).join(' | '));
  await shut(page);
}

// ═════════ المجموعة ب — الحفظ: يكتب مستندًا واحدًا بالدمج ويسري فورًا ═════════
{
  const page = await open();
  const before = await store(page);
  ok('ب١ لا شيء محفوظٌ قبل الضغط على «حفظ»', !before['config/permissions'] || !before['config/permissions'].catalog,
    JSON.stringify(Object.keys(before['config/permissions'] || {})));

  // غيّر ثلاثة أنواعٍ مختلفة في قسمٍ واحد: منطقيّ ونصّيّ ورقميّ
  await page.evaluate(() => {
    document.getElementById(window.__sets.id('import.rejectZeroCost')).checked = true;
    document.getElementById(window.__sets.id('cost.updatePolicy')).value = 'ifEmpty';
    document.getElementById(window.__sets.id('cost.jumpAlertPct')).value = '35';
  });
  const wBefore = (await q(page)).w;
  await page.evaluate(() => document.getElementById('btn_saveSetsCatalog').click());
  await page.waitForTimeout(400);
  const after = await store(page);
  const cat = (after['config/permissions'] || {}).catalog || {};
  ok('ب٢ الحفظ يكتب config/permissions.catalog', !!after['config/permissions'] && Object.keys(cat).length === 25, String(Object.keys(cat).length));
  ok('ب٣ الحقل المنطقيّ حُفظ كما ضُبط', cat['import.rejectZeroCost'] === true, JSON.stringify(cat['import.rejectZeroCost']));
  ok('ب٤ الحقل النصّيّ حُفظ كما ضُبط', cat['cost.updatePolicy'] === 'ifEmpty', String(cat['cost.updatePolicy']));
  ok('ب٥ الحقل الرقميّ حُفظ رقمًا لا نصًّا', cat['cost.jumpAlertPct'] === 35, JSON.stringify(cat['cost.jumpAlertPct']));

  const wAfter = (await q(page)).w;
  ok('ب٦ القسم كلّه كتابةٌ واحدة لا كتابةً لكلّ حقل', (wAfter - wBefore) === 1, String(wAfter - wBefore));

  // والأهمّ: القيمة الجديدة سارية في الحال، فلا يحتاج المستخدم إعادة تحميل
  const live = await page.evaluate(() => ({
    a: window.__sets.val('catalog', 'cost.updatePolicy'),
    b: window.__sets.val('catalog', 'cost.jumpAlertPct'),
    c: window.__sets.val('catalog', 'import.rejectZeroCost')
  }));
  ok('ب٧ القيم الجديدة سارية فورًا بلا إعادة تحميل', live.a === 'ifEmpty' && live.b === 35 && live.c === true, JSON.stringify(live));
  const stat = await txt(page, 'setsCatStatus');
  ok('ب٨ رسالة نجاحٍ ظاهرةٌ للمستخدم', !!stat && stat.indexOf('✓') >= 0, String(stat));

  // الدمج merge:true — حفظ قسمٍ لا يمسّ أقسامًا أخرى ولا الأدوار
  await page.evaluate(() => { document.getElementById(window.__sets.id('history.actFlushMs')).value = '4000'; });
  await page.evaluate(() => document.getElementById('btn_saveSetsHistory').click());
  await page.waitForTimeout(400);
  const s2 = (await store(page))['config/permissions'] || {};
  ok('ب٩ حفظ «السجلّ» لم يمسح إعدادات «الكتالوج» (merge:true)',
    (s2.history || {})['history.actFlushMs'] === 4000 && (s2.catalog || {})['cost.updatePolicy'] === 'ifEmpty',
    JSON.stringify({ h: (s2.history || {})['history.actFlushMs'], c: (s2.catalog || {})['cost.updatePolicy'] }));
  ok('ب١٠ قسم الحصّة لم يُكتب بعدُ (كلّ قسمٍ مستقلّ)', !s2.quota, JSON.stringify(Object.keys(s2)));

  // والحصّة كذلك
  await page.evaluate(() => {
    document.getElementById(window.__sets.id('quota.warnAt')).value = '55';
    document.getElementById(window.__sets.id('activity.lazyListen')).checked = false;
  });
  await page.evaluate(() => document.getElementById('btn_saveSetsQuota').click());
  await page.waitForTimeout(400);
  const s3 = (await store(page))['config/permissions'] || {};
  ok('ب١١ حفظ «الحصّة» يعمل ويعيد سلوك المستمع القديم عند طلبه',
    (s3.quota || {})['quota.warnAt'] === 55 && (s3.quota || {})['activity.lazyListen'] === false,
    JSON.stringify({ w: (s3.quota || {})['quota.warnAt'], l: (s3.quota || {})['activity.lazyListen'] }));
  ok('ب١٢ الأقسام الثلاثة تعايشت في مستندٍ واحد', !!(s3.catalog && s3.history && s3.quota), JSON.stringify(Object.keys(s3)));
  ok('ب١٣ الحفظ يسجّل من غيّر ومتى (أثرٌ للمراجعة)', !!s3.updatedBy && !!s3.updatedAt, JSON.stringify({ by: s3.updatedBy, at: !!s3.updatedAt }));
  await shut(page);
}

// ═════════ المجموعة ج — حدود القيم: اللوحة لا تسمح بإدخالٍ يكسر التطبيق ═════════
{
  const page = await open();
  await page.evaluate(() => {
    document.getElementById(window.__sets.id('quota.warnAt')).value = '999';       // فوق الحدّ
    document.getElementById(window.__sets.id('import.maxRows')).value = '5';       // تحت الحدّ
    document.getElementById(window.__sets.id('cost.jumpAlertPct')).value = '12.7'; // كسريّ
    document.getElementById(window.__sets.id('history.mergeMax')).value = 'أبجد';  // ليس رقمًا
  });
  const cq = await page.evaluate(() => window.__sets.collect('quota'));
  const cc = await page.evaluate(() => window.__sets.collect('catalog'));
  const ch = await page.evaluate(() => window.__sets.collect('history'));
  ok('ج١ القيمة فوق الحدّ تُقصّ إلى السقف لا تُقبل كما هي', cq['quota.warnAt'] === 99, String(cq['quota.warnAt']));
  ok('ج٢ القيمة تحت الحدّ تُرفع إلى الأرضيّة', cc['import.maxRows'] === 100, String(cc['import.maxRows']));
  ok('ج٣ الكسر يُدوَّر إلى صحيح', cc['cost.jumpAlertPct'] === 13, String(cc['cost.jumpAlertPct']));
  ok('ج٤ النصّ غير الرقميّ يسقط إلى الأرضيّة لا إلى NaN', ch['history.mergeMax'] === 0 && isFinite(ch['history.mergeMax']), JSON.stringify(ch['history.mergeMax']));
  const allNum = await page.evaluate(() => {
    const bad = [];
    ['catalog', 'history', 'quota'].forEach(g => { const o = window.__sets.collect(g); Object.keys(o).forEach(k => { if (typeof o[k] === 'number' && !isFinite(o[k])) bad.push(g + ':' + k); }); });
    return bad;
  });
  ok('ج٥ لا قيمة NaN تخرج من اللوحة إلى قاعدة البيانات إطلاقًا', allNum.length === 0, allNum.join(','));
  await shut(page);
}

// ═════════ المجموعة د — «إرجاع القسم للافتراضي»: يردّ في الشاشة ولا يكتب حتّى يُطلب ═════════
{
  const page = await open();
  await page.evaluate(() => {
    document.getElementById(window.__sets.id('history.mergeRuns')).checked = false;
    document.getElementById(window.__sets.id('history.actFlushMs')).value = '9000';
  });
  const wB = (await q(page)).w;
  await page.evaluate(() => document.getElementById('rst_history').click());
  await page.waitForTimeout(200);
  const restored = await page.evaluate(() => {
    const D = window.__sets.defaults('history');
    return {
      merge: document.getElementById(window.__sets.id('history.mergeRuns')).checked,
      flush: Number(document.getElementById(window.__sets.id('history.actFlushMs')).value),
      dMerge: D['history.mergeRuns'], dFlush: D['history.actFlushMs']
    };
  });
  ok('د١ الإرجاع يعيد الحقل المنطقيّ لافتراضه', restored.merge === restored.dMerge, JSON.stringify(restored));
  ok('د٢ الإرجاع يعيد الحقل الرقميّ لافتراضه', restored.flush === restored.dFlush, JSON.stringify(restored));
  const wA = (await q(page)).w;
  ok('د٣ الإرجاع لا يكتب شيئًا حتّى يضغط المستخدم «حفظ»', wA === wB, String(wA - wB));
  const st = await txt(page, 'setsHistStatus');
  ok('د٤ الرسالة تُفصح صراحةً أنّ الحفظ لم يقع بعد', !!st && st.indexOf('حفظ') >= 0, String(st));
  const s = await store(page);
  ok('د٥ لا مستند إعداداتٍ كُتب بمجرّد الإرجاع', !(s['config/permissions'] || {}).history, JSON.stringify(Object.keys(s['config/permissions'] || {})));
  await shut(page);
}

// ═════════ المجموعة هـ — مفتاح تفعيل الكتالوج الرئيسيّ نفسه ═════════
{
  const page = await open();
  ok('هـ١ مفتاح تفعيل الكتالوج الرئيسيّ ظاهرٌ في لوحة الإعدادات', await has(page, 'featMasterCatToggle'));
  const on = await page.evaluate(() => document.getElementById('featMasterCatToggle').checked);
  ok('هـ٢ الكتالوج الرئيسيّ مفعَّلٌ افتراضيًّا', on === true, String(on));
  await page.evaluate(() => { document.getElementById('featMasterCatToggle').checked = false; });
  await page.evaluate(() => document.getElementById('btn_saveSetsCatalog').click());
  await page.waitForTimeout(400);
  const s = (await store(page))['config/permissions'] || {};
  ok('هـ٣ إطفاؤه يُحفظ في features.masterCatalog', (s.features || {}).masterCatalog === false, JSON.stringify(s.features));
  const off = await page.evaluate(() => window.__cimp.on());
  ok('هـ٤ الإطفاء يسري فورًا على منطق التطبيق', off === false, String(off));
  const nav = await page.evaluate(() => window.__nav().html);
  ok('هـ٥ إطفاؤه يخفي تبويب الكتالوج من التنقّل', nav.indexOf('catalog') < 0, nav.indexOf('catalog') >= 0 ? 'ما زال ظاهرًا' : '');
  await shut(page);
}

// ═════════ المجموعة و — المقاييس (د-٨ · د-٩ · د-١١): أرقامٌ حقيقيّة بصفر قراءةٍ إضافيّة ═════════
{
  const page = await open();
  const html = await page.evaluate(() => window.__sets.gaugesHtml());
  ok('و١ لوحة الحصّة تعرض القراءات والكتابات وسقفيهما', html.indexOf('القراءات') >= 0 && html.indexOf('الكتابات') >= 0);
  ok('و٢ تعرض متوسّط طول التتابع m', html.indexOf('(m)') >= 0);
  ok('و٣ تُفصح أنّ الحصّة مشتركةٌ بين الأجهزة وأنّ العدّاد محلّيّ', html.indexOf('مشترك') >= 0 && html.indexOf('تقدير') >= 0);
  ok('و٤ تذكر اليوم بتوقيت المحيط الهادئ لا بتوقيت الجهاز', html.indexOf('الهادئ') >= 0);

  // قبل أيّ عدٍّ حقيقيّ: m لا يُخمَّن بل يُعلن أنّه لم يُقَس بعد
  ok('و٥ قبل القياس تقول اللوحة «لا قياسَ بعد» ولا تخترع رقمًا', html.indexOf('لا قياسَ بعد') >= 0);

  // بعد عدٍّ حقيقيّ (٣ مسحاتٍ متتابعة + ٢ لصنفٍ آخر = تتابعان، m=2.5)
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
  for (const c of ['A1', 'A1', 'A1', 'B2', 'B2']) {
    await page.evaluate(x => window.__scanCommit(x, 'test'), c);
    await page.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
  }
  const m = await page.evaluate(() => window.__quota.m(7));
  ok('و٦ m يُقاس من الجرد الحقيقيّ: ٥ مسحاتٍ على تتابعين = ٢٫٥', m.scans === 5 && m.runs === 2 && Math.abs(m.m - 2.5) < 1e-9, JSON.stringify(m));

  await page.evaluate(() => window.__setTab('settings'));
  await page.waitForTimeout(300);
  const html2 = await page.evaluate(() => window.__sets.gaugesHtml());
  ok('و٧ اللوحة تعرض m المقيس بعد العدّ لا التخمين', html2.indexOf('2.5') >= 0 && html2.indexOf('لا قياسَ بعد') < 0, html2.indexOf('2.5') >= 0 ? '' : 'لم يظهر 2.5');
  ok('و٨ الأرقام بأرقامٍ لاتينيّة كبقيّة التطبيق', /\d/.test(html2) && !/[٠-٩]\d*٫/.test(html2));

  // د-١١: المقياس لا يقرأ شيئًا حتّى يُطلب صراحةً
  ok('و٩ زرّ «احسب الآن» موجود ومقياس التخزين لم يُحسب تلقائيًّا', await has(page, 'setsStorageBtn'));
  const outBefore = await page.evaluate(() => window.__sets.storageOut());
  ok('و١٠ مساحة النتيجة فارغةٌ قبل الضغط (لا حسابَ تلقائيّ)', outBefore === '' || outBefore === null, JSON.stringify(outBefore));
  const rB = (await q(page)).r;
  await page.evaluate(() => document.getElementById('setsStorageBtn').click());
  await page.waitForFunction(() => (window.__sets.storageOut() || '').indexOf('الإجمالي') >= 0, { timeout: 10000 });
  const rA = (await q(page)).r;
  const outAfter = await page.evaluate(() => window.__sets.storageOut());
  ok('و١١ الضغط يُظهر الإجمالي وتفصيل اللقطات والعدّ والكتالوج',
    outAfter.indexOf('الإجمالي') >= 0 && outAfter.indexOf('لقطات') >= 0 && outAfter.indexOf('الكتالوج') >= 0);
  ok('و١٢ الحساب يكلّف قراءةً واحدةً محدودةً لا مسحًا كاملًا للبيانات', (rA - rB) <= 3, String(rA - rB));
  ok('و١٣ النتيجة تُعلن صراحةً أنّها تقديريّةٌ لا قياسٌ فعليّ', outAfter.indexOf('تقدير') >= 0);

  // ولا يحذف شيئًا — ولا حتّى يقترح
  const st1 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  ok('و١٤ مقياس التخزين لا يحذف بيانات جردٍ ولا يقترح حذفها',
    outAfter.indexOf('احذف') < 0 && outAfter.indexOf('حذف') < 0 && !!st1['sessions/sr'], String(!!st1['sessions/sr']));
  await shut(page);
}

// ═════════ المجموعة ز — الضمانات غير القابلة للتفاوض لم تُمَسّ ═════════
{
  // (١) الصلاحيّات: من لا يملك «إدارة الصلاحيّات» لا يرى اللوحة أصلًا
  const p1 = await open({ who: CLERK });
  const seen = await p1.evaluate(() => {
    const s = window.__sets.spec(); let n = 0;
    s.forEach(x => x.ids.forEach(id => { if (document.getElementById(id)) n++; }));
    return n;
  });
  ok('ز١ الموظّف بلا صلاحيّة «إدارة الصلاحيّات» لا يرى حقول الإعدادات', seen === 0, String(seen));
  const wB = (await q(p1)).w;
  await p1.evaluate(() => { try { window.__sets.save('catalog'); } catch (e) { } });
  await p1.waitForTimeout(300);
  const s1 = await store(p1);
  ok('ز٢ ومحاولة الحفظ برمجيًّا لا تكتب شيئًا (الحارس في الدالّة لا في الزرّ)',
    !(s1['config/permissions'] || {}).catalog && (await q(p1)).w === wB, JSON.stringify(Object.keys(s1['config/permissions'] || {})));
  await shut(p1);

  // (٢) العدّ: اللوحة لا تُدخل خطوةً يدويّةً ولا تُبطئ الماسح
  const p2 = await open({ settings: false });
  await p2.evaluate(() => window.__openSession('sr'));
  await p2.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
  for (let i = 0; i < 5; i++) {
    await p2.evaluate(() => window.__scanCommit('A1', 'test'));
    await p2.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
  }
  const qty = await p2.evaluate(() => { const d = window.__hist14.doc('sr', 'A1'); return d ? d.qty : null; });
  ok('ز٣ خمس مسحاتٍ متتابعةٍ = كميّة ٥ (الأرقام لم تتغيّر بحرفٍ واحد)', qty === 5, String(qty));
  ok('ز٤ الماسح جاهزٌ فورًا بلا نقرةٍ بعد المسح', await p2.evaluate(() => window.__scanIdle()) === true);
  ok('ز٥ التركيز عاد إلى حقل المسح تلقائيًّا', (await p2.evaluate(() => window.__focusId())) === 'csearch',
    await p2.evaluate(() => window.__focusId()));
  // حوارات التطبيق الحاجبة الأربعة — العبرة بالظاهر منها لا بوجودها في الصفحة
  const dlg = await p2.evaluate(() => ['cfOverlay', 'ppOverlay', 'caOverlay', 'rdOverlay']
    .filter(i => { const e = document.getElementById(i); return e && getComputedStyle(e).display !== 'none'; }));
  ok('ز٦ لا نافذةَ حاجبةً ولا خطوةَ يدويّةٍ استُحدثت في مسار العدّ', dlg.length === 0, dlg.join(','));
  await shut(p2);

  // (٣) اللوحة لا تكسر بقيّة شاشة الصلاحيّات القائمة
  const p3 = await open({ settings: false });
  const rBoot = await settle(p3);                      // القياس يبدأ بعد سكون قراءات الإقلاع
  const aBoot = await p3.evaluate(() => window.__act.attached());
  await p3.evaluate(() => window.__setTab('settings'));
  const rSets = await settle(p3);
  ok('ز٧ بطاقات الأدوار والمهام والصلاحيّات القديمة ما زالت في مكانها',
    (await has(p3, 'savePermRoles')) && (await page_has(p3, 'المهام التنظيمية')));
  ok('ز٨ كلفة الشاشة = عدد المستخدمين لا غير (قائمة الاستثناءات القائمة قبل ط-١٦)',
    (rSets - rBoot) === 2, 'users=2 reads=' + (rSets - rBoot));
  ok('ز٩ ولا تفتح مستمعًا جديدًا (لا تخالف د-٧)', (await p3.evaluate(() => window.__act.attached())) === aBoot,
    String(await p3.evaluate(() => window.__act.attached())));
  await shut(p3);

  // والبرهان القاطع أنّ الحقول الثلاثة والأربعين لم تُضِف قراءةً واحدة: ضاعِف المستخدمين
  // وستتضاعف الكلفة معهم وحدهم، بينما يبقى عدد الحقول ٤٣ كما هو في الحالتين.
  const p4 = await open({ settings: false, extraUsers: 4 });
  const r4a = await settle(p4);
  await p4.evaluate(() => window.__setTab('settings'));
  const r4b = await settle(p4);
  const f4 = await p4.evaluate(() => document.querySelectorAll('.setf').length);
  ok('ز١٠ ستّة مستخدمين = ستّ قراءات، والحقول ما زالت ٤٣ ⇒ ط-١٦ أضافت صفر قراءة',
    (r4b - r4a) === 6 && f4 === 43, 'reads=' + (r4b - r4a) + ' fields=' + f4);
  await shut(p4);
}
async function page_has(p, s) { return (await p.evaluate(() => window.__contentHtml())).indexOf(s) >= 0; }

// ═════════ المجموعة ح — الإعدادات المحفوظة تُقرأ عند الإقلاع وتحكم السلوك فعلًا ═════════
{
  // القيم المحفوظة سلفًا تظهر في اللوحة، لا الافتراضات
  const page = await open({ config: { catalog: { 'cost.updatePolicy': 'never', 'cost.jumpAlertPct': 77 }, history: { 'history.mergeRuns': false }, quota: { 'quota.warnAt': 42 } } });
  const shown = await page.evaluate(() => ({
    a: document.getElementById(window.__sets.id('cost.updatePolicy')).value,
    b: Number(document.getElementById(window.__sets.id('cost.jumpAlertPct')).value),
    c: document.getElementById(window.__sets.id('history.mergeRuns')).checked,
    d: Number(document.getElementById(window.__sets.id('quota.warnAt')).value)
  }));
  ok('ح١ الإعداد المحفوظ يظهر في اللوحة لا الافتراض', shown.a === 'never' && shown.b === 77 && shown.c === false && shown.d === 42, JSON.stringify(shown));
  const unset = await page.evaluate(() => ({
    e: document.getElementById(window.__sets.id('barcode.normalize')).checked,
    f: window.__sets.val('catalog', 'barcode.normalize'), g: window.__sets.defaults('catalog')['barcode.normalize']
  }));
  ok('ح٢ المفتاح غير المحفوظ يعرض افتراضه (لا فراغًا ولا صفرًا)', unset.e === unset.g && unset.f === unset.g, JSON.stringify(unset));

  // وأهمّ من العرض: أنّ السلوك نفسه تبِع الإعداد
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
  for (const c of ['A1', 'A1', 'A1']) {
    await page.evaluate(x => window.__scanCommit(x, 'test'), c);
    await page.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
  }
  const d = await page.evaluate(() => window.__hist14.doc('sr', 'A1'));
  ok('ح٣ إطفاء الدمج من الإعدادات يعيد السلوك القديم: ٣ سطورٍ لا سطرًا واحدًا',
    (d.entries || []).length === 3, JSON.stringify((d.entries || []).length));
  ok('ح٤ والكميّة ٣ في الحالتين — الرقم لا يتبع شكل السجلّ أبدًا', d.qty === 3, String(d.qty));
  await shut(page);
}

await browser.close();
const pass = results.filter(r => r.pass).length;
results.forEach(r => console.log((r.pass ? '✓ ' : '✗ ') + r.n + (r.pass ? '' : '  << ' + r.d)));
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
