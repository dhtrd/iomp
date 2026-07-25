// م٦-٤: قياس «قبل/بعد» موحّد لمحرّك المسح — لا يعدّل index.html إطلاقًا.
// الاستعمال:  SRC_HTML=index.html.bak-phase64 BA_TAG=before node measure_ba.mjs
//             SRC_HTML=index.html            BA_TAG=after  node measure_ba.mjs
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SRC_HTML || 'index.html';
const TAG = process.env.BA_TAG || 'after';
const OUT = 'harness.' + TAG + '.html';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, SRC_HTML: SRC, OUT_HTML: OUT } });

const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve(OUT);
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

const cd = (i) => 'P' + String(i).padStart(6, '0');
const bc = (i) => '628' + String(1000000 + i);
function mkItems(n) { const a = []; for (let i = 0; i < n; i++) a.push({ code: cd(i), name: 'صنف رقم ' + i, category: 'ك', book: (i % 17) + 1, cost: (i % 9) + 1, barcode: bc(i) }); return a; }
function mkSess(n) { const items = mkItems(n); const chunks = []; for (let i = 0; i < items.length; i += 500) chunks.push(items.slice(i, i + 500)); return [{ id: 'sr', name: 'جرد القياس', status: 'open', started: true, assignedCounters: ['u_owner'], location: 'فرع أ', itemCount: n, __chunks: chunks }]; }

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
async function open(n) {
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 1200 } })).newPage();
  await page.goto(HARNESS + '?s=' + encodeURIComponent(b64({ profile: OWNER, users: [OWNER], sessions: mkSess(n) })));
  await page.waitForFunction('window.__ready===true', { timeout: 25000 });
  await page.evaluate(() => window.__openSession('sr'));
  await page.waitForFunction(() => !!document.getElementById('clist'), { timeout: 25000 });
  await page.waitForTimeout(1200);
  return page;
}

// مراقب: إعادة رسم كاملة (>3 عقد) مقابل ترقيع صف واحد
const OBS = () => {
  window.__full = 0; window.__patch = 0;
  const el = document.getElementById('clist');
  const mo = new MutationObserver((ms) => { for (const m of ms) { if (m.type !== 'childList') continue; const a = m.addedNodes.length, r = m.removedNodes.length; if (a > 3 || r > 3) window.__full++; else if (a || r) window.__patch++; } });
  mo.observe(el, { childList: true, subtree: false });
};

const out = { tag: TAG, src: SRC, node: process.version };

// ────────────────────────────────────────────────────────────────────────────
// ١) تكلفة مطابقة الباركود findByScan — حالة مستقرة وحالة إعادة البناء
// ────────────────────────────────────────────────────────────────────────────
out.lookup = [];
for (const N of [500, 3000, 8000]) {
  const page = await open(500);
  const r = await page.evaluate((n) => {
    const its = []; for (let i = 0; i < n; i++) its.push({ code: 'P' + String(i).padStart(6, '0'), name: 'ص' + i, barcode: '628' + String(1000000 + i) });
    const last = 'P' + String(n - 1).padStart(6, '0'), lastB = '628' + String(1000000 + n - 1);
    const f = (x) => +x.toFixed(4);
    return {
      warmFirst: f(window.__benchScanWarm(its, 'P000000', 400)),
      warmLast: f(window.__benchScanWarm(its, last, 400)),
      warmLastBarcode: f(window.__benchScanWarm(its, lastB, 400)),
      warmNotFound: f(window.__benchScanWarm(its, '999999999999', 400)),
      coldLastBarcode: f(window.__benchScanCold(its, lastB, 20)),
      hasQueue: !!window.__hasScanQueue()
    };
  }, N);
  out.lookup.push(Object.assign({ items: N }, r));
  await page.context().close();
}

// ────────────────────────────────────────────────────────────────────────────
// ٢) تكلفة إعادة رسم قائمة العد الواحدة
// ────────────────────────────────────────────────────────────────────────────
out.render = [];
for (const N of [500, 3000, 8000]) {
  const page = await open(N);
  const r = await page.evaluate(() => {
    const s = document.getElementById('csearch');
    const fire = (v) => { s.value = v; const t0 = performance.now(); s.dispatchEvent(new Event('input', { bubbles: true })); return performance.now() - t0; };
    fire('');
    const empty = [], partial = [];
    // ١١ عيّنة مع إهمال أوّل ٣ (إحماء JIT/ذاكرة) — القياسة المنفردة غير مستقرّة في headless
    for (let k = 0; k < 11; k++) { empty.push(fire('')); partial.push(fire('P0001')); }
    const med = (a) => { a = a.slice(3).sort((x, y) => x - y); return +a[Math.floor(a.length / 2)].toFixed(1); };
    const mn = (a) => +Math.min.apply(null, a.slice(3)).toFixed(1);
    return { renderFullMs: med(empty), renderFilteredMs: med(partial), renderFullMin: mn(empty), renderFilteredMin: mn(partial),
      samples: 8, rowsInDom: document.getElementById('clist').children.length,
      handlersBound: document.getElementById('clist').querySelectorAll('.padd,.paddbtn,.prst,.cnotecb,.cnotetxt,.cnotesave,[data-deli],[data-ndeli]').length };
  });
  out.render.push(Object.assign({ items: N }, r));
  await page.context().close();
}

// ────────────────────────────────────────────────────────────────────────────
// ٣) زمن المسحة الكامل (٣٠٠٠ صنف): من آخر حرف حتى ثبوت الكمية في المخزن
// ────────────────────────────────────────────────────────────────────────────
const page = await open(3000);
await page.evaluate(OBS);

// ملاحظة منهجيّة: القياس بالاستطلاع (polling عبر setTimeout/rAF) يُعطي أرقامًا كاذبة
// في headless_shell (تقييد المؤقّتات المتشعّبة). لذلك نقيس بـ MutationObserver — يعمل
// كمَهَمّة دقيقة (microtask) فور التغيير الفعلي في DOM، فيلتقط لحظة ظهور التأكيد بدقّة.
async function scan(page, code, expectCode, opt) {
  opt = opt || {};
  return page.evaluate(async ([code, expect, cadence, enter, clear, budget]) => {
    const s = document.getElementById('csearch'); s.focus();
    if (clear) s.value = '';
    window.__full = 0; window.__patch = 0;
    const p = 'sessions/sr/counts/' + expect;
    const q0 = (window.__store[p] && window.__store[p].qty) || 0;
    for (const ch of code) {
      s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
      s.value = s.value + ch;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      if (cadence) await new Promise((r) => setTimeout(r, cadence));
    }
    const t0 = performance.now();
    let tFeed = null, tList = null, tOk = null;
    const sp = document.getElementById('scanStatus'), cl = document.getElementById('clist');
    // مؤشّر النجاح المؤكَّد — يعمل على البناءين: «بعد» يضع الصنف ok على العنصر، و«قبل» يكتب نصّ الإجمالي
    const okNow = () => { if (!sp) return false; return (sp.className || '').indexOf('ok') >= 0 || /الإجمالي|تمّ العدّ/.test(sp.textContent || ''); };
    const mo1 = sp ? new MutationObserver(() => { if (tFeed === null) tFeed = performance.now(); if (tOk === null && okNow()) tOk = performance.now(); }) : null;
    if (mo1) mo1.observe(sp, { childList: true, subtree: true, attributes: true, characterData: true });
    const mo2 = new MutationObserver(() => { if (tList === null) tList = performance.now(); });
    mo2.observe(cl, { childList: true, subtree: true, characterData: true });
    if (enter) s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, budget));
    if (mo1) mo1.disconnect(); mo2.disconnect();
    const d = window.__store[p];
    const hit = !!(d && (d.qty || 0) > q0);
    return { feedbackMs: tFeed === null ? null : +(tFeed - t0).toFixed(1),
      okMs: tOk === null ? null : +(tOk - t0).toFixed(1),
      listUpdateMs: tList === null ? null : +(tList - t0).toFixed(1),
      recorded: hit, qty: d ? d.qty : null, entries: d && d.entries ? d.entries.length : null,
      fieldAfter: s.value, focusAfter: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '?',
      fullRenders: window.__full, patches: window.__patch,
      panelVisible: sp ? getComputedStyle(sp).display !== 'none' : false,
      panelCells: sp ? sp.querySelectorAll('.sp-c').length : 0 };
  }, [code, expectCode, opt.cadence == null ? 8 : opt.cadence, !!opt.enter, opt.clear !== false, opt.budget || 900]);
}

out.scanBarcodeEnter = await scan(page, bc(2999), cd(2999), { enter: true });
out.scanCodeEnter = await scan(page, cd(123), cd(123), { enter: true });
out.scanBarcodeNoEnter = await scan(page, bc(2998), cd(2998), { enter: false, budget: 1200 });
out.scanUnknown = await scan(page, '999888777666', 'P999999', { enter: true, budget: 900 });
// تكرار ٨ مرّات لاستخراج الوسيط بدل قياس منفرد
// سلسلة: الوسيط هو الرقم المُعتمَد في التقرير — القياسة المنفردة تتأثّر ببرودة الصفحة وبازدحام الجهاز
async function series(page, from, enter) {
  const rows = [];
  for (let i = from; i < from + 9; i++) { rows.push(await scan(page, bc(i), cd(i), { enter, budget: 900 })); await page.waitForTimeout(280); }
  const cold = rows[0], w = rows.slice(1);                       // أوّل مسحة على صفحة باردة تُعزَل ولا تدخل الوسيط
  const med = (k) => { const a = w.map((r) => r[k]).filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
  const mm = (k, f) => { const a = w.map((r) => r[k]).filter((x) => x != null); return a.length ? f.apply(null, a) : null; };
  return { n: w.length, recorded: w.filter((r) => r.recorded).length, exactlyOne: w.every((r) => r.qty === 1),
    feedbackMed: med('feedbackMs'), okMed: med('okMs'), listMed: med('listUpdateMs'),
    feedbackMin: mm('feedbackMs', Math.min), feedbackMax: mm('feedbackMs', Math.max),
    coldFeedback: cold.feedbackMs, coldOk: cold.okMs, coldList: cold.listUpdateMs,
    samples: w.map((r) => ({ f: r.feedbackMs, o: r.okMs, l: r.listUpdateMs, rec: r.recorded })) };
}
out.scanNoEnterSeries = await series(page, 2960, false);
out.scanEnterSeries = await series(page, 2970, true);

// ────────────────────────────────────────────────────────────────────────────
// ٤) رشقة ١٠ مسحات على الصنف نفسه (تنظيف الحقل يدويًّا = قياس أداء منصف)
// ────────────────────────────────────────────────────────────────────────────
out.burstSame = await page.evaluate(async ([code, enter]) => {
  const s = document.getElementById('csearch'); s.focus();
  window.__full = 0; window.__patch = 0;
  const p = 'sessions/sr/counts/' + code;
  let tLastFeed = null;
  const sp = document.getElementById('scanStatus');
  const mo = sp ? new MutationObserver(() => { tLastFeed = performance.now(); }) : null;
  if (mo) mo.observe(sp, { childList: true, subtree: true, attributes: true, characterData: true });
  const t0 = performance.now(); let tLastKey = 0;
  for (let i = 0; i < 10; i++) {
    s.value = '';
    for (const ch of code) { s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })); s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 6)); }
    tLastKey = performance.now();
    if (enter) s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 200));   // إيقاع ماسح متمهّل (٢٠٠ مللي بين المسحات)
  }
  await new Promise((r) => setTimeout(r, 900));
  if (mo) mo.disconnect();
  const d = window.__store[p];
  return { wallMs: +(performance.now() - t0).toFixed(0), pacedSleepMs: 10 * (200 + 7 * 6),
    tailMs: tLastFeed === null ? null : +(tLastFeed - tLastKey).toFixed(1),
    qty: d ? d.qty : null, entries: d && d.entries ? d.entries.length : null, fullRenders: window.__full, patches: window.__patch };
}, [cd(500), true]);

// ────────────────────────────────────────────────────────────────────────────
// ٤ج) العدّ المتتابع (م٦-٥): الصنف نفسه عشر مرّات بإيقاع أسرع من نافذة الـ١٢٠ مللي القديمة.
//     المطلوب عشرة في كل إيقاع. أي رقم أقلّ = مسحة متعمّدة ابتلعها المحرّك.
// ────────────────────────────────────────────────────────────────────────────
out.countRun = await page.evaluate(async ([pairs, gaps]) => {
  const s = document.getElementById('csearch');
  const sp = document.getElementById('scanStatus');
  const runs = [];
  for (let g = 0; g < gaps.length; g++) {
    const code = pairs[g][0], bar = pairs[g][1], gap = gaps[g];
    s.focus(); s.value = '';
    let tLastFeed = null;
    const mo = sp ? new MutationObserver(() => { tLastFeed = performance.now(); }) : null;
    if (mo) mo.observe(sp, { childList: true, subtree: true, attributes: true, characterData: true });
    const fires = [];
    for (let i = 0; i < 10; i++) {
      for (const ch of bar) { s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })); s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 2)); }
      fires.push(performance.now());
      s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, gap));
    }
    const tLastKey = fires[fires.length - 1];
    await new Promise((r) => setTimeout(r, 1500));
    if (mo) mo.disconnect();
    const iv = []; for (let i = 1; i < fires.length; i++) iv.push(fires[i] - fires[i - 1]);
    iv.sort((a, b) => a - b);
    const d = window.__store['sessions/sr/counts/' + code];
    runs.push({ gapMs: gap, medIntervalMs: +iv[Math.floor(iv.length / 2)].toFixed(1), minIntervalMs: +iv[0].toFixed(1),
      expected: 10, qty: d ? d.qty : 0, entries: d && d.entries ? d.entries.length : 0,
      lost: 10 - (d ? d.qty : 0), tailMs: tLastFeed === null ? null : +(tLastFeed - tLastKey).toFixed(1),
      fieldAfter: s.value, focusAfter: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '?' });
  }
  return { runs, allExact: runs.every((r) => r.qty === 10), totalLost: runs.reduce((a, r) => a + r.lost, 0) };
}, [[[cd(600), bc(600)], [cd(601), bc(601)], [cd(602), bc(602)]], [100, 60, 30]]);

// ٤ج-٢) الحالة الفاصلة: مسحات تصل أسرع ممّا يعالجها التطبيق (زرّ الماسح مضغوط باستمرار).
//        هنا وحدها تظهر نافذة الـ١٢٠ مللي القديمة: تبتلع كل ما وصل داخلها.
out.countRunFast = await page.evaluate(async ([pairs, gaps]) => {
  const runs = [];
  for (let g = 0; g < gaps.length; g++) {
    const code = pairs[g][0], bar = pairs[g][1], gap = gaps[g];
    let accepted = 0;
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) { if (window.__scanCommit(bar, 'bench')) accepted++; if (gap > 0) await new Promise((r) => setTimeout(r, gap)); }
    const spanMs = performance.now() - t0;
    const dl = performance.now() + 15000;
    while (performance.now() < dl) { if (window.__scanIdle()) break; await new Promise((r) => requestAnimationFrame(() => r())); }
    await new Promise((r) => setTimeout(r, 500));
    const d = window.__store['sessions/sr/counts/' + code];
    runs.push({ gapMs: gap, spanMs: +spanMs.toFixed(0), expected: 10, accepted, qty: d ? d.qty : 0,
      entries: d && d.entries ? d.entries.length : 0, lost: 10 - (d ? d.qty : 0) });
  }
  return { runs, allExact: runs.every((r) => r.qty === 10), totalLost: runs.reduce((a, r) => a + r.lost, 0) };
}, [[[cd(620), bc(620)], [cd(621), bc(621)], [cd(622), bc(622)], [cd(623), bc(623)]], [0, 20, 60, 100]]);

// ٤د) الازدواج الحقيقي الوحيد: حدث DOM نفسه يُعالَج مرّتين ⇒ يجب أن يُحتسب مرّة واحدة
out.sameEventGuard = await page.evaluate(async ([code, bar]) => {
  if (typeof window.__scanCommitEvt !== 'function') return { supported: false };
  const r = await (async () => { const e = new KeyboardEvent('keydown', { key: 'Enter' });
    const a = window.__scanCommitEvt(bar, e), b = window.__scanCommitEvt(bar, e); return [a, b]; })();
  await new Promise((r2) => setTimeout(r2, 1400));
  const d = window.__store['sessions/sr/counts/' + code];
  return { supported: true, firstAccepted: r[0] === true, secondRejected: r[1] === false, qty: d ? d.qty : 0, entries: d && d.entries ? d.entries.length : 0 };
}, [cd(610), bc(610)]);

// ٤ب) إنتاجيّة المحرّك الصافية: ٥٠ مسحة تُحقن في نبضة واحدة (نسخة «بعد» فقط)
out.engineThroughput = await page.evaluate(async () => {
  if (typeof window.__scanCommit !== 'function' || !window.__hasScanQueue()) return { supported: false };
  window.__full = 0; window.__patch = 0;
  const codes = []; for (let i = 1500; i < 1550; i++) codes.push('628' + String(1000000 + i));
  const t0 = performance.now();
  let accepted = 0; for (const c of codes) { if (window.__scanCommit(c, 'bench')) accepted++; }
  const injectMs = performance.now() - t0;
  const dl = performance.now() + 15000;
  while (performance.now() < dl) { if (window.__scanIdle()) break; await new Promise((r) => requestAnimationFrame(() => r())); }
  const drainMs = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 400));
  const want = []; for (let i = 1500; i < 1550; i++) want.push('P' + String(i).padStart(6, '0'));
  const qtys = want.map((k) => { const d = window.__store['sessions/sr/counts/' + k]; return d ? d.qty : 0; });
  return { supported: true, accepted, injectMs: +injectMs.toFixed(1), drainMs: +drainMs.toFixed(1),
    perScanMs: +(drainMs / 50).toFixed(2), recorded: qtys.filter((q) => q > 0).length, allExactlyOne: qtys.every((q) => q === 1),
    fullRenders: window.__full, patches: window.__patch };
});

// ────────────────────────────────────────────────────────────────────────────
// ٥) رشقة ٢٠ باركودًا مختلفًا بلا تنظيف يدوي — سلوك الماسح الحقيقي
// ────────────────────────────────────────────────────────────────────────────
out.burstRealistic = await page.evaluate(async ([enter]) => {
  const s = document.getElementById('csearch'); s.focus(); s.value = '';
  window.__full = 0; window.__patch = 0;
  const codes = []; for (let i = 1000; i < 1020; i++) codes.push('628' + String(1000000 + i));
  const t0 = performance.now();
  for (const c of codes) {
    for (const ch of c) { s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })); s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 8)); }
    if (enter) s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 110));
  }
  const want = []; for (let i = 1000; i < 1020; i++) want.push('P' + String(i).padStart(6, '0'));
  await new Promise((r) => setTimeout(r, 1200));
  const qtys = want.map((k) => { const d = window.__store['sessions/sr/counts/' + k]; return d ? d.qty : 0; });
  return { wallMs: +(performance.now() - t0).toFixed(0), recordedItems: qtys.filter((q) => q > 0).length,
    allExactlyOne: qtys.every((q) => q === 1), qtySum: qtys.reduce((a, b) => a + b, 0),
    fullRenders: window.__full, patches: window.__patch, fieldAfter: document.getElementById('csearch').value,
    focusAfter: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '?' };
}, [true]);

// ────────────────────────────────────────────────────────────────────────────
// ٦) صدى CR+LF: هل تُسجَّل مسحة واحدة مرتين؟
// ────────────────────────────────────────────────────────────────────────────
out.echoCRLF = await page.evaluate(async () => {
  const s = document.getElementById('csearch'); s.focus(); s.value = '';
  const code = 'P000777';
  for (const ch of code) { s.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true })); s.value += ch; s.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 6)); }
  s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 25));
  s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 1400));
  const d = window.__store['sessions/sr/counts/P000777'];
  return { qty: d ? d.qty : null, entries: d && d.entries ? d.entries.length : null };
});

await browser.close();
const file = 'bench-' + TAG + '.json';
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log('\n===== قياس (' + TAG + ') من ' + SRC + ' → ' + file + ' =====');
console.log(JSON.stringify(out, null, 2));
