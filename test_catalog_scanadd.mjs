// اختبارات ط-١٣ (المهمّة ٧٩): تدفّقا ٤ و٥ — الموافقة على صنف الكتالوج أثناء المسح
// تُثبت: البحث بدلالات المسح نفسها (مطابق/أصفار بادئة/أرقام فقط)، ونافذة موافقةٍ لا تسرق التركيز
// ولا تُفقد مسحة، وإدراجًا بـ book=0 و src='catalog' وتكلفةٍ مُجمَّدة، ثمّ +١ واحدة بالضبط عبر
// مسار addEntry القائم بلا نسخةٍ ثانية من المنطق، وبوّاباتِ الإعدادات، ومسار دون اتصال،
// وسجلَّ الباركودات المجهولة المحلّيّ بصفر كلفةٍ سحابيّة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

// ═════ بيانات الجلسة: عشرة أصناف داخل اللقطة ═════
const N = 10;
const cd = (i) => 'P' + String(i).padStart(4, '0');
const bc = (i) => '6281000' + String(100000 + i);
const ITEMS = [];
for (let i = 1; i <= N; i++) ITEMS.push({ code: cd(i), name: 'صنف جلسة ' + i, category: 'ك', book: (i % 9) + 1, cost: (i % 5) + 1, barcode: bc(i) });

// ═════ الكتالوج الرئيسيّ: أصنافٌ خارج الجلسة تمامًا ═════
const kb = (i) => '6285000' + String(200000 + i);
const CAT = [];
for (let i = 1; i <= 20; i++) CAT.push({ barcode: kb(i), code: 'K' + String(i).padStart(4, '0'), name: 'صنف كتالوج ' + i, category: 'فئة ' + (i % 3), cost: i + 0.5, unit: 'حبة' });
const KZ = { barcode: '0012345', code: 'KZ1', name: 'صنف بأصفارٍ بادئة', category: 'ق-ز', cost: 7, unit: 'كرتون' };
const KG = { barcode: 'AB-98765', code: 'KG1', name: 'صنف برموز', category: 'ق-ج', cost: 3, unit: 'علبة' };
const KS = { barcode: 'X-99', code: 'KS1', name: 'صنف رقمه قصير', category: 'ق-ق', cost: 2, unit: 'حبة' };
const KI = { barcode: '6285000299999', code: 'KI1', name: 'صنف موقوف', category: 'ق-و', cost: 5, unit: 'حبة', status: 'inactive' };
CAT.push(KZ, KG, KS, KI);
const META = { ver: 'v1', count: CAT.length, at: 1750000000000 };
const TARGET = kb(1);                                     // الباركود المستعمل في أغلب الفحوص
const TNAME = 'صنف كتالوج 1', TCAT = 'فئة 1', TCOST = 1.5;
const UNKNOWN = '9990001112223';                          // لا في الجلسة ولا في الكتالوج

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

// كلّ فتحةٍ في سياقٍ مستقلّ ⇒ عزل localStorage (مرآة الكتالوج + سقف اليوم + سجلّ المجهولة)
async function open(opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  const sess = Object.assign({ id: 'sr', name: 'جرد الكتالوج', status: 'open', started: true, assignedCounters: ['u_owner'], location: 'فرع أ', itemCount: N, __chunks: [ITEMS] }, opt.sess || {});
  const sc = { profile: OWNER, users: [OWNER], sessions: [sess], catalogChunks: [CAT], catalogMeta: META };
  if (opt.config) sc.config = opt.config;
  if (opt.noCatalog) { delete sc.catalogChunks; delete sc.catalogMeta; }
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64(sc)));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  if (opt.opts) await page.evaluate(o => window.__cimp.setOpt(o), opt.opts);
  if (opt.feat === false) await page.evaluate(() => window.__cimp.setFeat(false));
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 15000 });
  // التسخين لا يقع إلّا حين يكون المسار مُفعَّلًا (وهو المقصود): علمٌ مُطفأ أو autoAdd=off ⇒ لا قراءة أصلًا
  const warms = !opt.noCatalog && opt.feat !== false && !(opt.opts && opt.opts['catalog.autoAdd'] === 'off');
  if (warms) await page.waitForFunction(() => window.__cat.loaded() === true, { timeout: 15000 });
  await page.waitForTimeout(300);
  page.__ctx = ctx;
  return page;
}
const shut = async (page) => { await page.close(); await page.__ctx.close(); };
const scan = (page, code) => page.evaluate(c => window.__scanCommit(c, 'test'), code);
const idle = (page) => page.waitForFunction(() => window.__scanIdle() === true, { timeout: 15000 });
const askOpen = (page) => page.waitForFunction(() => window.__cat13.askShown() === true, { timeout: 15000 });
const panel = (page) => page.evaluate(() => window.__scanPanel());
const extraDoc = (page, code) => page.evaluate(c => { const d = window.__store['sessions/sr/extraItems/' + c]; return d ? JSON.parse(JSON.stringify(d)) : null; }, code);
const countDoc = (page, code) => page.evaluate(c => { const d = window.__store['sessions/sr/counts/' + c]; return d ? { qty: d.qty, n: (d.entries || []).length, s: (d.entries || []).reduce((t, e) => t + (e && e.n > 1 ? e.n : 1), 0) } : null; }, code);
const keys = (page, pre) => page.evaluate(p => Object.keys(window.__store).filter(k => k.indexOf(p) === 0).length, pre);
// مسحةٌ واحدة مع موافقةٍ صريحة، وانتظار فراغ الطابور
async function scanApprove(page, code) { await scan(page, code); await askOpen(page); await page.evaluate(() => window.__cat13.yes()); await idle(page); }

// ═════════ المجموعة أ — دلالات البحث: مطابقة findByScan حرفًا بحرف ═════════
{
  const page = await open();
  const f = (c) => page.evaluate(x => { const i = window.__cat13.findScan(x); return i ? i.code : null; }, c);

  ok('أ١ مطابقةٌ تامّة', await f(TARGET) === 'K0001', String(await f(TARGET)));
  ok('أ٢ أصفارٌ بادئة في الكتالوج تُطابَق بالمجرّد', await f('12345') === 'KZ1', String(await f('12345')));
  ok('أ٢ب أصفارٌ بادئة في المسحة تُطابَق كذلك', await f('000' + TARGET) === 'K0001', String(await f('000' + TARGET)));
  ok('أ٣ أرقامٌ فقط (طول ≥ ٤) تتجاوز الرموز', await f('98765') === 'KG1', String(await f('98765')));
  ok('أ٤ الأرقام القصيرة (< ٤) لا تُطابَق — منعًا للتصادم', await f('99') === null, String(await f('99')));
  ok('أ٥ باركودٌ مجهولٌ تمامًا = null', await f(UNKNOWN) === null, String(await f(UNKNOWN)));

  // catalogFind (المطابقة التامّة المستعملة في الاستيراد) لم تتغيّر: لا أصفار ولا أرقام فقط
  const exact = (c) => page.evaluate(x => { const i = window.__cat.find(x); return i ? i.code : null; }, c);
  ok('أ٦ بحث الاستيراد بقي مطابقةً تامّةً بلا دلالات مسح', await exact('12345') === null && await exact('98765') === null && await exact(TARGET) === 'K0001',
    [await exact('12345'), await exact('98765'), await exact(TARGET)].join('|'));

  // إعدادٌ يُطفئ مسار الأصفار البادئة
  await page.evaluate(() => window.__cimp.setOpt({ 'barcode.stripLeadingZeros': false }));
  ok('أ٧ إطفاء الأصفار البادئة من الإعدادات يُلغي المسار الثاني فقط', await f('12345') === null && await f('98765') === 'KG1',
    [await f('12345'), await f('98765')].join('|'));
  await page.evaluate(() => window.__cimp.clrOpt());

  ok('أ٨ الطبقة لا تكتب في Firestore أثناء البحث', await page.evaluate(() => Object.keys(window.__store).filter(k => k.indexOf('catalog') === 0 && k !== 'catalogMeta/version' && k.indexOf('catalogChunks/') !== 0).length) === 0);
  await shut(page);
}

// ═════════ المجموعة ب — تدفّق ٤: الموافقة تُدرج وتَعُدّ في خطوةٍ واحدة ═════════
{
  const page = await open();
  ok('ب٠ الميزة مُفعَّلة افتراضيًّا والكتالوج سُخِّن عند فتح الجلسة', await page.evaluate(() => window.__cat13.on()) === true && await page.evaluate(() => window.__cat.loaded()) === true);

  await scan(page, TARGET);
  await askOpen(page);
  ok('ب١ نافذة الموافقة ظهرت للباركود غير الموجود في الجلسة', await page.evaluate(() => window.__cat13.askShown()) === true);

  const txt = await page.evaluate(() => window.__cat13.askText());
  ok('ب٢ نصّ السؤال هو المنصوص عليه في التصميم',
    txt.indexOf('غير موجودٍ في جلسة الجرد الحالية') >= 0 && txt.indexOf('موجودٌ في كتالوج المنتجات الرئيسيّ') >= 0 && txt.indexOf('هل تريد إضافته') >= 0, txt.slice(0, 160));

  const cells = await page.evaluate(() => window.__cat13.askCells());
  ok('ب٣ النافذة تعرض الاسم والباركود والفئة والرصيد الدفتري صفرًا',
    cells['اسم المنتج'] === TNAME && cells['الباركود'] === TARGET && cells['الفئة'] === TCAT && cells['الرصيد الدفتري'] === '0', JSON.stringify(cells));
  ok('ب٣ب التكلفة تظهر للمخوَّل ماليًّا في جلسةٍ غير عمياء', cells['التكلفة'] != null, JSON.stringify(cells));

  const pPend = await panel(page);
  ok('ب٤ لوحة المسح تُعلن الانتظار وتطمئن أنّ المسحات لن تُفقد',
    pPend && pPend.cls.indexOf('pending') >= 0 && pPend.text.indexOf('لن تُفقد') >= 0, pPend ? pPend.cls : 'null');

  ok('ب٥ التركيز بقي في حقل المسح ولم تسرقه النافذة', await page.evaluate(() => window.__focusId()) === 'csearch', await page.evaluate(() => window.__focusId()));

  await page.evaluate(() => window.__cat13.yes());
  await idle(page);
  ok('ب٦ النافذة أُغلقت بعد الموافقة', await page.evaluate(() => window.__cat13.askShown()) === false);

  const ex = await extraDoc(page, TARGET);
  ok('ب٧ أُدرج الصنف في extraItems بمعرّفٍ = الباركود', !!ex, JSON.stringify(ex));
  ok('ب٨ الرصيد الدفتري صفر (قرار ٥-١)', ex && ex.book === 0, ex ? String(ex.book) : 'null');
  ok('ب٩ التكلفة والفئة والوحدة والاسم من الكتالوج', ex && ex.cost === TCOST && ex.category === TCAT && ex.unit === 'حبة' && ex.name === TNAME, JSON.stringify(ex));
  ok('ب١٠ وُسِم مصدره catalog ووُسِم manual (شارة العدّ والزيادة)', ex && ex.src === 'catalog' && ex.manual === true, JSON.stringify(ex));
  ok('ب١١ الباركود مطابقٌ لباركود الكتالوج', ex && ex.barcode === TARGET && ex.code === TARGET);
  ok('ب١٢ سُجِّل من أضافه', ex && ex.addedBy === 'u_owner' && ex.addedByName === 'المالك');
  ok('ب١٣ ختم الإضافة من الخادم لا من الجهاز', ex && ex.addedAt && typeof ex.addedAt === 'object' && ex.addedAt.__ts != null, JSON.stringify(ex && ex.addedAt));

  const c = await countDoc(page, TARGET);
  ok('ب١٤ زيادةٌ واحدةٌ بالضبط وصلت عبر مسار addEntry القائم', c && c.qty === 1 && c.n === 1, JSON.stringify(c));

  const pOk = await panel(page);
  ok('ب١٥ لوحة النتيجة تعلن النجاح باسم الصنف وإجماليه', pOk && pOk.cls.indexOf('ok') >= 0 && pOk.head.indexOf(TNAME) >= 0 && pOk.cells['الإجمالي بعد التحديث'] === '1', pOk ? JSON.stringify(pOk.cells) : 'null');
  ok('ب١٦ الماسح عاد جاهزًا فورًا بلا نقرة', await page.evaluate(() => window.__focusId()) === 'csearch' && await page.evaluate(() => window.__scanIdle()) === true);
  ok('ب١٧ الصنف ظهر في قائمة العدّ بشارة «كتالوج»', await page.evaluate(() => { const h = window.__cat13.clistHtml(); return h.indexOf('6285000200001') >= 0 && h.indexOf('>كتالوج</span>') >= 0 && h.indexOf('>يدوي</span>') < 0; }) === true);

  // المسحة الثانية للباركود نفسه: لا نافذة — الصنف صار من الجلسة
  await scan(page, TARGET); await idle(page);
  ok('ب١٨ المسحة التالية لا تفتح نافذةً وتزيد الكمية مباشرةً', await page.evaluate(() => window.__cat13.askShown()) === false);
  const c2 = await countDoc(page, TARGET);
  ok('ب١٩ ط-١٤: الكمية صارت ٢ في سطرٍ واحدٍ متّصل (لا ازدواج ولا فقدان)', c2 && c2.qty === 2 && c2.n === 1 && c2.s === 2, JSON.stringify(c2));
  ok('ب٢٠ لم يُنشأ مستند صنفٍ ثانٍ', await keys(page, 'sessions/sr/extraItems/') === 1, String(await keys(page, 'sessions/sr/extraItems/')));

  // تجميد التكلفة (قرار ٦-٢): تغيّر الكتالوج بعد الإضافة لا يمسّ الجلسة
  await page.evaluate(() => { window.__cat.clear(); window.__store['catalogChunks/chunk_0000'].items[0].cost = 999; window.__store['catalogMeta/version'].ver = 'v9'; });
  await page.evaluate(() => window.__cat.ensure());
  const exFrozen = await extraDoc(page, TARGET);
  ok('ب٢١ التكلفة مُجمَّدة لحظة الإضافة — كتالوجٌ جديد لا يغيّر تقرير الجلسة', exFrozen && exFrozen.cost === TCOST, String(exFrozen && exFrozen.cost));
  await shut(page);
}

// ═════════ المجموعة ج — م٧: المعاينة مُراقِبٌ لا بوّابة — العدّ يستمرّ واللوحة معروضة ═════════
{
  const page = await open();
  await scan(page, TARGET);
  await askOpen(page);

  // ثلاث مسحاتٍ تصل واللوحة معروضة — كانت تتجمّد في الطابور، وصارت تُعدّ في حينها
  await scan(page, bc(2)); await scan(page, bc(2)); await scan(page, bc(3));
  await idle(page);
  ok('ج١ المسحات الواردة واللوحة معروضة تُعدّ فورًا — لا تجمّد للطابور',
    await page.evaluate(() => window.__scanQueueLen()) === 0 && (await countDoc(page, cd(2))).qty === 2 && (await countDoc(page, cd(3))).qty === 1,
    JSON.stringify([await page.evaluate(() => window.__scanQueueLen()), await countDoc(page, cd(2)), await countDoc(page, cd(3))]));
  ok('ج١ب واللوحة لم تُغلق ولم يتبدّل معروضها', await page.evaluate(() => window.__cat13.askShown()) === true && await page.evaluate(() => window.__ca7.focus()) === TARGET,
    await page.evaluate(() => window.__ca7.focus()));
  ok('ج١ج والمسحة المحجوزة محفوظةٌ بتمامها بانتظار القرار', await page.evaluate(() => window.__ca7.total()) === 1 && await page.evaluate(() => window.__ca7.size()) === 1,
    String(await page.evaluate(() => window.__ca7.total())));
  ok('ج١د ولا كتابةَ للصنف المعلَّق قبل الاعتماد', (await extraDoc(page, TARGET)) === null && (await countDoc(page, TARGET)) === null);
  ok('ج١هـ ولا مستندَ صنفٍ أُنشئ للمعلَّق ولا قراءةَ كتالوجٍ إضافيّة',
    await keys(page, 'sessions/sr/extraItems/') === 0 && await page.evaluate(() => window.__cat.reads()) === 2,
    (await keys(page, 'sessions/sr/extraItems/')) + '|' + await page.evaluate(() => window.__cat.reads()));

  // «Enter» أثناء حزمة ماسحٍ جارية ليست موافقةً بشريّة
  await page.evaluate(() => window.__cat13.setBuf('628'));
  await page.evaluate(() => window.__cat13.key('Enter'));
  await page.waitForTimeout(120);
  ok('ج٢ Enter لا يوافق ما دامت حزمة ماسحٍ جارية', await page.evaluate(() => window.__cat13.askShown()) === true);

  await page.evaluate(() => window.__cat13.setBuf(null));
  await page.evaluate(() => window.__cat13.key('Enter'));
  await idle(page);
  ok('ج٣ Enter يوافق حين لا حزمة ماسحٍ جارية', await page.evaluate(() => window.__cat13.askShown()) === false && !!(await extraDoc(page, TARGET)));

  const cT = await countDoc(page, TARGET), c2 = await countDoc(page, cd(2)), c3 = await countDoc(page, cd(3));
  ok('ج٤ صنف الكتالوج عُدّ مرّةً واحدة', cT && cT.qty === 1 && cT.n === 1, JSON.stringify(cT));
  ok('ج٥ المسحات المطابورة تمّت كاملةً بعد الموافقة (ط-١٤: سطرٌ واحدٌ بمسحتين)', c2 && c2.qty === 2 && c2.n === 1 && c2.s === 2 && c3 && c3.qty === 1, JSON.stringify([c2, c3]));
  ok('ج٦ الطابور فرغ والماسح جاهز', await page.evaluate(() => window.__scanIdle()) === true && await page.evaluate(() => window.__focusId()) === 'csearch');
  await shut(page);
}

// ═════════ المجموعة د — الإلغاء لا يتكرّر ولا يوقف العدّاد ═════════
{
  const page = await open();
  await scan(page, TARGET);
  await askOpen(page);
  await page.evaluate(() => window.__cat13.key('Escape'));
  await idle(page);

  ok('د١ Escape يُلغي الإضافة', await page.evaluate(() => window.__cat13.askShown()) === false && (await extraDoc(page, TARGET)) === null);
  ok('د٢ لم تُسجَّل أي كمية', (await countDoc(page, TARGET)) === null);
  ok('د٣ الباركود سُجّل في قائمة المرفوضين لهذه الجلسة', (await page.evaluate(() => window.__cat13.declined())).indexOf(TARGET) >= 0, JSON.stringify(await page.evaluate(() => window.__cat13.declined())));
  const pd = await panel(page);
  ok('د٤ اللوحة تشرح البديل «➕ صنف يدوي»', pd && pd.cls.indexOf('err') >= 0 && pd.text.indexOf('صنف يدوي') >= 0, pd ? pd.text.slice(0, 120) : 'null');
  ok('د٥ الباركود محفوظٌ لتعبئة حوار الصنف اليدوي مسبقًا', await page.evaluate(() => window.__lastUnknownScan()) === TARGET);

  // إعادة المسح: لا نافذةَ ثانية — لا إزعاج
  await scan(page, TARGET); await idle(page);
  ok('د٦ لا تتكرّر النافذة للصنف المرفوض في الجلسة نفسها', await page.evaluate(() => window.__cat13.askShown()) === false);
  ok('د٧ ولا يزال بلا إدراجٍ ولا كمية', (await extraDoc(page, TARGET)) === null && (await countDoc(page, TARGET)) === null);
  ok('د٨ الماسح جاهزٌ للباركود التالي بعد الرفض', await page.evaluate(() => window.__focusId()) === 'csearch');

  // الرفض لا يعطّل بقية العمل
  await scan(page, bc(4)); await idle(page);
  ok('د٩ العدّ العادي يستمرّ بلا تأثّر', (await countDoc(page, cd(4))).qty === 1);

  // زرّ «إلغاء» بالفأرة كذلك
  await scan(page, kb(2)); await askOpen(page);
  await page.evaluate(() => window.__cat13.no()); await idle(page);
  ok('د١٠ زرّ الإلغاء يعمل كما Escape', (await extraDoc(page, kb(2))) === null && (await page.evaluate(() => window.__cat13.declined())).length === 2);

  // إعادة فتح الجلسة تُصفّر قائمة المرفوضين (قرار: الرفض لجلسةٍ واحدة)
  await page.evaluate(() => window.__cat13.warm());
  ok('د١١ تسخين الجلسة يُصفّر قائمة المرفوضين', (await page.evaluate(() => window.__cat13.declined())).length === 0);
  await shut(page);
}

// ═════════ المجموعة هـ — بوّابات الإعدادات ═════════
{
  // هـ-أ: الميزة مُطفأة كلّيًّا ⇒ السلوك القديم حرفًا بحرف (تدفّق ٥)
  const p1 = await open({ feat: false });
  ok('هـ١ إطفاء علم الكتالوج الرئيسيّ يُعيد السلوك القديم', await p1.evaluate(() => window.__cat13.on()) === false);
  await scan(p1, TARGET); await idle(p1);
  ok('هـ٢ لا نافذة ولا إدراج والرسالة رسالة الجلسة القديمة', await p1.evaluate(() => window.__cat13.askShown()) === false && (await extraDoc(p1, TARGET)) === null);
  const pe = await panel(p1);
  ok('هـ٣ النصّ القديم لا يذكر الكتالوج', pe && pe.text.indexOf('كتالوج المنتجات الرئيسيّ') < 0, pe ? pe.text.slice(0, 120) : 'null');
  await shut(p1);

  // هـ-ب: catalog.autoAdd='off'
  const p2 = await open({ opts: { 'catalog.autoAdd': 'off' } });
  ok('هـ٤ الإعداد off يُعطّل المسار كاملًا', await p2.evaluate(() => window.__cat13.on()) === false);
  await scan(p2, TARGET); await idle(p2);
  ok('هـ٥ ولا إدراج ولا نافذة', (await extraDoc(p2, TARGET)) === null && await p2.evaluate(() => window.__cat13.askShown()) === false);
  await shut(p2);

  // هـ-ج: catalog.autoAdd='auto' — بلا سؤال (خيارٌ صريحٌ لا افتراض)
  const p3 = await open({ opts: { 'catalog.autoAdd': 'auto' } });
  await scan(p3, TARGET); await idle(p3);
  ok('هـ٦ الوضع التلقائيّ يُدرج بلا نافذة', await p3.evaluate(() => window.__cat13.askShown()) === false && !!(await extraDoc(p3, TARGET)));
  ok('هـ٧ والكمية زيادةٌ واحدة كالمعتاد', (await countDoc(p3, TARGET)).qty === 1);
  await shut(p3);

  // هـ-د: السقف اليوميّ
  const p4 = await open({ opts: { 'catalogAdd.dailyCap': 2, 'catalog.autoAdd': 'auto' } });
  await scan(p4, kb(1)); await idle(p4);
  await scan(p4, kb(2)); await idle(p4);
  ok('هـ٨ الإضافتان الأوليان مرّتا والسقف يُحتسب محلّيًّا', await p4.evaluate(() => window.__cat13.capUsed()) === 2, String(await p4.evaluate(() => window.__cat13.capUsed())));
  await scan(p4, kb(3)); await idle(p4);
  ok('هـ٩ الثالثة مُنعت عند السقف', (await extraDoc(p4, kb(3))) === null && (await countDoc(p4, kb(3))) === null);
  const pc = await panel(p4);
  ok('هـ١٠ اللوحة تشرح السقف وتقترح البديل', pc && pc.text.indexOf('سقف الإضافات اليوميّ') >= 0 && pc.text.indexOf('صنف يدوي') >= 0, pc ? pc.text.slice(0, 120) : 'null');
  ok('هـ١١ عدّاد السقف لكل مستخدمٍ ويومٍ على حدة', (await p4.evaluate(() => window.__cat13.capKey())).indexOf('iomp-cadd-u_owner-') === 0, await p4.evaluate(() => window.__cat13.capKey()));
  await shut(p4);

  // هـ-هـ: صنفٌ موقوف — الافتراض: يُرى ويُضاف مع تنبيه
  const p5 = await open();
  await scan(p5, KI.barcode); await askOpen(p5);
  ok('هـ١٢ الصنف الموقوف يظهر مع تنبيهٍ صريح', (await p5.evaluate(() => window.__cat13.askWarn())).indexOf('موقوفٌ') >= 0, await p5.evaluate(() => window.__cat13.askWarn()));
  await p5.evaluate(() => window.__cat13.yes()); await idle(p5);
  ok('هـ١٣ الموافقة تُدرجه كغيره', !!(await extraDoc(p5, KI.barcode)) && (await countDoc(p5, KI.barcode)).qty === 1);
  await shut(p5);

  // هـ-و: منع إضافة الموقوف
  const p6 = await open({ opts: { 'catalog.allowInactiveAdd': false } });
  await scan(p6, KI.barcode); await idle(p6);
  ok('هـ١٤ منع الموقوف يوقف الإدراج ويشرح السبب', (await extraDoc(p6, KI.barcode)) === null && (await panel(p6)).text.indexOf('موقوف') >= 0);
  ok('هـ١٥ ولا يُسجَّل في المجهولة (فهو معروفٌ في الكتالوج)', (await p6.evaluate(() => window.__cat13.unkGet())).length === 0);
  await shut(p6);

  // هـ-ز: إخفاء الموقوف كلّيًّا ⇒ يسقط لتدفّق ٥
  const p7 = await open({ opts: { 'catalog.inactiveVisible': false } });
  await scan(p7, KI.barcode); await idle(p7);
  ok('هـ١٦ إخفاء الموقوف يجعله مجهولًا تمامًا', (await extraDoc(p7, KI.barcode)) === null && (await p7.evaluate(() => window.__cat13.unkGet())).length === 1);
  await shut(p7);

  // هـ-ح: جلسةٌ عمياء
  const p8 = await open({ sess: { blind: true } });
  await scan(p8, TARGET); await askOpen(p8);
  const bc8 = await p8.evaluate(() => window.__cat13.askCells());
  ok('هـ١٧ الجلسة العمياء لا تكشف التكلفة في النافذة', bc8['التكلفة'] == null && bc8['اسم المنتج'] === TNAME, JSON.stringify(bc8));
  await p8.evaluate(() => window.__cat13.yes()); await idle(p8);
  ok('هـ١٨ والإضافة تعمل في العمياء افتراضيًّا', !!(await extraDoc(p8, TARGET)) && (await countDoc(p8, TARGET)).qty === 1);
  await shut(p8);

  // هـ-ط: منع الإضافة في العمياء
  const p9 = await open({ sess: { blind: true }, opts: { 'catalogAdd.allowInBlind': false } });
  await scan(p9, TARGET); await idle(p9);
  ok('هـ١٩ منع الإضافة في العمياء يسقط لتدفّق ٥', await p9.evaluate(() => window.__cat13.askShown()) === false && (await extraDoc(p9, TARGET)) === null && (await p9.evaluate(() => window.__cat13.unkGet())).length === 1);
  await shut(p9);

  // هـ-ي: إطفاء شارة «كتالوج» يعيدها «يدوي» بلا مساسٍ بأي حساب
  const p10 = await open({ opts: { 'catalogAdd.badge': false, 'catalog.autoAdd': 'auto' } });
  await scan(p10, TARGET); await idle(p10);
  const h10 = await p10.evaluate(() => window.__cat13.clistHtml());
  ok('هـ٢٠ إطفاء الشارة يُظهر «يدوي» والحسابات كما هي', h10.indexOf('>كتالوج</span>') < 0 && h10.indexOf('>يدوي</span>') >= 0 && (await extraDoc(p10, TARGET)).src === 'catalog');
  await shut(p10);
}

// ═════════ المجموعة و — دون اتصال: العدّ لا يتوقّف والصنف يظهر فورًا ═════════
{
  const page = await open({ config: { features: { offlineCount: true, masterCatalog: true } } });
  ok('و٠ علم العدّ دون اتصال مُفعَّل في هذه الحالة', await page.evaluate(() => window.__featuresOfflineOn()) === true);

  await page.evaluate(() => window.__offline.setOnlineNoFlush(false));
  await scanApprove(page, TARGET);

  ok('و١ لا كتابةً في Firestore ولا للصنف ولا للعدّة', (await extraDoc(page, TARGET)) === null && (await countDoc(page, TARGET)) === null);
  const q = await page.evaluate(() => window.__offline.queue());
  ok('و٢ عمليتان في الطابور: إدراج الصنف ثمّ زيادته', q.length === 2 && q[0].op === 'additem' && q[1].op === 'add', JSON.stringify(q.map(x => x.op)));
  ok('و٣ ترتيب التسلسل يضمن وصول الصنف قبل عدّاته', q[0].seq < q[1].seq, q[0].seq + '<' + q[1].seq);
  ok('و٤ ختم الإضافة رقمٌ لا رمز خادم (رموز الخادم لا تُحفظ في IndexedDB)', q[0].item && typeof q[0].item.addedAt === 'number', typeof (q[0].item || {}).addedAt);
  ok('و٥ حقول الصنف كاملةٌ في الطابور بـ book=0 و src=catalog', q[0].item && q[0].item.book === 0 && q[0].item.src === 'catalog' && q[0].item.cost === TCOST, JSON.stringify(q[0].item));

  ok('و٦ الصنف ظهر فورًا في قائمة العدّ (انعكاسٌ تفاؤليّ)', (await page.evaluate(() => window.__cat13.codes())).indexOf(TARGET) >= 0);
  ok('و٧ والكمية المحلّيّة ١ — العدّاد لا ينتظر الشبكة', await page.evaluate(c => { const m = window.__countsMap(); return m[c] ? m[c].qty : null; }, TARGET) === 1);

  // مسحةٌ ثانيةٌ دون اتصال: لا نافذةَ ثانية — الصنف صار معروفًا محلّيًّا
  await scan(page, TARGET); await idle(page);
  ok('و٨ المسحة التالية دون اتصال لا تفتح نافذةً وتُطابر مباشرةً', await page.evaluate(() => window.__cat13.askShown()) === false && (await page.evaluate(() => window.__offline.queue())).length === 3);

  await page.evaluate(() => window.__offline.setOnline(true));
  await page.waitForFunction(() => window.__offline.queue().then(q => q.length === 0), { timeout: 15000 });

  const ex = await extraDoc(page, TARGET);
  ok('و٩ بعد المزامنة كُتب الصنف في extraItems', !!ex && ex.book === 0 && ex.src === 'catalog' && ex.cost === TCOST, JSON.stringify(ex));
  ok('و١٠ وختم الإضافة صار ختم خادمٍ حقيقيًّا عند الدفع', ex && ex.addedAt && typeof ex.addedAt === 'object' && ex.addedAt.__ts != null, JSON.stringify(ex && ex.addedAt));
  const c = await countDoc(page, TARGET);
  ok('و١١ والكميتان وصلتا بلا ازدواجٍ ولا فقدان (ط-١٤: سطرٌ واحدٌ بمسحتين)', c && c.qty === 2 && c.n === 1 && c.s === 2, JSON.stringify(c));
  await shut(page);
}

// ═════════ المجموعة ز — تدفّق ٥: مجهولٌ في كل مكانٍ بصفر كلفةٍ سحابيّة ═════════
{
  const page = await open();
  const before = await page.evaluate(() => Object.keys(window.__store).length);
  await scan(page, UNKNOWN); await idle(page);

  const pz = await panel(page);
  ok('ز١ رسالة الجهل تذكر الكتالوج الرئيسيّ صراحةً', pz && pz.cls.indexOf('err') >= 0 && pz.text.indexOf('ولا في كتالوج المنتجات الرئيسيّ') >= 0, pz ? pz.text.slice(0, 140) : 'null');
  ok('ز٢ صفر كتابات في Firestore', await page.evaluate(() => Object.keys(window.__store).length) === before, before + '→' + await page.evaluate(() => Object.keys(window.__store).length));
  ok('ز٣ الماسح جاهزٌ فورًا للباركود التالي', await page.evaluate(() => window.__scanIdle()) === true && await page.evaluate(() => window.__focusId()) === 'csearch');

  const l1 = await page.evaluate(() => window.__cat13.unkGet());
  ok('ز٤ سُجّل محلّيًّا بعدّاد مسحاتٍ ١ ومعرّف الجلسة', l1.length === 1 && l1[0].code === UNKNOWN && l1[0].n === 1 && l1[0].sid === 'sr', JSON.stringify(l1));

  await scan(page, UNKNOWN); await scan(page, UNKNOWN); await idle(page);
  const l2 = await page.evaluate(() => window.__cat13.unkGet());
  ok('ز٥ التكرار يزيد العدّاد ولا يكرّر السطر', l2.length === 1 && l2[0].n === 3, JSON.stringify(l2));

  await scan(page, '8880001112223'); await idle(page);
  ok('ز٦ باركودٌ مجهولٌ آخر = سطرٌ ثانٍ', (await page.evaluate(() => window.__cat13.unkGet())).length === 2);
  ok('ز٧ ولا تزال صفر كتابات في Firestore', await page.evaluate(() => Object.keys(window.__store).length) === before);

  await page.evaluate(() => window.__cat13.unkOpen());
  await page.waitForTimeout(200);
  const gh = await page.evaluate(() => window.__cat13.govHtml());
  ok('ز٨ العارض يسرد الباركودات ومرّات المسح ويوضّح أنّه محلّيّ', gh.indexOf(UNKNOWN) >= 0 && gh.indexOf('مرّات المسح') >= 0 && gh.indexOf('محلّيٌّ على هذا الجهاز') >= 0);
  ok('ز٩ ويعرض زرّي التصدير والمسح', gh.indexOf('unkCsv') >= 0 && gh.indexOf('unkClr') >= 0);
  ok('ز١٠ ويؤكّد أنّه لا يدخل أي تقرير', gh.indexOf('لا يدخل أي تقرير') >= 0);
  await page.evaluate(() => { const b = document.getElementById('govCancel'); if (b) b.click(); });

  // سقف السجلّ
  await page.evaluate(() => window.__cimp.setOpt({ 'unknown.logMax': 20 }));
  await page.evaluate(async () => { for (let i = 0; i < 40; i++) await window.__cat13.unkLog('U' + i, 'sr'); });
  ok('ز١١ السجلّ محدودٌ بسقفه فلا ينتفخ التخزين', (await page.evaluate(() => window.__cat13.unkGet())).length === 20, String((await page.evaluate(() => window.__cat13.unkGet())).length));

  // إطفاء السجلّ
  await page.evaluate(() => window.__cat13.unkClr());
  await page.evaluate(() => window.__cimp.setOpt({ 'unknown.logLocal': false }));
  await scan(page, UNKNOWN); await idle(page);
  ok('ز١٢ إطفاء السجلّ من الإعدادات يمنع التسجيل تمامًا', (await page.evaluate(() => window.__cat13.unkGet())).length === 0);
  await shut(page);
}

// ═════════ المجموعة ح — التزامن والحواف ═════════
{
  const page = await open();

  // صنفٌ أضافه زميلٌ لحظة المسح ⇒ لا نافذة، عدٌّ مباشر
  await page.evaluate((it) => { window.__mockSet('sessions/sr/extraItems/' + it.code, it); }, { code: TARGET, barcode: TARGET, name: TNAME, category: TCAT, cost: TCOST, unit: 'حبة', book: 0, manual: true, src: 'catalog' });
  await page.waitForFunction(c => window.__cat13.codes().indexOf(c) >= 0, TARGET, { timeout: 8000 });
  await scan(page, TARGET); await idle(page);
  ok('ح١ صنفٌ أضافه زميلٌ يُعَدّ مباشرةً بلا نافذة', await page.evaluate(() => window.__cat13.askShown()) === false && (await countDoc(page, TARGET)).qty === 1);
  ok('ح٢ معرّف المستند = الباركود ⇒ عدّادان يدمجان في مستندٍ واحد', await keys(page, 'sessions/sr/extraItems/') === 1 && await page.evaluate(c => window.__safeId(c), TARGET) === TARGET);

  // مسحةٌ بأصفارٍ بادئة تُدرج الصنف بباركود الكتالوج المعياريّ لا بنصّ المسحة
  await scan(page, '00' + kb(5)); await askOpen(page);
  await page.evaluate(() => window.__cat13.yes()); await idle(page);
  ok('ح٣ الإدراج يعتمد باركود الكتالوج لا نصّ المسحة', !!(await extraDoc(page, kb(5))) && (await extraDoc(page, '00' + kb(5))) === null);
  ok('ح٤ والزيادة وصلت للمستند نفسه', (await countDoc(page, kb(5))).qty === 1 && (await countDoc(page, '00' + kb(5))) === null);

  // مسحةٌ برموزٍ ⇒ المسار الثالث
  await scan(page, '98765'); await askOpen(page);
  await page.evaluate(() => window.__cat13.yes()); await idle(page);
  ok('ح٥ مسار الأرقام فقط يُدرج بباركود الكتالوج الأصليّ', !!(await extraDoc(page, KG.barcode)) && (await extraDoc(page, KG.barcode)).name === KG.name);

  await shut(page);

  // جلسةٌ مقفلة: بوابة العدّ نفسها تمنع كلّ شيء — لا نافذة ولا إدراج ولا كمية
  const pc = await open({ sess: { status: 'closed' } });
  await scan(pc, kb(7)); await idle(pc);
  ok('ح٦ الجلسة المقفلة لا تفتح نافذةً ولا تُدرج ولا تعدّ',
    (await extraDoc(pc, kb(7))) === null && (await countDoc(pc, kb(7))) === null && await pc.evaluate(() => window.__cat13.askShown()) === false);
  ok('ح٧ ولا تتغيّر بوابة العدّ القائمة (لا صلاحيةَ جديدة ولا قاعدةَ جديدة)', await pc.evaluate(() => window.__can('count')) === true);
  await shut(pc);
}

// ═════════ المجموعة ط — التسخين والكلفة ═════════
{
  const page = await open();
  ok('ط١ فتح الجلسة يُسخّن الكتالوج فلا ينتظر العدّاد عند أوّل مسحة', await page.evaluate(() => window.__cat.loaded()) === true);
  ok('ط٢ كلفة التسخين = مستند نسخةٍ + قطعةٍ واحدة (٤٤ صنفًا ⇒ قطعة)', await page.evaluate(() => window.__cat.reads()) === 2, String(await page.evaluate(() => window.__cat.reads())));
  ok('ط٣ حقل المسح جاهزٌ رغم التسخين (لا يحجب فتح الجلسة)', await page.evaluate(() => !!document.getElementById('csearch')) === true);

  const r0 = await page.evaluate(() => window.__cat.reads());
  for (let i = 0; i < 5; i++) { await scan(page, UNKNOWN); }
  await idle(page);
  ok('ط٤ خمس مسحاتٍ مجهولة = صفر قراءاتٍ إضافية', await page.evaluate(() => window.__cat.reads()) === r0, r0 + '→' + await page.evaluate(() => window.__cat.reads()));

  await scan(page, TARGET); await askOpen(page); await page.evaluate(() => window.__cat13.yes()); await idle(page);
  ok('ط٥ والموافقة كذلك بصفر قراءاتٍ إضافية (الفهرس في الذاكرة)', await page.evaluate(() => window.__cat.reads()) === r0, r0 + '→' + await page.evaluate(() => window.__cat.reads()));

  // بلا كتالوجٍ في السحابة: المسار يسقط بأمانٍ لتدفّق ٥
  const p2 = await open({ noCatalog: true });
  await scan(p2, TARGET); await idle(p2);
  ok('ط٦ غياب الكتالوج لا يعطب المسح — يسقط لتدفّق ٥ بأمان', (await extraDoc(p2, TARGET)) === null && (await p2.evaluate(() => window.__cat13.unkGet())).length === 1 && await p2.evaluate(() => window.__scanIdle()) === true);
  await shut(p2);
  await shut(page);
}

// ═════════ المجموعة ي — م٧: المعاينة الحيّة (تراكم · تبديل · درج · حمايات) ═════════
{
  const page = await open();
  const rd0 = await page.evaluate(() => window.__cat.reads());
  const wk0 = await keys(page, 'sessions/sr/');            // خطّ الأساس: ما كتبه فتح الجلسة نفسه
  const flush = () => page.evaluate(() => window.__ca7.flush());
  const cellsOf = () => page.evaluate(() => window.__cat13.askCells());

  // ي-أ: التراكم — الصنف نفسه يُمسح ثلاثًا قبل أيّ قرار
  await scan(page, TARGET); await askOpen(page);
  await scan(page, TARGET); await scan(page, TARGET); await idle(page); await flush();
  const c1 = await cellsOf();
  ok('ي١ الكمية الفعلية تنمو مع كل مسحةٍ قبل الاعتماد', c1['الكمية الفعلية'] === '3' && await page.evaluate(() => window.__ca7.qty()) === 3, JSON.stringify(c1));
  ok('ي٢ الفرق يساوي الكمية لأنّ الرصيد الدفتري صفر (مطابقٌ لـcomputeVariance)', c1['الفرق'] === '+3' && c1['الرصيد الدفتري'] === '0', JSON.stringify([c1['الفرق'], c1['الرصيد الدفتري']]));
  ok('ي٣ وحالة الجرد المعروضة «زيادة» بمصطلح التقارير نفسه', c1['حالة الجرد'] === 'زيادة', String(c1['حالة الجرد']));
  ok('ي٤ الشارة «موجودٌ في كتالوج المنتجات الرئيسيّ» لا تختفي مهما تكرّر المسح',
    (await page.evaluate(() => window.__ca7.badge())).indexOf('كتالوج المنتجات الرئيسيّ') >= 0, await page.evaluate(() => window.__ca7.badge()));
  ok('ي٥ الوحدة والمستودع معروضان (والفرع يندمج مع المستودع حين لا حقلَ فرعٍ للجلسة)',
    c1['الوحدة'] === 'حبة' && c1['المستودع / الفرع'] === 'فرع أ' && c1['الفرع'] == null, JSON.stringify(c1));
  ok('ي٦ الأزرار تُسمّي ما ستفعله بعدد المسحات المحجوزة',
    (await page.evaluate(() => window.__ca7.yesLabel())).indexOf('(3)') >= 0 && (await page.evaluate(() => window.__ca7.noLabel())).indexOf('3') >= 0,
    (await page.evaluate(() => window.__ca7.yesLabel())) + ' | ' + (await page.evaluate(() => window.__ca7.noLabel())));
  ok('ي٧ صفر كتابةٍ وصفر قراءةٍ إضافية طوال التعليق', await keys(page, 'sessions/sr/') === wk0 && await page.evaluate(() => window.__cat.reads()) === rd0,
    wk0 + '→' + (await keys(page, 'sessions/sr/')) + ' | ' + rd0 + '→' + await page.evaluate(() => window.__cat.reads()));

  // إعادة مسح الصنف المعروض تُحدّث عقدتين ولا تُعيد بناء اللوحة (لا رسمَ غير ضروريّ)
  await page.evaluate(() => { const e = document.getElementById('caQn'); if (e) e.setAttribute('data-mark', 'm7'); });
  await scan(page, TARGET); await idle(page); await flush();
  ok('ي٨ إعادة المسح تُحدّث الرقمين موضعيًّا ولا تُعيد بناء البلاطات',
    await page.evaluate(() => { const e = document.getElementById('caQn'); return e ? (e.getAttribute('data-mark') === 'm7' && (e.textContent || '').trim() === '4') : false; }) === true);

  // الاعتماد يُعيد المسحات الأربع المحجوزة إلى الطابور نفسه
  await page.evaluate(() => window.__ca7.approve()); await idle(page);
  const cy = await countDoc(page, TARGET);
  ok('ي٩ الاعتماد يُعيد كلّ المسحات المحجوزة: أربع مسحاتٍ = أربع زيادات', cy && cy.qty === 4 && cy.s === 4, JSON.stringify(cy));
  ok('ي١٠ وتندمج في سطر تتابعٍ واحد (ط-١٤) بمستند صنفٍ واحد', cy && cy.n === 1 && await keys(page, 'sessions/sr/extraItems/') === 1, JSON.stringify(cy));
  ok('ي١١ واللوحة أُغلقت لأنّ دفتر المعلَّق فرغ', await page.evaluate(() => window.__cat13.askShown()) === false && await page.evaluate(() => window.__ca7.size()) === 0);

  // ي-ب: تبديل المنتج — السابق ينتقل إلى الدرج بعدّاده، ولا يُفقد
  await scan(page, kb(2)); await askOpen(page);
  await scan(page, kb(2)); await scan(page, kb(3)); await idle(page); await flush();
  ok('ي١٢ مسحُ منتجٍ آخر يُبدّل المعروض بلا إغلاقٍ ولا نافذةٍ ثانية',
    await page.evaluate(() => window.__cat13.askShown()) === true && await page.evaluate(() => window.__ca7.focus()) === kb(3), await page.evaluate(() => window.__ca7.focus()));
  ok('ي١٣ والسابق محفوظٌ في الدرج بكامل عدّاده', await page.evaluate(() => window.__ca7.size()) === 2 && await page.evaluate(k => window.__ca7.qty(k), kb(2)) === 2,
    JSON.stringify(await page.evaluate(() => window.__ca7.codes())));
  ok('ي١٤ والدرج يُسمّي الصنف وعدد مسحاته صراحةً',
    (await page.evaluate(() => window.__ca7.trayHtml())).indexOf('صنف كتالوج 2') >= 0 && (await page.evaluate(() => window.__ca7.trayHtml())).indexOf('معلَّقةٌ بانتظار قرارك') >= 0,
    (await page.evaluate(() => window.__ca7.trayHtml())).slice(0, 140));
  ok('ي١٥ النقر على رقاقة الدرج يعيد الصنف إلى المعاينة بكمّيته',
    await page.evaluate(k => window.__ca7.pick(k), kb(2)) === true && await page.evaluate(() => window.__ca7.focus()) === kb(2) && (await cellsOf())['الكمية الفعلية'] === '2',
    JSON.stringify(await cellsOf()));
  ok('ي١٦ والصنف الذي تركناه صار هو الذي في الدرج', (await page.evaluate(() => window.__ca7.trayCodes())).indexOf(kb(3)) >= 0, JSON.stringify(await page.evaluate(() => window.__ca7.trayCodes())));

  // ي-ج: حارس Enter الزمنيّ — لا يُعتمَد صنفٌ تبدّل للتوّ (وليس تنقيحًا للمسح)
  ok('ي١٧ الحارس ١٢٠ مللي والسقف عشرون — ثابتان معلنان', await page.evaluate(() => window.__ca7.enterMs()) === 120 && await page.evaluate(() => window.__ca7.max()) === 20);
  await page.evaluate(() => window.__ca7.ageSwitch(0));
  await page.evaluate(() => window.__cat13.key('Enter'));
  await page.waitForTimeout(80);
  ok('ي١٨ Enter عقب تبدّل المعروض مباشرةً لا يعتمد شيئًا', (await extraDoc(page, kb(2))) === null && await page.evaluate(() => window.__ca7.size()) === 2);
  await page.evaluate(() => window.__ca7.ageSwitch(500));
  await page.evaluate(() => window.__cat13.key('Enter'));
  await idle(page); await flush();
  ok('ي١٩ وبعد انقضاء الحارس يعتمد المعروض وحده', !!(await extraDoc(page, kb(2))) && (await countDoc(page, kb(2))).qty === 2 && (await extraDoc(page, kb(3))) === null, JSON.stringify(await countDoc(page, kb(2))));
  ok('ي٢٠ واللوحة تنتقل إلى المعلَّق التالي بدل أن تُغلق', await page.evaluate(() => window.__cat13.askShown()) === true && await page.evaluate(() => window.__ca7.focus()) === kb(3));

  // ي-د: الإغلاق يُسمّي ما يُلغيه — وهو رفضٌ للجلسة كما كان
  ok('ي٢١ زرّ الإغلاق يذكر عدد المسحات التي سيُهملها', (await page.evaluate(() => window.__ca7.noLabel())).indexOf('رفض') >= 0 && (await page.evaluate(() => window.__ca7.noLabel())).indexOf('1') >= 0,
    await page.evaluate(() => window.__ca7.noLabel()));
  ok('ي٢٢ زرّ ✕ موجودٌ ويعمل عمل Esc', await page.evaluate(() => window.__ca7.closeX()) === true);
  await idle(page);
  ok('ي٢٣ فيُرفض المعروض وحده رفضًا دائمًا لهذه الجلسة', (await page.evaluate(() => window.__cat13.declined())).indexOf(kb(3)) >= 0 && (await extraDoc(page, kb(3))) === null);
  ok('ي٢٤ واللوحة أُغلقت لفراغ الدفتر', await page.evaluate(() => window.__cat13.askShown()) === false && await page.evaluate(() => window.__ca7.size()) === 0);
  const pj = await panel(page);
  ok('ي٢٥ واللوحة تشرح ما أُهمل وتذكر البديل «➕ صنف يدوي»', pj && pj.cls.indexOf('err') >= 0 && pj.text.indexOf('صنف يدوي') >= 0, pj ? pj.text.slice(0, 140) : 'null');
  ok('ي٢٦ ولا قراءةَ كتالوجٍ واحدةً زائدة في المجموعة كلّها', await page.evaluate(() => window.__cat.reads()) === rd0, rd0 + '→' + await page.evaluate(() => window.__cat.reads()));
  await shut(page);

  // ي-هـ: سقف الأصناف المعلَّقة — عشرون قرارًا مؤجَّلًا حدُّ ما يُدار
  const p2 = await open();
  for (let i = 1; i <= 20; i++) await scan(p2, kb(i));
  await idle(p2); await p2.evaluate(() => window.__ca7.flush());
  ok('ي٢٧ عشرون صنفًا معلَّقًا تُدار بلا فقدانِ مسحة', await p2.evaluate(() => window.__ca7.size()) === 20 && await p2.evaluate(() => window.__ca7.total()) === 20,
    String(await p2.evaluate(() => window.__ca7.size())));
  await scan(p2, KI.barcode); await idle(p2);
  ok('ي٢٨ والحادي والعشرون يُمنع دون المساس بالعشرين', await p2.evaluate(() => window.__ca7.size()) === 20 && (await panel(p2)).text.indexOf('سقف الأصناف المعلَّقة') >= 0,
    (await panel(p2)).text.slice(0, 140));
  ok('ي٢٩ والماسح جاهزٌ فورًا رغم بلوغ السقف', await p2.evaluate(() => window.__scanIdle()) === true && await p2.evaluate(() => window.__focusId()) === 'csearch');
  await shut(p2);

  // ي-و: لا إغلاقَ تلقائيّ البتّة — حتى لو ضُبط الإعداد القديم
  const p3 = await open({ opts: { 'catalogAdd.autoCloseSec': 1 } });
  await scan(p3, TARGET); await askOpen(p3);
  await p3.waitForTimeout(1700);
  ok('ي٣٠ الإعداد القديم للإغلاق التلقائيّ صار بلا أثر — اللوحة لا تُغلق نفسها أبدًا',
    await p3.evaluate(() => window.__cat13.askShown()) === true && await p3.evaluate(() => window.__ca7.size()) === 1);
  ok('ي٣١ والمسحة المحجوزة لم تُهدر بمرور الوقت', await p3.evaluate(() => window.__ca7.qty()) === 1);
  await shut(p3);

  // ي-ز: حقل الفرع حين يوجد في الجلسة — سطران منفصلان
  const p4 = await open({ sess: { branch: 'الفرع الشماليّ' } });
  await scan(p4, TARGET); await askOpen(p4); await p4.evaluate(() => window.__ca7.flush());
  const c4 = await p4.evaluate(() => window.__cat13.askCells());
  ok('ي٣٢ وجود حقل الفرع يفصل «المستودع» عن «الفرع» في سطرين',
    c4['المستودع'] === 'فرع أ' && c4['الفرع'] === 'الفرع الشماليّ' && c4['المستودع / الفرع'] == null, JSON.stringify(c4));
  await shut(p4);
}

await browser.close();
let pass = 0; for (const r of results) { console.log((r.pass ? '✓' : '✗') + ' ' + r.n + (r.d && !r.pass ? ('  << ' + r.d) : '')); if (r.pass) pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
