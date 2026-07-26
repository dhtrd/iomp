// قياسُ أثرِ أداء البطاقة الثابتة (م٨) — لا يُعدّل التطبيق. يقارن إعادة البناء الكاملة (تبديل منتج)
// بالتحديث الموضعيّ (إعادة مسح الصنف نفسه)، ويؤكّد صفر قراءات/كتابات Firestore طوال العرض.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid: 'u_owner', email: 'a2@dhtrd.com', name: 'المالك', role: 'مدير', active: true };
const N = 200, cd = (i) => 'P' + String(i).padStart(4, '0'), bc = (i) => '6281000' + String(100000 + i);
const ITEMS = []; for (let i = 1; i <= N; i++) ITEMS.push({ code: cd(i), name: 'صنف ' + i, category: 'ك', book: (i % 9) + 1, cost: (i % 5) + 1, barcode: bc(i) });
const sess = { id: 'sr', name: 'جرد', status: 'open', started: true, assignedCounters: ['u_owner'], location: 'فرع أ', itemCount: N, __chunks: [ITEMS] };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1400 } })).newPage();
await page.goto(HARNESS + '?s=' + encodeURIComponent(b64({ profile: OWNER, users: [OWNER], sessions: [sess] })));
await page.waitForFunction('window.__ready===true', { timeout: 20000 });
await page.evaluate(() => window.__openSession('sr'));
await page.waitForFunction(() => !!document.getElementById('csearch'), { timeout: 20000 });
await page.waitForTimeout(300);

const R = await page.evaluate(() => {
  const sp = window.__spCall;
  // إحماء
  for (let i = 0; i < 100; i++) sp({ state: 'ok', name: 'ص' + i, code: 'C' + i, book: 10, before: 0, add: 1, after: (i % 20) + 1 });
  // إعادة البناء الكاملة: كودٌ جديدٌ كلّ مرّة (تبديل منتج)
  const rb = []; for (let i = 0; i < 2000; i++) { const t = performance.now(); sp({ state: 'ok', name: 'صنف ' + i, code: 'NEW' + i, book: 10, before: 0, add: 1, after: (i % 15) + 1 }); document.getElementById('scanStatus').offsetHeight; rb.push(performance.now() - t); }
  // التحديث الموضعيّ: الكود نفسه (إعادة مسح) — يلمس عقدًا نصّيّة فقط
  sp({ state: 'ok', name: 'ثابت', code: 'SAME', book: 10, before: 0, add: 1, after: 1 });
  const tu = []; for (let i = 0; i < 2000; i++) { const t = performance.now(); sp({ state: 'ok', name: 'ثابت', code: 'SAME', book: 10, before: i, add: 1, after: (i % 15) + 2 }); document.getElementById('scanStatus').offsetHeight; tu.push(performance.now() - t); }
  const stat = (a) => { a.sort((x, y) => x - y); return { p50: Math.round(a[a.length >> 1] * 1000) / 1000, mean: Math.round(a.reduce((s, x) => s + x, 0) / a.length * 1000) / 1000, max: Math.round(a[a.length - 1] * 1000) / 1000 }; };
  return { fullRebuild: stat(rb), targetedUpdate: stat(tu), iterations: 2000 };
});
const keys0 = await page.evaluate(() => Object.keys(window.__store).length);
// عرضٌ متكرّر بلا مسحٍ حقيقيّ: يجب ألّا يكتب مفتاحًا واحدًا
await page.evaluate(() => { for (let i = 0; i < 500; i++) window.__spCall({ state: 'ok', name: 'x', code: 'Z' + (i % 10), book: 5, before: 0, add: 1, after: 1 }); });
R.storeKeysDelta = (await page.evaluate(() => Object.keys(window.__store).length)) - keys0;
R.speedup = Math.round(R.fullRebuild.mean / R.targetedUpdate.mean * 10) / 10;
console.log(JSON.stringify(R, null, 2));
await browser.close();
