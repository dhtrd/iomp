// اختبارات م٦-٤: محرّك المسح المؤسسي — خمسة سيناريوهات تحقّق + فحوص عدائية
// المحاكاة الواقعية: ماسح سلكي يرسل الحروف بإيقاع ≤ SCAN_CADENCE_MS عبر keydown+input (بلا Enter افتراضيًّا)
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };

const N = 30;
const cd = (i) => 'P' + String(i).padStart(4, '0');
const bc = (i) => '6281000' + String(100000 + i);          // باركود ١٣ خانة
const ITEMS = [];
for (let i = 1; i <= N; i++) ITEMS.push({ code: cd(i), name: 'صنف رقم ' + i, category: 'ك', book: (i % 9) + 1, cost: (i % 5) + 1, barcode: bc(i) });
const mkSess = (status) => [{ id:'sr', name:'جرد المسح', status:status||'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:N, __chunks:[ITEMS] }];

const results = []; const ok = (n, c, d = '') => results.push({ n, pass: !!c, d });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });

async function open(status) {
  const page = await ctx.newPage();
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64({ profile: OWNER, users: [OWNER], sessions: mkSess(status) })));
  await page.waitForFunction('window.__ready===true', { timeout: 12000 });
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 12000 });
  await page.waitForTimeout(450);
  return page;
}
const cnt   = (page, code) => page.evaluate(c => { const d = window.__store['sessions/sr/counts/' + c]; return d ? d.qty : null; }, code);
const ents  = (page, code) => page.evaluate(c => { const d = window.__store['sessions/sr/counts/' + c]; return d && d.entries ? d.entries.length : null; }, code);
// ط-١٤: التتابع المتّصل صار سطرًا واحدًا يحمل n = عدد مسحاته. مجموع المسحات = Σn (وغياب n = ١).
const scans = (page, code) => page.evaluate(c => { const d = window.__store['sessions/sr/counts/' + c]; return d && d.entries ? d.entries.reduce((t, e) => t + (e && e.n > 1 ? e.n : 1), 0) : null; }, code);
const panel = (page) => page.evaluate(() => window.__scanPanel());
const focus = (page) => page.evaluate(() => window.__focusId());

// ماسح سلكي: حرف حرف بإيقاع ثابت في الحقل المطلوب
async function hw(page, code, opt) {
  opt = opt || {};
  await page.evaluate(async ([code, cadence, enter, sel]) => {
    const s = document.getElementById(sel); if (!s) return;
    s.focus();
    for (const ch of code) {
      s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      s.value = s.value + ch;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      if (cadence) await new Promise(r => setTimeout(r, cadence));
    }
    if (enter) s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  }, [code, opt.cadence == null ? 12 : opt.cadence, !!opt.enter, opt.sel || 'csearch']);
}
// نفس المحاكاة لكن داخل خانة «أضف» في صفٍّ بعينه (مسحة تسقط سهوًا في الحقل الخطأ)
async function hwPadd(page, rowCode, code, cadence) {
  return page.evaluate(async ([rowCode, code, cadence]) => {
    let el = null; document.querySelectorAll('#clist .padd').forEach(p => { if (p.getAttribute('data-code') === rowCode) el = p; });
    if (!el) return false; el.focus();
    for (const ch of code) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      el.value = el.value + ch;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (cadence) await new Promise(r => setTimeout(r, cadence));
    }
    return true;
  }, [rowCode, code, cadence || 12]);
}
async function settle(page, extra) {
  await page.waitForTimeout(180);                                   // زمن سكون التفريغ SCAN_IDLE_MS + هامش
  try { await page.waitForFunction(() => window.__scanIdle(), { timeout: 8000 }); } catch (e) {}
  await page.waitForTimeout(extra == null ? 140 : extra);
}

// ═════════ س١ — مسحة كاملة: بلا Enter، بلا نقر، بلا تأخير ═════════
{
  const page = await open();
  ok('س١ ثوابت المحرّك مطابقة للمعتمَد (سقف ١٠٠ / بلا نافذة منع ازدواج)',
    await page.evaluate(() => { const c = window.__scanConsts(); return c.cap === 100 && c.dedup === 0 && c.cadence === 40 && c.idle === 60 && c.minLen === 4; }));
  ok('س١ فهرس البحث بزمن ثابت مبنيّ لكل الأصناف',
    await page.evaluate(n => { const s = window.__scanIndexStats(); return s.C === n && s.D >= n; }, N));

  await hw(page, bc(3));                                            // باركود موجود، بلا Enter إطلاقًا
  await settle(page);
  ok('س١ مسحة واحدة بلا Enter سجّلت كمية ١', await cnt(page, cd(3)) === 1, 'qty=' + await cnt(page, cd(3)));
  ok('س١ إضافة واحدة بالضبط (لا ازدواج)', await ents(page, cd(3)) === 1, 'entries=' + await ents(page, cd(3)));
  ok('س١ الحقل يُفرَّغ تلقائيًّا بعد المسحة', (await page.inputValue('#csearch')) === '');
  ok('س١ التركيز يعود لحقل المسح تلقائيًّا', await focus(page) === 'csearch', 'focus=' + await focus(page));

  const p = await panel(page);
  ok('س١ لوحة النتيجة ظاهرة بحالة نجاح', p && p.visible && /\bok\b/.test(p.cls), 'cls=' + (p && p.cls));
  ok('س١ الحقل ١: اسم الصنف في العنوان', p && p.head.indexOf('صنف رقم 3') >= 0, 'head=' + (p && p.head));
  ok('س١ الحقل ٢: الباركود', p && p.cells['الباركود'] === bc(3), 'v=' + (p && p.cells['الباركود']));
  ok('س١ الحقل ٣: الكمية الحالية = 0', p && p.cells['الكمية الحالية'] === '0', 'v=' + (p && p.cells['الكمية الحالية']));
  ok('س١ الحقل ٤: الكمية المضافة = +1', p && p.cells['الكمية المضافة'] === '+1', 'v=' + (p && p.cells['الكمية المضافة']));
  ok('س١ الحقل ٥: الإجمالي بعد التحديث = 1', p && p.cells['الإجمالي بعد التحديث'] === '1', 'v=' + (p && p.cells['الإجمالي بعد التحديث']));
  ok('س١ الحقل ٦: مؤشّر نجاح ✅ + «تمّ العدّ»', p && p.head.indexOf('✅') >= 0 && p.cells['الحالة'].indexOf('تمّ العدّ') >= 0, 'v=' + (p && p.cells['الحالة']));
  ok('س١ الحقول الستة كاملة في اللوحة', p && p.cellCount === 5 && p.head.length > 1, 'cells=' + (p && p.cellCount));
  ok('س١ الطابور فارغ والمحرّك جاهز للمسحة التالية', await page.evaluate(() => window.__scanIdle() && window.__scanQueueLen() === 0));
  ok('س١ صفّ الصنف يعرض الإجمالي المحدَّث فورًا',
    await page.evaluate(c => { const cl = document.getElementById('clist'); for (const r of cl.children) if (r.getAttribute && r.getAttribute('data-row') === c) return r.textContent.indexOf('الإجمالي: 1') >= 0; return false; }, cd(3)));
  await page.close();
}

// ═════════ س٢ — تكرار الصنف نفسه: ١ ← ٢ ← ٣ بلا حوارات ولا تباطؤ ═════════
{
  const page = await open();
  const t0 = Date.now();
  for (let k = 1; k <= 3; k++) {
    await hw(page, cd(8));
    await settle(page);
    ok('س٢ المسحة ' + k + ' ⇒ الكمية ' + k, await cnt(page, cd(8)) === k, 'qty=' + await cnt(page, cd(8)));
    await page.waitForTimeout(240);                                 // فاصل واقعي بين مسحتين
  }
  ok('س٢ ط-١٤: التتابع المتّصل سطرٌ واحدٌ لا ثلاثة (إعادة تصميم السجلّ — المرحلة ٤)', await ents(page, cd(8)) === 1, 'entries=' + await ents(page, cd(8)));
  ok('س٢ ومجموع مسحاته ثلاثٌ بالضبط (لا فقدان ولا ازدواج)', await scans(page, cd(8)) === 3, 'scans=' + await scans(page, cd(8)));
  ok('س٢ لا حوار تأكيد ظهر إطلاقًا', await page.evaluate(() => { const o = document.getElementById('cfOverlay'); return !o || getComputedStyle(o).display === 'none'; }));
  ok('س٢ اللوحة تعرض ٢ ← ٣ بعد آخر مسحة', await page.evaluate(() => { const p = window.__scanPanel(); return p.cells['الكمية الحالية'] === '2' && p.cells['الإجمالي بعد التحديث'] === '3'; }));
  ok('س٢ الزمن الكلّي لثلاث مسحات معقول (< ٤ ثوانٍ)', (Date.now() - t0) < 4000, 'ms=' + (Date.now() - t0));
  await page.close();
}

// ═════════ س٣ — باركود مجهول: تحذير بارز فوري بلا تجميد ═════════
{
  const page = await open();
  await hw(page, '9990001112223');
  await settle(page);
  const p = await panel(page);
  ok('س٣ لوحة تحذير ظاهرة بحالة خطأ', p && p.visible && /\berr\b/.test(p.cls), 'cls=' + (p && p.cls));
  ok('س٣ نصّ التحذير المطلوب حرفيًّا', p && p.text.indexOf('هذا الباركود غير موجود في جلسة الجرد الحالية') >= 0);
  ok('س٣ الباركود المجهول معروض في اللوحة', p && p.cells['الباركود'] === '9990001112223', 'v=' + (p && p.cells['الباركود']));
  ok('س٣ لا مؤشّر نجاح كاذب', p && p.head.indexOf('✅') < 0 && p.head.indexOf('باركود غير معروف') >= 0, 'head=' + (p && p.head));
  ok('س٣ لم تُنشأ أي عدّة للكود المجهول', await page.evaluate(() => Object.keys(window.__store).filter(k => k.indexOf('sessions/sr/counts/') === 0).length) === 0);
  ok('س٣ الكود محفوظ للتعبئة في «صنف يدوي»', await page.evaluate(() => window.__lastUnknownScan()) === '9990001112223');
  ok('س٣ الواجهة غير مجمّدة: المحرّك خامل فورًا', await page.evaluate(() => window.__scanIdle()));
  ok('س٣ التركيز باقٍ على حقل المسح', await focus(page) === 'csearch', 'focus=' + await focus(page));
  // المسحة التالية تعمل مباشرةً بلا أي تدخّل
  await hw(page, bc(11));
  await settle(page);
  ok('س٣ المسحة التالية بعد المجهول نجحت فورًا', await cnt(page, cd(11)) === 1, 'qty=' + await cnt(page, cd(11)));
  await page.close();
}

// ═════════ س٤ — الصنف المُضاف حديثًا يُتعرَّف عليه فورًا ═════════
{
  const page = await open();
  await hw(page, '5559990001112');                                  // مجهول أولًا
  await settle(page);
  ok('س٤ الكود مجهول قبل الإضافة', await page.evaluate(() => window.__lastUnknownScan()) === '5559990001112');
  await page.evaluate(() => window.__addExtraItem({ code: '555999', barcode: '5559990001112', name: 'صنف مُضاف يدويًّا', category: 'ك', cost: 2 }));
  await page.waitForTimeout(200);
  ok('س٤ الفهرس أُبطل وأُعيد بناؤه فورًا', await page.evaluate(n => window.__scanIndexStats().C === n + 1, N), 'C=' + await page.evaluate(() => window.__scanIndexStats().C));
  await hw(page, '5559990001112');
  await settle(page);
  ok('س٤ مسحه بعد الإضافة مباشرةً سجّلت ١', await cnt(page, '555999') === 1, 'qty=' + await cnt(page, '555999'));
  ok('س٤ اللوحة تعرض اسم الصنف المُضاف', await page.evaluate(() => window.__scanPanel().head.indexOf('صنف مُضاف يدويًّا') >= 0));
  await page.close();
}

// ═════════ س٥ — رشقة سريعة: لا مسحة تضيع ولا مسحة تتضاعف ═════════
{
  const page = await open();
  // (أ) عشرون كودًا مختلفًا عبر الحقل بإيقاع ماسح حقيقي
  const codes = []; for (let i = 1; i <= 20; i++) codes.push(bc(i));
  const wall = await page.evaluate(async (codes) => {
    const s = document.getElementById('csearch'); const t0 = performance.now();
    for (const code of codes) {
      s.focus();
      for (const ch of code) {
        s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
        s.value = s.value + ch;
        s.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 10));
      }
      await new Promise(r => setTimeout(r, 90));                    // فاصل بين مسحتين — أسرع من أي ماسح فعلي
    }
    return Math.round(performance.now() - t0);
  }, codes);
  await settle(page, 400);
  const got = await page.evaluate(() => { const o = {}; for (const k in window.__store) if (k.indexOf('sessions/sr/counts/') === 0) { const d = window.__store[k]; o[d.code] = [d.qty, (d.entries || []).length]; } return o; });
  const keys = Object.keys(got);
  ok('س٥أ عشرون مسحة ⇒ عشرون صنفًا معدودًا (لا فقدان)', keys.length === 20, 'n=' + keys.length + ' wall=' + wall + 'ms');
  ok('س٥أ كل صنف كميته ١ بالضبط (لا ازدواج)', keys.every(k => got[k][0] === 1 && got[k][1] === 1), JSON.stringify(got).slice(0, 220));
  ok('س٥أ لا مسحة عالقة في الطابور', await page.evaluate(() => window.__scanQueueLen() === 0 && !window.__scanBusy()));

  // (ب) ضغط أقصى: عشرون مسحة تُدفع في نبضة واحدة (أسوأ حالة نظريًّا)
  await page.waitForTimeout(200);
  const qlen = await page.evaluate((codes) => { codes.forEach(c => window.__scanCommit(c, 'stress')); return window.__scanQueueLen(); }, codes);
  ok('س٥ب الطابور استوعب الدفعة كاملةً', qlen >= 10, 'queue=' + qlen);
  await settle(page, 500);
  const got2 = await page.evaluate(() => { const o = {}; for (const k in window.__store) if (k.indexOf('sessions/sr/counts/') === 0) { const d = window.__store[k]; o[d.code] = [d.qty, (d.entries || []).length]; } return o; });
  const k2 = Object.keys(got2);
  ok('س٥ب كل صنف صار ٢ بالضبط بعد الدفعة الثانية', k2.length === 20 && k2.every(k => got2[k][0] === 2 && got2[k][1] === 2), 'n=' + k2.length + ' ' + JSON.stringify(got2).slice(0, 200));
  ok('س٥ب المحرّك عاد جاهزًا والتركيز في حقل المسح', await page.evaluate(() => window.__scanIdle()) && await focus(page) === 'csearch');
  await page.close();
}

// ═════════ س٦ — م٦-٥: العدّ المتتابع لنفس الصنف بلا أي فاصل ولا تأكيد ═════════
{
  const page = await open();

  // ٤ مسحات متتالية بفاصل ٩٠ مللي — أطول من سكون التفريغ (٦٠) وأقصر من النافذة المُزالة (١٢٠)
  for (let k = 1; k <= 4; k++) {
    await hw(page, bc(20), { cadence: 8 });
    await page.waitForTimeout(90);
    ok('س٦ المسحة ' + k + ' لنفس الباركود ⇒ الكمية ' + k, await cnt(page, cd(20)) === k, 'qty=' + await cnt(page, cd(20)));
  }
  await settle(page);
  ok('س٦ ط-١٤: التتابع المتّصل سطرٌ واحدٌ لا أربعة (إعادة تصميم السجلّ — المرحلة ٤)', await ents(page, cd(20)) === 1, 'entries=' + await ents(page, cd(20)));
  ok('س٦ ومجموع مسحاته أربعٌ بالضبط (لا فقدان ولا ازدواج)', await scans(page, cd(20)) === 4, 'scans=' + await scans(page, cd(20)));
  const p6 = await panel(page);
  ok('س٦ اللوحة تعرض ٣ ← +1 ← ٤', p6 && p6.cells['الكمية الحالية'] === '3' && p6.cells['الكمية المضافة'] === '+1' && p6.cells['الإجمالي بعد التحديث'] === '4',
    JSON.stringify(p6 && p6.cells));
  ok('س٦ لا حوار تأكيد ولا انتظار', await page.evaluate(() => { const o = document.getElementById('cfOverlay'); return !o || getComputedStyle(o).display === 'none'; }));

  // مسحات بلاحقة Enter وفاصل ٤٠ مللي فقط — كانت النافذة القديمة تبتلع الثانية والثالثة صمتًا
  for (let k = 1; k <= 3; k++) { await hw(page, bc(21), { cadence: 6, enter: true }); await page.waitForTimeout(40); }
  await settle(page);
  ok('س٦ ثلاث مسحات سريعة بـEnter (فاصل ٤٠م) ⇒ الكمية ٣', await cnt(page, cd(21)) === 3, 'qty=' + await cnt(page, cd(21)));

  // خمسة نداءات في نبضة واحدة لنفس الكود ⇒ خمس قطع
  await page.evaluate(c => { for (let i = 0; i < 5; i++) window.__scanCommit(c, 'x'); }, bc(22));
  await settle(page);
  ok('س٦ خمسة نداءات في نبضة واحدة ⇒ الكمية ٥', await cnt(page, cd(22)) === 5, 'qty=' + await cnt(page, cd(22)));

  // الازدواج الحقيقي الوحيد الممنوع: حدث DOM نفسه يُعالَج مرّتين
  const ev = await page.evaluate(c => {
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    return [window.__scanCommitEvt(c, e), window.__scanCommitEvt(c, e)];
  }, bc(23));
  await settle(page);
  ok('س٦ حدث الماسح نفسه مرّتين ⇒ الثاني مُهمَل', ev[0] === true && ev[1] === false, JSON.stringify(ev));
  ok('س٦ الكمية ١ للحدث المزدوج', await cnt(page, cd(23)) === 1, 'qty=' + await cnt(page, cd(23)));

  ok('س٦ التركيز عاد لحقل المسح', await focus(page) === 'csearch', 'focus=' + await focus(page));
  ok('س٦ الحقل نظيف جاهز للتالي', (await page.inputValue('#csearch')) === '');
  await page.close();
}

// ═════════ س٧ — م٦-٥: تبديل اللوحة فورًا عند مسح صنف مختلف ═════════
{
  const page = await open();
  await hw(page, bc(25), { cadence: 8 });
  await settle(page);
  const pa = await panel(page);
  ok('س٧ اللوحة تعرض الصنف الأول', pa && pa.head.indexOf('صنف رقم 25') >= 0 && pa.cells['الباركود'] === bc(25), 'head=' + (pa && pa.head));

  await hw(page, bc(26), { cadence: 8 });
  await settle(page);
  const pb = await panel(page);
  ok('س٧ اللوحة انتقلت للصنف الثاني', pb && pb.head.indexOf('صنف رقم 26') >= 0, 'head=' + (pb && pb.head));
  ok('س٧ الباركود المعروض هو الجديد', pb && pb.cells['الباركود'] === bc(26), 'v=' + (pb && pb.cells['الباركود']));
  ok('س٧ لا أثر للصنف السابق في اللوحة', pb && pb.text.indexOf('صنف رقم 25') < 0 && pb.text.indexOf(bc(25)) < 0, 'text=' + (pb && pb.text));
  ok('س٧ أرقام اللوحة تخصّ الصنف الجديد (0 ← +1 ← 1)',
    pb && pb.cells['الكمية الحالية'] === '0' && pb.cells['الإجمالي بعد التحديث'] === '1', JSON.stringify(pb && pb.cells));
  ok('س٧ كمية الصنف الأول لم تتأثّر', await cnt(page, cd(25)) === 1, 'qty=' + await cnt(page, cd(25)));

  // صنف مختلف بعد تكرار: اللوحة لا تحتفظ بإجمالي الصنف السابق
  await hw(page, bc(25), { cadence: 8 }); await page.waitForTimeout(90);
  await hw(page, bc(27), { cadence: 8 }); await settle(page);
  const pc = await panel(page);
  ok('س٧ بعد تكرار ثم صنف جديد: اللوحة للصنف الجديد وحده',
    pc && pc.head.indexOf('صنف رقم 27') >= 0 && pc.cells['الإجمالي بعد التحديث'] === '1' && pc.text.indexOf('صنف رقم 25') < 0,
    'head=' + (pc && pc.head) + ' | after=' + (pc && pc.cells['الإجمالي بعد التحديث']));
  ok('س٧ الصنف المكرَّر بلغ ٢ في المخزن', await cnt(page, cd(25)) === 2, 'qty=' + await cnt(page, cd(25)));
  await page.close();
}

// ═════════ ع — فحوص عدائية ═════════
{
  const page = await open();

  // ع١ — صدى CR+LF: الماسح يرسل Enter مرّتين ⇒ عدّة واحدة
  await hw(page, bc(4), { enter: true, cadence: 8 });
  await page.waitForTimeout(30);
  await page.evaluate(() => document.getElementById('csearch').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await settle(page);
  ok('ع١ صدى CR+LF لا يُسجّل مسحةً مكرّرة', await cnt(page, cd(4)) === 1, 'qty=' + await cnt(page, cd(4)));

  // ع٢ — م٦-٥: نداءان متلاصقان لنفس الكود = مسحتان متعمّدتان ⇒ كلتاهما تُحتسبان (لا نافذة زمنية)
  const two = await page.evaluate(c => { const a = window.__scanCommit(c, 'x'); const b = window.__scanCommit(c, 'x'); return [a, b]; }, bc(5));
  await settle(page);
  ok('ع٢ نداءان متلاصقان: كلاهما مقبول', two[0] === true && two[1] === true, JSON.stringify(two));
  ok('ع٢ الكمية ٢ لا ١ (العدّ المتتابع مضمون)', await cnt(page, cd(5)) === 2, 'qty=' + await cnt(page, cd(5)));

  // ع٣ — نصّ البحث العربي لا يتلف بسبب المسحة
  await page.fill('#csearch', 'صنف');
  await page.waitForTimeout(120);
  await hw(page, bc(6));
  await settle(page);
  ok('ع٣ نصّ البحث العربي مُستعاد بعد المسحة', (await page.inputValue('#csearch')) === 'صنف', 'v=' + await page.inputValue('#csearch'));
  ok('ع٣ المسحة سُجِّلت رغم وجود بحث نصّي', await cnt(page, cd(6)) === 1, 'qty=' + await cnt(page, cd(6)));

  // ع٤ — كتابة بشرية بطيئة تبقى بحثًا ولا تصير مسحة
  await page.fill('#csearch', '');
  await page.waitForTimeout(120);
  await hw(page, '1234', { cadence: 140 });                          // إيقاع بشري (> SCAN_CADENCE_MS)
  await page.waitForTimeout(400);
  ok('ع٤ الكتابة البشرية البطيئة لم تُعدّ مسحة', (await page.inputValue('#csearch')) === '1234', 'v=' + await page.inputValue('#csearch'));
  await page.fill('#csearch', '');
  await page.waitForTimeout(150);

  // ع٥ — رشقة ماسح تسقط سهوًا في خانة «أضف» ⇒ تُحوَّل لمسار المسح ولا تُسجَّل ككمية عملاقة
  await page.evaluate(() => { const c = document.getElementById('csearch'); c.value = ''; c.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  const found = await hwPadd(page, cd(12), bc(14), 10);
  await settle(page, 250);
  ok('ع٥ خانة «أضف» موجودة للاختبار', found === true);
  ok('ع٥ لا كمية عملاقة على صنف الصفّ', await cnt(page, cd(12)) === null, 'qty=' + await cnt(page, cd(12)));
  ok('ع٥ المسحة سُجِّلت على الصنف الصحيح بكمية ١', await cnt(page, cd(14)) === 1, 'qty=' + await cnt(page, cd(14)));
  ok('ع٥ التركيز عاد لحقل المسح بعد التحويل', await focus(page) === 'csearch', 'focus=' + await focus(page));

  // ع٦ — حارس المعرّف في countWriteAdd: إعادة المحاولة بالمعرّف نفسه لا تُضاعف
  await page.evaluate(async () => { await window.__countWriteAdd('sr', 'P0030', 1, 1700000000000, 'EID-TEST-1'); await window.__countWriteAdd('sr', 'P0030', 1, 1700000000000, 'EID-TEST-1'); });
  await page.waitForTimeout(200);
  ok('ع٦ نفس المعرّف مرّتين ⇒ كمية ١ (حارس التكرار)', await cnt(page, 'P0030') === 1, 'qty=' + await cnt(page, 'P0030'));
  ok('ع٦ إضافة واحدة فقط في السجل', await ents(page, 'P0030') === 1, 'entries=' + await ents(page, 'P0030'));

  // ع٧ — الترقيع الموضعي + كبح إعادة الرسم: رشقة عشر مسحات لا تُعيد رسم القائمة إلا مرّةً واحدة بعد فراغ الطابور
  await page.evaluate(() => { window.__full = 0; window.__patch = 0; const mo = new MutationObserver(ms => { for (const m of ms) { if (m.type !== 'childList') continue; if (m.addedNodes.length > 3 || m.removedNodes.length > 3) window.__full++; else if (m.addedNodes.length === 1 && m.removedNodes.length === 1) window.__patch++; } }); mo.observe(document.getElementById('clist'), { childList: true }); });
  await page.evaluate(() => { const codes = []; for (let i = 15; i <= 24; i++) codes.push('6281000' + String(100000 + i)); codes.forEach(c => window.__scanCommit(c, 'burst')); });
  await settle(page, 400);
  const mut = await page.evaluate(() => ({ full: window.__full, patch: window.__patch }));
  ok('ع٧ رشقة ١٠ مسحات ⇒ إعادة رسم كاملة واحدة على الأكثر', mut.full <= 1, 'fullRenders=' + mut.full);
  ok('ع٧ كل مسحة رقّعت صفّها موضعيًّا (بلا إعادة رسم)', mut.patch >= 10, 'patches=' + mut.patch);
  ok('ع٧ العشرة كلّها سُجِّلت بكمية ١', await page.evaluate(() => { for (let i = 15; i <= 24; i++) { const d = window.__store['sessions/sr/counts/P' + String(i).padStart(4, '0')]; if (!d || d.qty !== 1) return false; } return true; }));

  // ع٨ — «وضع الماسح» ما زال يعمل (لا انحدار)
  await page.evaluate(() => { const b = document.getElementById('scanModeBtn'); if (b) b.click(); });
  await page.waitForTimeout(150);
  await page.fill('#csearch', cd(29)); await page.press('#csearch', 'Enter');
  await settle(page);
  ok('ع٨ وضع الماسح يسجّل العدّ كما كان', await cnt(page, cd(29)) === 1, 'qty=' + await cnt(page, cd(29)));
  await page.close();
}

// ═════════ ع٩ — لا «✓» كاذب حين ترفض بوابة الجلسة العدّ ═════════
{
  const page = await open('review');                                 // جلسة قيد المراجعة: العدّ متوقف
  await hw(page, bc(9));
  await settle(page);
  const p = await panel(page);
  ok('ع٩ اللوحة بحالة خطأ لا نجاح', p && /\berr\b/.test(p.cls) && p.head.indexOf('✅') < 0, 'cls=' + (p && p.cls) + ' head=' + (p && p.head));
  ok('ع٩ رسالة «تعذّر العدّ» ظاهرة', p && p.head.indexOf('تعذّر العدّ') >= 0, 'head=' + (p && p.head));
  ok('ع٩ لم تُسجَّل أي كمية', await cnt(page, cd(9)) === null, 'qty=' + await cnt(page, cd(9)));
  ok('ع٩ المحرّك بقي جاهزًا (لا تعليق)', await page.evaluate(() => window.__scanIdle()));
  await page.close();
}

// ═════════ ع١٠ — تعثّر الخيط الرئيسي وسط الباركود لا يبتر الكود (ط-٨) ═════════
{
  const page = await open();
  // ماسح يرسل ١٣ حرفًا بإيقاع ٨ مللي، ويُحجب الخيط الرئيسي ٢٠٠ مللي بعد الحرف الخامس
  const r = await page.evaluate(async ([code]) => {
    const s = document.getElementById('csearch'); s.focus(); s.value = '';
    let i = 0;
    for (const ch of code) {
      s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true }));
      i++;
      if (i === 5) { const t = Date.now(); while (Date.now() - t < 200) { } }   // حجب متزامن كإعادة رسم ثقيلة
      await new Promise(r => setTimeout(r, 8));
    }
    return true;
  }, [bc(11)]);
  await settle(page, 320);
  ok('ع١٠ الكود لم يُبتر: سُجِّل على الصنف الصحيح', await cnt(page, cd(11)) === 1, 'qty=' + await cnt(page, cd(11)) + ' r=' + r);
  ok('ع١٠ إضافة واحدة فقط', await ents(page, cd(11)) === 1, 'entries=' + await ents(page, cd(11)));
  ok('ع١٠ لا كود مبتور مجهول', !(await page.evaluate(() => window.__lastUnknownScan())), 'unk=' + await page.evaluate(() => window.__lastUnknownScan()));
  ok('ع١٠ الحقل نظيف بلا بقايا', await page.evaluate(() => document.getElementById('csearch').value) === '', 'val=' + JSON.stringify(await page.evaluate(() => document.getElementById('csearch').value)));

  // تعثّران متتاليان (فوق السقف) ⇒ يُرفض بلا تسجيل خاطئ على صنف آخر
  const before = await page.evaluate(() => JSON.stringify(Object.keys(window.__store).filter(k => k.indexOf('sessions/sr/counts/') === 0).sort()));
  await page.evaluate(async ([code]) => {
    const s = document.getElementById('csearch'); s.focus(); s.value = '';
    let i = 0;
    for (const ch of code) {
      s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true }));
      i++;
      if (i === 3 || i === 6 || i === 9) { const t = Date.now(); while (Date.now() - t < 120) { } }
      await new Promise(r => setTimeout(r, 8));
    }
  }, [bc(12)]);
  await settle(page, 320);
  const after = await page.evaluate(() => JSON.stringify(Object.keys(window.__store).filter(k => k.indexOf('sessions/sr/counts/') === 0).sort()));
  ok('ع١٠ تعثّر فوق السقف لا يُسجّل على صنف خاطئ', await cnt(page, cd(12)) === null ? before === after : await cnt(page, cd(12)) === 1,
    'qty12=' + await cnt(page, cd(12)) + ' before=' + before + ' after=' + after);
  ok('ع١٠ المحرّك بقي جاهزًا', await page.evaluate(() => window.__scanIdle()));
  await page.close();
}

// ═════════ ع١١ — الكتابة البشرية بأرقام لا تُعدّ مسحة (حارس البرهان) ═════════
{
  const page = await open();
  await hw(page, '6281000100013', { cadence: 150 });                 // إنسان يكتب باركودًا كاملًا ببطء
  await settle(page, 260);
  ok('ع١١ كتابة بشرية بطيئة لا تُسجَّل مسحة', await cnt(page, cd(13)) === null, 'qty=' + await cnt(page, cd(13)));
  ok('ع١١ النصّ بقي في حقل البحث', await page.evaluate(() => document.getElementById('csearch').value) === '6281000100013',
    'val=' + await page.evaluate(() => document.getElementById('csearch').value));
  await page.close();
}

await browser.close();
let pass = 0; for (const r of results) { console.log((r.pass ? '✓' : '✗') + ' ' + r.n + (r.d && !r.pass ? ('  << ' + r.d) : '')); if (r.pass) pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass === results.length ? 'passed' : 'FAILED'}`);
process.exit(pass === results.length ? 0 : 1);
