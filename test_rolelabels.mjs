import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const USERS = [
  { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true },
  { uid:'u_ct', email:'ct@dhtrd.com', name:'خالد', role:'عدّاد', active:true },
];
const LABELS = { 'عدّاد':'موظف جرد ميداني', 'مطّلع':'مراقب' };
const results = [];
const ok = (name, cond, detail='') => results.push({ name, pass: !!cond, detail });
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1000,height:1300} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
const val = (page,sel) => page.evaluate(s=>{const e=document.querySelector(s);return e?e.value:null;}, sel);
const txt = (page,id) => page.evaluate(i=>{const e=document.getElementById(i);return e?e.textContent:null;}, id);

// RL1 — display uses the label while data-role stays the internal key
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:USERS[0], users:USERS, config:{ roleLabels:LABELS } });
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('RL1 المصفوفة تعرض الاسم الظاهر «موظف جرد ميداني»', html.includes('موظف جرد ميداني'));
  ok('RL1 المفتاح الداخلي ثابت: rcap[data-role="عدّاد"] موجود', await page.evaluate(()=>!!document.querySelector('.rcap[data-role="عدّاد"]')));
  ok('RL1 حقل تحرير الاسم يعرض القيمة الحالية', (await val(page,'.rlabel[data-role="عدّاد"]'))==='موظف جرد ميداني', await val(page,'.rlabel[data-role="عدّاد"]'));
  await page.close();
}
// RL2 — header role chip shows the label for the logged-in user
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:USERS[1], users:USERS, config:{ roleLabels:LABELS }, sessions:[] });
  ok('RL2 ترويسة المستخدم تعرض الاسم الظاهر', (await txt(page,'whoRole'))==='موظف جرد ميداني', await txt(page,'whoRole'));
  await page.close();
}
// RL3 — editing + saving writes the full labels map to config (internal keys unchanged)
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:USERS[0], users:USERS, config:{ roleLabels:LABELS } });
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  await page.evaluate(()=>{ const el=document.querySelector('.rlabel[data-role="مدير"]'); el.value='المدير العام'; });
  await page.evaluate(()=>window.__click('saveRoleLabels')); await page.waitForTimeout(250);
  const stored = await page.evaluate(()=>window.__store['config/permissions'].roleLabels);
  ok('RL3 حُفظ الاسم الجديد للمدير', stored&&stored['مدير']==='المدير العام', JSON.stringify(stored));
  ok('RL3 بقيت بقية الأسماء (عدّاد)', stored&&stored['عدّاد']==='موظف جرد ميداني', JSON.stringify(stored));
  await page.close();
}
// RL4 — a role with no custom label falls back to its key
{
  const page = await ctx.newPage();
  await load(page, { user:{uid:'u_owner',email:'a2@dhtrd.com'}, profile:USERS[0], users:USERS, config:{ roleLabels:{ 'عدّاد':'موظف جرد ميداني' } } });
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  ok('RL4 دور بلا اسم مخصّص يظهر بمفتاحه (مدير)', (await val(page,'.rlabel[data-role="مدير"]'))==='مدير', await val(page,'.rlabel[data-role="مدير"]'));
  await page.close();
}

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.name}${r.pass?'':'  << '+r.detail}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
