// اختبارات المحطّة ٦ (تخصيص النظام) — افتراضات مقادة بـ config/permissions.settings.defaults بأثرٍ فوري.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1500} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }

// ===== PZ1 — الافتراضات: فارغة بلا إعداد، وتعكس المحفوظ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const d0=await page.evaluate(()=>window.__sysDefaults());
  ok('PZ1 بلا إعداد ⇒ افتراضات فارغة (سلوك اليوم)', d0 && !d0.landingTab && !d0.autoOpenReport, JSON.stringify(d0));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{defaults:{landingTab:'sessions',autoOpenReport:true}}}});
  const d=await page.evaluate(()=>window.__sysDefaults());
  ok('PZ1 المحفوظ يعكس (لوحة البداية=الجلسات، فتح تلقائي)', d.landingTab==='sessions'&&d.autoOpenReport===true, JSON.stringify(d));
  await page.close(); }

// ===== PZ2 — حفظ التخصيص من الواجهة يُثبِّت settings.defaults =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  const has=await page.evaluate(()=>window.__has('pzLanding')&&window.__has('acSavePersonalize'));
  await page.evaluate(()=>{ document.getElementById('pzLanding').value='reports'; document.getElementById('pzAutoReport').checked=true; });
  await page.evaluate(()=>window.__acSavePersonalize()); await page.waitForTimeout(200);
  const saved=await page.evaluate(()=>window.__store['config/permissions'].settings.defaults);
  ok('PZ2 بطاقة التخصيص ظاهرة والحفظ يُثبِّت', has && saved && saved.landingTab==='reports' && saved.autoOpenReport===true, JSON.stringify(saved));
  await page.close(); }

// ===== PZ3 — الأثر الفوري: فتح التقرير الافتراضي عند دخول شاشة التقارير =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{report:{defaultReport:'abc'},defaults:{autoOpenReport:true}}}});
  await page.evaluate(()=>window.__setTab('reports')); await page.waitForTimeout(300);
  const act=await page.evaluate(()=>window.__repxActive());
  ok('PZ3 فتح تلقائي مفعّل ⇒ يُفتح التقرير الافتراضي (abc) مباشرةً', act==='abc', 'active='+act);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{report:{defaultReport:'abc'}}}}); // بلا فتح تلقائي
  await page.evaluate(()=>window.__setTab('reports')); await page.waitForTimeout(300);
  const act=await page.evaluate(()=>window.__repxActive());
  ok('PZ3 بلا فتح تلقائي ⇒ قائمة التقارير (catalog) — لا انحدار', act==='catalog', 'active='+act);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
