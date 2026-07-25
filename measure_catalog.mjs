// قياس ط-١٠: أرقام البحث O(1) وكلفة القراءات — للتقرير لا للاختبار
import { chromium } from 'playwright-core';
import path from 'node:path';
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(HARNESS + '?s=' + encodeURIComponent(b64({ profile: OWNER, users: [OWNER], sessions: [] })));
await page.waitForFunction('window.__ready===true', { timeout: 20000 });

const out = await page.evaluate(() => {
  const mk = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) { const s = String(1000000 + i); a[i] = { barcode: '628' + s, code: 'C' + s, name: 'صنف رقم ' + i, category: 'ق', cost: 1, unit: 'حبة' }; } return a; };
  const probes = (n, k) => { const p = []; const step = Math.max(1, Math.floor(n / k)); for (let i = 0; i < n; i += step) p.push('628' + String(1000000 + i)); return p; };
  const rows = [];
  for (const n of [1000, 5000, 10000, 20000, 50000]) {
    const items = mk(n);
    const t0 = performance.now(); window.__cat.seed(items); window.__cat.find(items[0].barcode); const build = performance.now() - t0;
    const per = window.__cat.bench(probes(n, 200), 500);
    const bytes = new TextEncoder().encode(JSON.stringify(items)).length;
    rows.push({ n, build: +build.toFixed(2), per: +per.toFixed(6), chunks: Math.ceil(n / window.__cat.chunkSize()), mib: +(bytes / 1048576).toFixed(2) });
  }
  return rows;
});

console.log('N\tقطع\tميغابايت\tبناء الفهرس(مللي)\tمطابقة واحدة(مللي)\tمطابقة/ثانية');
for (const r of out) console.log(`${r.n}\t${r.chunks}\t${r.mib}\t${r.build}\t${r.per}\t${Math.round(1 / r.per).toLocaleString('en')}`);
console.log('\nقراءات Firestore لكلّ عدّاد/جلسة: 1 (نسخة غير متغيّرة) — أو 1+قطع (نسخة متغيّرة). البحث: 0 دائمًا.');
await browser.close();
