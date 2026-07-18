import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const USERS = [OWNER,
  { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true },
  { uid:'u_vw', email:'vw@dhtrd.com', name:'مطّلع ١', role:'مطّلع', active:true },
];
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:960,height:1400} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }
async function settings(page){ await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(250); }
const txt = (page,id)=>page.evaluate(i=>{const e=document.getElementById(i);return e?e.textContent:'';},id);

// R1 add custom role
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await settings(page);
  await page.evaluate(()=>{ document.getElementById('newRoleName').value='مشرف الجرد'; });
  await page.evaluate(()=>window.__click('addRoleBtn')); await page.waitForTimeout(300);
  const cr = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.customRoles?c.customRoles:[]; });
  ok('R1 أُضيف دور مخصّص في المخزن', cr.indexOf('مشرف الجرد')>=0, JSON.stringify(cr));
  ok('R1 ظهر عموداً في المصفوفة', await page.evaluate(()=>!!document.querySelector('.rcap[data-role="مشرف الجرد"]')));
  await page.close(); }
// R2 custom role starts with no perms
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS,config:{customRoles:['مشرف الجرد']}});
  const v = await page.evaluate(()=>window.__roleCapVal('مشرف الجرد','count'));
  ok('R2 الدور المخصّص يبدأ بلا صلاحيات', v===false, `count=${v}`);
  await page.close(); }
// R3 custom role in add-user dropdown
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS,config:{customRoles:['مشرف الجرد']}});
  await page.evaluate(()=>window.__setTab('users')); await page.waitForTimeout(200);
  const has = await page.evaluate(()=>{ const s=document.getElementById('nu_role'); return s?Array.from(s.options).some(o=>o.value==='مشرف الجرد'):false; });
  ok('R3 الدور المخصّص خيار في إضافة مستخدم', has);
  await page.close(); }
// R4 grant a permission to custom role and save
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS,config:{customRoles:['مشرف الجرد']}});
  await settings(page);
  const found = await page.evaluate(()=>{ const c=document.querySelector('.rcap[data-role="مشرف الجرد"][data-cap="count"]'); if(!c)return false; c.checked=true; return true; });
  await page.evaluate(()=>window.__click('savePermRoles')); await page.waitForTimeout(250);
  const v = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.roles&&c.roles['مشرف الجرد']?c.roles['مشرف الجرد'].count:null; });
  ok('R4 مُنح الدور المخصّص «العدّ» وحُفظ', found&&v===true, `found=${found} count=${v}`);
  await page.close(); }
// R5 custom-role user effective perms
{ const page=await ctx.newPage(); await load(page,{ user:{uid:'u_sup',email:'sup@dhtrd.com'}, profile:{uid:'u_sup',email:'sup@dhtrd.com',name:'مشرف',role:'مشرف الجرد',active:true}, users:USERS, config:{customRoles:['مشرف الجرد'],roles:{'مشرف الجرد':{count:true,'report.view':true}}} });
  const r = await page.evaluate(()=>[window.__can('count'),window.__can('report.view'),window.__can('session.approve')]);
  ok('R5 مستخدم بدور مخصّص: يرث صلاحياته المضبوطة', r[0]===true&&r[1]===true&&r[2]===false, JSON.stringify(r));
  await page.close(); }
// R6 add descriptive task
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS});
  await settings(page);
  await page.evaluate(()=>{ document.getElementById('newTaskLabel').value='مسؤول التبريد'; });
  await page.evaluate(()=>window.__click('addTaskBtn')); await page.waitForTimeout(300);
  const tk = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.tasks?c.tasks:[]; });
  ok('R6 أُضيفت مهمة تنظيمية', tk.some(t=>t.label==='مسؤول التبريد'), JSON.stringify(tk));
  await page.close(); }
// R7 assign task to role and save
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS,config:{tasks:[{id:'t1',label:'مسؤول التبريد'}]}});
  await settings(page);
  const found = await page.evaluate(()=>{ const c=document.querySelector('.rtask[data-role="عدّاد"][data-task="t1"]'); if(!c)return false; c.checked=true; return true; });
  await page.evaluate(()=>window.__click('saveRoleTasks')); await page.waitForTimeout(250);
  const rt = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.roleTasks&&c.roleTasks['عدّاد']?c.roleTasks['عدّاد']:[]; });
  ok('R7 أُسندت المهمة للدور وحُفظت', found&&rt.indexOf('t1')>=0, `found=${found} rt=${JSON.stringify(rt)}`);
  await page.close(); }
// R8 role task shows on counter home
{ const page=await ctx.newPage(); await load(page,{ user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:{uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد ١',role:'عدّاد',active:true}, users:USERS, config:{tasks:[{id:'t1',label:'مسؤول التبريد'}],roleTasks:{'عدّاد':['t1']}} });
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('R8 مهمة الدور تظهر في شاشة العدّاد', html.includes('مهامك التنظيمية')&&html.includes('مسؤول التبريد'));
  await page.close(); }
// R9 per-user task assignment save
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:USERS,config:{tasks:[{id:'t1',label:'مسؤول التبريد'}]}});
  await settings(page);
  await page.evaluate(()=>{ const s=document.getElementById('permUser'); s.value='u_ct'; s.onchange(); }); await page.waitForTimeout(150);
  const found = await page.evaluate(()=>{ const c=document.querySelector('.utask[data-id="t1"]'); if(!c)return false; c.checked=true; return true; });
  await page.evaluate(()=>window.__click('saveUserOvr')); await page.waitForTimeout(250);
  const ut = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.userTasks&&c.userTasks['u_ct']?c.userTasks['u_ct']:[]; });
  ok('R9 أُسندت مهمة لفرد وحُفظت', found&&ut.indexOf('t1')>=0, `found=${found} ut=${JSON.stringify(ut)}`);
  await page.close(); }
// R10 individual task shows on that user's home
{ const page=await ctx.newPage(); await load(page,{ user:{uid:'u_ct',email:'ct@dhtrd.com'}, profile:{uid:'u_ct',email:'ct@dhtrd.com',name:'عدّاد ١',role:'عدّاد',active:true}, users:USERS, config:{tasks:[{id:'t2',label:'جرد العُهد'}],userTasks:{'u_ct':['t2']}} });
  const html = await page.evaluate(()=>window.__contentHtml());
  ok('R10 مهمة الفرد تظهر في شاشته', html.includes('جرد العُهد'));
  await page.close(); }
// R11 remove custom role blocked when in use
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:USERS.concat([{uid:'u_sup',email:'sup@dhtrd.com',name:'مشرف',role:'مشرف الجرد',active:true}]),config:{customRoles:['مشرف الجرد']}});
  await settings(page);
  await page.evaluate(()=>{ const b=document.querySelector('.delrole[data-role="مشرف الجرد"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  const status = await txt(page,'roleStatus');
  const still = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.customRoles?c.customRoles.indexOf('مشرف الجرد')>=0:false; });
  ok('R11 مُنع حذف دور مُستخدَم', status.includes('لا يمكن حذف')&&still, `status="${status}"`);
  await page.close(); }
// R12 remove custom role success (not in use) — ر٢: تأكيد عبر حوار م١٢
{ const page=await ctx.newPage();
  await load(page,{profile:OWNER,users:USERS,config:{customRoles:['دور مؤقت']}});
  await settings(page);
  await page.evaluate(()=>{ const b=document.querySelector('.delrole[data-role="دور مؤقت"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  await page.evaluate(()=>document.getElementById('cfGo').click()); await page.waitForTimeout(300);
  const gone = await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.customRoles?c.customRoles.indexOf('دور مؤقت')<0:true; });
  ok('R12 حُذف دور غير مُستخدَم', gone);
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
