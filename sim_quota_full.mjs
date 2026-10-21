// محاكاة جرد كامل متعدّد الأجهزة مع نفاد حصّة Firebase في منتصف الجرد — تُشغَّل يدويًّا قبل كل جردٍ كبير.
// ليست ضمن run_all_tests (تستغرق ~١٥ دقيقة لـ١٠٠٥ أصناف). مخرجاتها: سطر «SIM n/m» ورمز خروج 0 عند النجاح،
// وملف نتائج JSON في sim-results/.
//
// ما تحاكيه: خادمٌ واحد مشترك (Node) يتصرّف كـFirestore — معاملات تفاؤليّة (تعارض ⇒ إعادة محاولة حتى ٥)،
// مستمعون حيّون لكل جهاز، احتساب قراءات/كتابات، ونفاد الحصّة: القراءة وحدها (الحالة الشائعة) أو القراءة والكتابة معًا.
// كل جهاز = سياق متصفّح مستقلّ (تخزينه وطابوره وكاشه منفصلة). يُقارَن الناتج بالحقيقة الأرضيّة (ما عُدّ فعلًا).
//
// السيناريو: العدّ يبدأ طبيعيًّا ← تنفد الحصّة عند EXHAUST_AT من العمليات ← العدّ يستمرّ ← تحديث صفحة جهاز c2
// أثناء النفاد ← محاولة مزامنة تلقائيّة والحصّة ما زالت نافدة ← نهاية العدّ ← تجدّد الحصّة ← مزامنة تلقائيّة ← تحقّق.
//
// التشغيل (من جذر المستودع، بعد npm install):
//   CHROME_EXE=… node sim_quota_full.mjs
// المتغيّرات: ITEMS (1005) · DEVICES (3) · MODE=reads|all · FLAG=on|off (العدّ دون اتصال) · EXHAUST_AT (0.38) · SEED
// حدود موثّقة: المحاكي يرفض فورًا عند النفاد (Firestore الحقيقي يعيد المحاولة ~٨ ث — يغطّيه Q10 في test_quota_exhaust)،
// ويسلّم تحديثات البثّ واحدًا واحدًا (Firestore يجمّعها)، فينتظر اكتمال التسليم قبل التحقّق من الشاشات.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const REPO = process.cwd();
execSync('node build_harness.js', { cwd: REPO, stdio: 'ignore' });
execSync('node sim_build_harness.mjs harness.html sim_harness.html', { cwd: REPO, stdio: 'inherit' });
const SIM = 'file://' + path.join(REPO, 'sim_harness.html');
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const ITEMS = +(process.env.ITEMS || 1005), NDEV = Math.max(1, Math.min(5, +(process.env.DEVICES || 3)));
const MODE = process.env.MODE === 'all' ? 'all' : 'reads', FLAG = (process.env.FLAG || 'on') === 'on';
const EXHAUST_AT = +(process.env.EXHAUST_AT || 0.38), RELOAD_AT = 0.6, TICK_AT = 0.75;
let rs = +(process.env.SEED || 20261020); const rnd = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clone = (o) => o == null ? o : JSON.parse(JSON.stringify(o));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const QERR = { code: 'resource-exhausted', message: 'Quota exceeded.' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ================= الخادم المشترك =================
function deepMerge(t, s) { for (const k in s) { const v = s[k]; if (v && typeof v === 'object' && !Array.isArray(v) && !v.__ts) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; deepMerge(t[k], v); } else t[k] = v; } return t; }
const parent = (p) => p.slice(0, p.lastIndexOf('/'));
class Server {
  constructor() { this.docs = new Map(); this.ver = 0; this.reads = 0; this.writes = 0; this.readLimit = Infinity; this.outR = false; this.outW = false; this.subs = new Map(); this.idSeq = 1; this.chains = new Map(); this.rejected = { r: 0, w: 0 }; }
  seed(obj) { for (const [p, d] of Object.entries(obj)) this.docs.set(p, { d: clone(d), v: ++this.ver }); }
  cur(p) { const x = this.docs.get(p); return x ? { d: clone(x.d), v: x.v } : { d: null, v: 0 }; }
  col(cp) { const pre = cp + '/', out = []; for (const [k, x] of this.docs) if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) out.push({ p: k, d: clone(x.d) }); return out; }
  chargeR(n) { this.reads += n; if (this.reads >= this.readLimit && !this.outR) this.exhaust(); }
  exhaust() { this.outR = true; if (MODE === 'all') this.outW = true;                          // كل المستمعين الحيّين يموتون بالخطأ كما في Firestore
    const byDev = new Map(); for (const s of this.subs.values()) { if (!byDev.has(s.dev)) byDev.set(s.dev, []); byDev.get(s.dev).push(s.id); }
    this.subs.clear(); for (const [dev, ids] of byDev) this.send(dev, () => dev.page.evaluate((ids) => window.__kill(ids), ids));
    log(`⛔ نفدت الحصّة (${MODE === 'all' ? 'القراءة والكتابة' : 'القراءة'}) — قراءات=${this.reads} كتابات=${this.writes}`); }
  reset() { this.reads = 0; this.writes = 0; this.outR = false; this.outW = false; this.readLimit = Infinity; log('🌅 تجدّدت الحصّة'); }
  send(dev, fn) { dev.sent++; const c = (this.chains.get(dev) || Promise.resolve())                  // تسليمٌ مرتّب لكل جهاز، ومهلةٌ تمنع تعليق السلسلة
      .then(() => Promise.race([fn(), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 10000))]))
      .then(() => { dev.ok++; }, (e) => { dev.bad++; dev.lastBad = String(e && e.message || e).slice(0, 160); });
    this.chains.set(dev, c); }
  apply(w) { const x = this.docs.get(w.p);
    if (w.t === 'set') { const d = w.m ? deepMerge(clone(x ? x.d : {}) || {}, w.d) : w.d; this.docs.set(w.p, { d, v: ++this.ver }); }
    else if (w.t === 'update') { if (!x) throw { code: 'not-found', message: 'No document to update: ' + w.p }; const cur = clone(x.d);
      for (const key in w.d) { const val = w.d[key]; if (key.includes('.')) { const parts = key.split('.'); let o = cur; for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; } o[parts[parts.length - 1]] = val; } else cur[key] = val; }
      this.docs.set(w.p, { d: cur, v: ++this.ver }); }
    else if (w.t === 'delete') this.docs.delete(w.p);
    this.writes++; }
  notify(paths) { if (this.outR) return; const per = new Map();
    for (const p of paths) for (const s of this.subs.values()) if ((s.k === 'doc' && s.p === p) || (s.k === 'col' && parent(p) === s.p)) {
      if (!per.has(s.dev)) per.set(s.dev, new Map()); per.get(s.dev).set(p, this.cur(p).d); this.chargeR(1); }
    for (const [dev, m] of per) { const list = [...m].map(([p, d]) => ({ p, d })); this.send(dev, () => dev.page.evaluate((l) => window.__push(l), list)); } }
  handle(dev, op, a) {
    try {
      switch (op) {
        case 'get': if (this.outR) { this.rejected.r++; return { err: QERR }; } this.chargeR(1); return this.cur(a.p);
        case 'list': { if (this.outR) { this.rejected.r++; return { err: QERR }; } const docs = this.col(a.p); this.chargeR(Math.max(1, docs.length)); return { docs }; }
        case 'sub': { if (this.outR) { this.rejected.r++; return { err: QERR }; } this.subs.set(dev.name + ':' + a.id, { dev, k: a.k, p: a.p, id: a.id });
          if (a.k === 'doc') { this.chargeR(1); return this.cur(a.p); } const docs = this.col(a.p); this.chargeR(Math.max(1, docs.length)); return { docs }; }
        case 'unsub': this.subs.delete(dev.name + ':' + a.id); return {};
        case 'set': case 'update': case 'delete': { if (this.outW) { this.rejected.w++; return { err: QERR }; } this.apply({ t: op, p: a.p, d: a.d, m: a.m }); this.notify([a.p]); return { d: this.cur(a.p).d }; }
        case 'add': { if (this.outW) { this.rejected.w++; return { err: QERR }; } const id = 'd' + (this.idSeq++); const p = a.p + '/' + id; this.apply({ t: 'set', p, d: a.d }); this.notify([p]); return { id, path: p, d: this.cur(p).d }; }
        case 'commit': { if (this.outW) { this.rejected.w++; return { err: QERR }; }
          for (const p in a.reads) if (this.cur(p).v !== a.reads[p]) return { conflict: true };
          for (const w of a.writes) this.apply(w); const ps = a.writes.map(w => w.p); this.notify(ps); return { docs: ps.map(p => ({ p, d: this.cur(p).d })) }; }
      }
      return { err: { code: 'internal', message: 'op ' + op } };
    } catch (e) { return { err: { code: e.code || 'internal', message: e.message || String(e) } }; }
  }
}

// ================= بيانات الجرد والحقيقة الأرضيّة =================
const SID = 'inv';
const USERS = [{ uid: 'u_owner', email: 'owner@sim.test', name: 'المالك', role: 'مدير', active: true }];
const NAMES = ['عدّاد ١', 'عدّاد ٢', 'عدّاد ٣', 'عدّاد ٤', 'عدّاد ٥'];
for (let i = 0; i < NDEV; i++) USERS.push({ uid: 'c' + (i + 1), email: `c${i + 1}@sim.test`, name: NAMES[i], role: 'عدّاد', active: true });
const items = []; for (let i = 0; i < ITEMS; i++) items.push({ code: '9991' + String(i).padStart(4, '0'), barcode: '', name: 'صنف ' + (i + 1), category: ['أثاث', 'سجاد', 'إنارة', 'موكيت'][i % 4], unit: 'حبة', book: ri(0, 8), cost: ri(10, 900) });
const server = new Server();
const seed = { 'config/permissions': { features: { offlineCount: FLAG } } }; for (const u of USERS) seed['users/' + u.uid] = u;
seed['sessions/' + SID] = { id: SID, name: 'جرد كامل — محاكاة', status: 'open', started: true, assignedCounters: USERS.filter(u => u.role === 'عدّاد').map(u => u.uid), location: 'فرع', itemCount: items.length };
for (let i = 0; i * 400 < items.length; i++) seed[`sessions/${SID}/snapshot/chunk_${String(i).padStart(4, '0')}`] = { items: items.slice(i * 400, i * 400 + 400) };
server.seed(seed);
const truth = {}; const plans = Array.from({ length: NDEV }, () => []);
for (let i = 0; i < items.length; i++) { const code = items[i].code, d = i % NDEV, k = [0, 1, 1, 1, 2, 2, 3, 4, 5, 6][ri(0, 9)];
  truth[code] = { scan: 0, manual: 0 };
  for (let j = 0; j < k; j++) { plans[d].push({ code, kind: 'scan' }); truth[code].scan++; }
  if (rnd() < 0.12) { const q = ri(1, 12); plans[d].push({ code, kind: 'manual', q }); truth[code].manual += q; }
  if (NDEV > 1 && rnd() < 0.08) { const d2 = (d + 1) % NDEV, k2 = ri(1, 3); plans[d2].splice(ri(0, plans[d2].length), 0, ...Array.from({ length: k2 }, () => ({ code, kind: 'scan' }))); truth[code].scan += k2; } } // صنفٌ يعدّه جهازان (موقعان)
const TOTAL_OPS = plans.reduce((s, p) => s + p.length, 0);
const truthTot = (c) => truth[c].scan + truth[c].manual;
const srvQty = (c) => { const x = server.docs.get(`sessions/${SID}/counts/${c}`); return x ? x.d.qty : 0; };

// ================= الأجهزة =================
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const devices = [];
async function bootPage(dev, cacheSeed, lsDump) {
  const page = await dev.ctx.newPage(); dev.page = page;
  page.on('pageerror', (e) => dev.errors.push(String(e.message || e).slice(0, 160)));
  page.on('dialog', (dg) => { dev.errors.push('dialog: ' + dg.message().slice(0, 120)); dg.dismiss().catch(() => {}); });
  if (cacheSeed || lsDump) await page.addInitScript(([c, d]) => { if (c) window.__cacheSeed = c; try { if (d && !sessionStorage.getItem('__r')) { localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); sessionStorage.setItem('__r', '1'); } } catch (e) {} }, [cacheSeed || null, lsDump || null]);
  await page.goto(SIM + '?s=' + encodeURIComponent(b64({ profile: dev.user, users: USERS })));
  await page.waitForFunction('window.__ready===true', { timeout: 20000 }); await sleep(300);
  await page.evaluate(() => { window.__toastLog = []; new MutationObserver(() => { const h = document.getElementById('toastHost'); const t = h && h.lastElementChild && h.lastElementChild.textContent; if (t && window.__toastLog[window.__toastLog.length - 1] !== t) window.__toastLog.push(t); }).observe(document.body, { childList: true, subtree: true }); });
}
async function openSess(dev) { await dev.page.evaluate((s) => window.__openSession(s), SID); for (let i = 0; i < 100; i++) { if (await dev.page.evaluate(() => window.__has('clist'))) return true; await sleep(100); } return false; }
async function reloadDev(dev) { const old = dev.page;                                            // «تحديث الصفحة»: طابور الجهاز وكاش Firestore الدائم يبقيان
  const [cache, ls, toasts] = await old.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return [window.__store, o, window.__toastLog || []]; });
  dev.prevToasts = dev.prevToasts.concat(toasts); await old.close(); await bootPage(dev, cache, ls); return openSess(dev); }
const idle = async (page) => { for (let i = 0; i < 200; i++) { if (await page.evaluate(() => window.__scanIdle())) break; await sleep(15); } };
const qlen = (dev) => dev.page.evaluate(() => window.__offline.queue().then(q => q.length));

log(`الجرد: ${ITEMS} صنف · ${NDEV} أجهزة · ${TOTAL_OPS} عملية عدّ · النفاد=${MODE === 'all' ? 'قراءة وكتابة' : 'قراءة'} · العدّ دون اتصال=${FLAG ? 'مفعّل' : 'مطفأ'}`);
for (const u of USERS.filter(u => u.role === 'عدّاد')) { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dev = { name: u.uid, user: u, ctx, errors: [], fails: [], prevToasts: [], sent: 0, ok: 0, bad: 0, lat: { normal: [], out: [] } };
  await ctx.exposeBinding('__srvCall', (src, op, a) => server.handle(dev, op, a)); await bootPage(dev); devices.push(dev); }
for (const d of devices) if (!(await openSess(d))) { console.log('✗ تعذّر فتح الجلسة على', d.name); process.exit(3); }

let doneAll = 0, phase = 'normal', reloaded = false, ticked = false; const ms = {}; const T0 = Date.now();
async function runDevice(dev, plan) {
  for (const op of plan) { const frac = doneAll / TOTAL_OPS;
    if (phase === 'normal' && frac >= EXHAUST_AT && !server.outR) { phase = 'out'; server.readLimit = server.reads + 1; ms.exhaustOps = doneAll; }
    if (phase === 'out' && frac >= RELOAD_AT && !reloaded && dev.name === 'c2') { reloaded = true; await idle(dev.page); const before = await qlen(dev);
      log(`🔄 تحديث صفحة الجهاز c2 أثناء النفاد (طابوره=${before})`); const ok = await reloadDev(dev); ms.reload = { ok, before, after: await qlen(dev) }; }
    if (phase === 'out' && frac >= TICK_AT && !ticked) { ticked = true; for (const d of devices) await d.page.evaluate(() => window.__autoTick()).catch(() => {});
      ms.chips = {}; for (const d of devices) ms.chips[d.name] = await d.page.evaluate(() => window.__offChip()).catch(() => 'ERR'); }
    const t = Date.now(), outNow = server.outR;
    if (op.kind === 'scan') { await dev.page.evaluate((c) => window.__scanCommit(c, 'field'), op.code); await idle(dev.page); }
    else { const r = await dev.page.evaluate(([c, q]) => window.__addEntry(c, q), [op.code, op.q]); if (!r || !r.ok) dev.fails.push({ code: op.code, r }); }
    (outNow ? dev.lat.out : dev.lat.normal).push(Date.now() - t); doneAll++;
    if (doneAll % 500 === 0) log(`… ${doneAll}/${TOTAL_OPS} (${phase === 'out' ? 'الحصّة نافدة' : 'طبيعي'})`); }
  await idle(dev.page); }
await Promise.all(devices.map((d, i) => runDevice(d, plans[i])));
await sleep(800);
const qBefore = {}; for (const d of devices) qBefore[d.name] = await qlen(d);
log(`انتهى العدّ في ${((Date.now() - T0) / 1000).toFixed(0)} ث · الطوابير قبل تجدّد الحصّة: ${JSON.stringify(qBefore)}`);

server.reset();                                                                                  // اليوم التالي: المؤقّت التلقائي يدفع الطوابير (نستدعيه كما يفعل كل OFFLINE_RETRY_MS)
const T1 = Date.now(); for (let r = 0; r < 40; r++) { for (const d of devices) await d.page.evaluate(() => window.__autoTick()).catch(() => {}); await sleep(1500);
  const ls = []; for (const d of devices) ls.push(await qlen(d)); if (ls.every(x => x === 0)) break; }
const syncSec = +((Date.now() - T1) / 1000).toFixed(1);
for (const d of devices) await d.page.evaluate(() => window.__autoTick()).catch(() => {});
{ const t0 = Date.now(); while (Date.now() - t0 < 900000 && devices.some(d => d.sent > d.ok + d.bad)) await sleep(500); await sleep(1500); }

// ================= التحقّق =================
const R = []; const ok = (n, c, d = '') => R.push({ n, pass: !!c, d });
const qAfter = {}; for (const d of devices) qAfter[d.name] = await qlen(d);
ok('كل طوابير الأجهزة فرغت بعد تجدّد الحصّة', Object.values(qAfter).every(x => x === 0), JSON.stringify(qAfter));
const srvBad = items.filter(it => srvQty(it.code) !== truthTot(it.code)).map(it => `${it.code}: خادم=${srvQty(it.code)} فعلي=${truthTot(it.code)}`);
ok(`الخادم: كمية كل صنف = ما عُدّ فعلًا (${items.length} صنف)`, srvBad.length === 0, srvBad.slice(0, 6).join(' | '));
const sumTruth = items.reduce((s, it) => s + truthTot(it.code), 0), sumSrv = items.reduce((s, it) => s + srvQty(it.code), 0);
ok('إجمالي الوحدات على الخادم = الإجمالي الفعلي', sumSrv === sumTruth, `خادم=${sumSrv} فعلي=${sumTruth}`);
const dup = []; for (const it of items) { const x = server.docs.get(`sessions/${SID}/counts/${it.code}`); if (!x) continue; const ids = new Set(); for (const e of x.d.entries || []) { if (ids.has(e.id)) dup.push(it.code); ids.add(e.id); } }
ok('لا قيد مكرّر (معرّف الإدخال فريد داخل كل صنف)', dup.length === 0, dup.slice(0, 5).join(','));
ok('كل تحديثات البثّ سُلِّمت للأجهزة', devices.every(d => d.bad === 0), devices.map(d => d.name + ':' + d.bad + ' ' + (d.lastBad || '')).join(' | '));
for (const d of devices) { const disp = await d.page.evaluate((cs) => cs.map(c => window.__qtyOf(c)), items.map(i => i.code));
  const bad = items.filter((it, i) => disp[i] !== truthTot(it.code)).map((it) => it.code);
  ok(`شاشة الجهاز ${d.name} تعرض الكميات الصحيحة لكل الأصناف`, bad.length === 0, bad.slice(0, 6).join(',') + (bad.length > 6 ? ` …(+${bad.length - 6})` : '')); }
{ const rows = await devices[0].page.evaluate(() => window.__varRows()); const bad = rows.filter(r => truth[r.code] && ((r.scanQty || 0) !== truth[r.code].scan || (r.manQty || 0) !== truth[r.code].manual || (r.unkQty || 0) !== 0)).map(r => r.code);
  ok('تقرير الفروقات: فصل «بالقارئ/يدوي» صحيح لكل صنف', bad.length === 0, bad.slice(0, 6).join(',')); }
const manFails = devices.flatMap(d => d.fails); ok('لا إدخال يدوي رُفض أثناء النفاد', manFails.length === 0, JSON.stringify(manFails.slice(0, 3)));
const toasts = []; for (const d of devices) toasts.push([d.name, d.prevToasts.concat(await d.page.evaluate(() => window.__toastLog || []))]);
const saveErr = toasts.flatMap(([n, t]) => t.filter(x => /تعذّر الحفظ|تعذّر تسجيل المسحة/.test(x)).map(x => n + ': ' + x));
ok('لا رسالة «تعذّر الحفظ/تسجيل المسحة» ظهرت لأي عدّاد', saveErr.length === 0, saveErr.slice(0, 3).join(' | '));
if (ms.reload) ok('تحديث الصفحة أثناء النفاد فتح الجلسة من الكاش واحتفظ بالطابور', ms.reload.ok && ms.reload.after === ms.reload.before, JSON.stringify(ms.reload));
const errs = devices.flatMap(d => d.errors.map(e => d.name + ': ' + e)); ok('لا أخطاء JavaScript ولا نوافذ حوار في أي جهاز', errs.length === 0, errs.slice(0, 3).join(' | '));
{ const d = devices[0], code = items[0].code, before = srvQty(code); for (let i = 0; i < 3; i++) { await d.page.evaluate((c) => window.__scanCommit(c, 'field'), code); await idle(d.page); } await sleep(600);
  ok('بعد المزامنة: المسح يُكتب للخادم مباشرةً دون طابور', srvQty(code) === before + 3 && (await qlen(d)) === 0, `قبل=${before} بعد=${srvQty(code)}`); }

const med = (a) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
console.log('\n================ النتيجة ================');
for (const r of R) console.log((r.pass ? '✓ ' : '✗ ') + r.n + (r.pass ? '' : '\n     << ' + r.d));
const pass = R.filter(r => r.pass).length; console.log(`\nSIM ${pass}/${R.length}`);
const stats = { items: ITEMS, devices: NDEV, ops: TOTAL_OPS, mode: MODE, offlineCount: FLAG, exhaustAfterOps: ms.exhaustOps, opsDuringOutage: devices.reduce((s, d) => s + d.lat.out.length, 0),
  medianMs: { normal: med(devices.flatMap(d => d.lat.normal)), outage: med(devices.flatMap(d => d.lat.out)) }, queueBeforeReset: qBefore, syncSeconds: syncSec, totalUnits: sumTruth,
  rejectedServerCalls: server.rejected, chipsDuringOutage: ms.chips, toasts: toasts.map(([n, t]) => [n, [...new Set(t)]]) };
fs.mkdirSync(path.join(REPO, 'sim-results'), { recursive: true });
const out = path.join(REPO, 'sim-results', `sim_${ITEMS}x${NDEV}_${MODE}_${FLAG ? 'on' : 'off'}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
fs.writeFileSync(out, JSON.stringify({ results: R, stats }, null, 1)); console.log('النتائج:', path.relative(REPO, out));
await browser.close(); process.exit(pass === R.length ? 0 : 1);
