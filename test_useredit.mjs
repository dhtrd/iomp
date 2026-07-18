import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const FM = { uid:'u_fm', email:'fm@dhtrd.com', name:'fm_dh', role:'مدير', active:true };
const CT = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true };
const USERS=[OWNER,FM,CT];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:960,height:1200} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }
async function usersTab(page){ await page.evaluate(()=>window.__setTab('users')); await page.waitForTimeout(250); }

// E1 — edit button for non-owner, protected chip for owner
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS}); await usersTab(page);
  const fmBtn=await page.evaluate(()=>!!document.querySelector('[data-euser="u_fm"]'));
  const ownerBtn=await page.evaluate(()=>!!document.querySelector('[data-euser="u_owner"]'));
  const ownerProtected=await page.evaluate(()=>window.__contentHtml().includes('🔒 محميّ'));
  ok('E1 زر تعديل لغير المالك', fmBtn);
  ok('E1 لا زر تعديل للمالك (محميّ)', !ownerBtn&&ownerProtected);
  await page.close(); }
// E2 — opening edit shows role/status controls
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS}); await usersTab(page);
  await page.evaluate(()=>{ const b=document.querySelector('[data-euser="u_ct"]'); if(b)b.click(); }); await page.waitForTimeout(300);
  const has=await page.evaluate(()=>window.__has('ue_role')&&window.__has('ue_active')&&window.__has('ueSaveProfile'));
  const roleVal=await page.evaluate(()=>{ const s=document.getElementById('ue_role'); return s?s.value:null; });
  ok('E2 نافذة التعديل تعرض الدور والحالة', has, `role=${roleVal}`);
  ok('E2 الدور الحالي محمّل', roleVal==='عدّاد');
  await page.close(); }
// E3 — save profile changes role + active
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await page.evaluate(()=>window.__editUser('u_ct')); await page.waitForTimeout(300);
  await page.evaluate(()=>{ document.getElementById('ue_role').value='مدير مخزون'; document.getElementById('ue_active').value='0'; document.getElementById('ue_title').value='أمين فرع'; });
  await page.evaluate(()=>window.__click('ueSaveProfile')); await page.waitForTimeout(300);
  const u=await page.evaluate(()=>window.__store['users/u_ct']);
  ok('E3 حُفظ الدور الجديد', u&&u.role==='مدير مخزون', JSON.stringify(u&&u.role));
  ok('E3 حُفظت الحالة (معطّل) والمسمى', u&&u.active===false&&u.title==='أمين فرع', JSON.stringify(u&&{a:u.active,t:u.title}));
  await page.close(); }
// E4 — owner edit is blocked
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await page.evaluate(()=>window.__editUser('u_owner')); await page.waitForTimeout(250);
  const blocked=await page.evaluate(()=>window.__contentHtml().includes('المالك محميّ')&&!window.__has('ue_role'));
  ok('E4 تعديل المالك محجوب', blocked);
  await page.close(); }
// E5 — cannot deactivate yourself
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_fm',email:'fm@dhtrd.com'},profile:FM,users:USERS});
  await page.evaluate(()=>window.__editUser('u_fm')); await page.waitForTimeout(300);
  await page.evaluate(()=>{ document.getElementById('ue_active').value='0'; });
  await page.evaluate(()=>window.__click('ueSaveProfile')); await page.waitForTimeout(250);
  const st=await page.evaluate(()=>{ const e=document.getElementById('ueStatus'); return e?e.textContent:''; });
  const stillActive=await page.evaluate(()=>window.__store['users/u_fm'].active!==false);
  ok('E5 منع تعطيل الحساب لنفسه', st.includes('لا يمكنك تعطيل')&&stillActive, `st="${st}"`);
  await page.close(); }
// E6 — individual permission overrides available with perms.manage
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await page.evaluate(()=>window.__editUser('u_ct')); await page.waitForTimeout(300);
  const hasOverrides=await page.evaluate(()=>window.__has('permUserBox')&&document.querySelectorAll('.ucap').length>0);
  ok('E6 قسم الصلاحيات الفردية متاح (مع إدارة الصلاحيات)', hasOverrides);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
