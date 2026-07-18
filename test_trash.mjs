import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const WH = { uid:'u_wh', email:'wh@dhtrd.com', name:'أمين', role:'مدير مخزون', active:true };
const CT = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد', role:'عدّاد', active:true };
const ITEMS=[[{code:'A',name:'صنف',book:5,cost:2}]];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:960,height:1200} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// T1 — new caps in matrix + defaults
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('settings')); await page.waitForTimeout(200);
  const has=await page.evaluate(()=>['warehouse.manage','trash.restore','trash.purge'].every(k=>!!document.querySelector('.rcap[data-cap="'+k+'"]')));
  const whMgr=await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="مدير مخزون"][data-cap="warehouse.manage"]');return c?c.checked:null;});
  const purgeMgr=await page.evaluate(()=>{const c=document.querySelector('.rcap[data-role="مدير مخزون"][data-cap="trash.purge"]');return c?c.checked:null;});
  ok('T1 صلاحيات المستودعات والسلة في المصفوفة', has);
  ok('T1 افتراضي: مدير مخزون يدير المستودعات، لا يحذف نهائياً', whMgr===true&&purgeMgr===false, `wh=${whMgr}/purge=${purgeMgr}`);
  await page.close(); }
// T2 — add warehouse from warehouses tab
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('warehouses')); await page.waitForTimeout(200);
  await page.evaluate(()=>{ document.getElementById('newWhName').value='المستودع الرئيسي'; });
  await page.evaluate(()=>{ document.getElementById('addWhBtn').click(); }); await page.waitForTimeout(300);
  const wh=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return c&&c.warehouses?c.warehouses:[]; });
  ok('T2 أُضيف مستودع في المخزن', wh.some(w=>w.name==='المستودع الرئيسي'&&!w.deleted), JSON.stringify(wh));
  await page.close(); }
// T3 — deleted session appears in trash, restore + purge
{ const page=await ctx.newPage(); page.on('dialog',d=>d.accept().catch(()=>{}));
  await load(page,{profile:OWNER,users:[OWNER],sessions:[
    {id:'sd',name:'محذوفة للاسترجاع',status:'open',started:false,deleted:true,itemCount:1,location:'فرع أ',__chunks:ITEMS},
    {id:'sp',name:'محذوفة للحذف',status:'open',started:false,deleted:true,itemCount:1,__chunks:ITEMS},
  ]});
  await page.evaluate(()=>window.__setTab('trash')); await page.waitForTimeout(350);
  const shows=await page.evaluate(()=>window.__contentHtml().includes('محذوفة للاسترجاع')&&!!document.querySelector('[data-rest="sd"]'));
  ok('T3 السلة تعرض الجلسات المحذوفة', shows);
  await page.evaluate(()=>{ const b=document.querySelector('[data-rest="sd"]'); if(b)b.click(); }); await page.waitForTimeout(300);
  const restored=await page.evaluate(()=>window.__store['sessions/sd'].deleted===false);
  ok('T3 الاسترجاع يعيد الجلسة (deleted=false)', restored);
  await page.evaluate(()=>{ const b=document.querySelector('[data-purge="sp"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  // ر٢: الحذف النهائي فعل حساس — كتابة «اعتماد» في حوار م١٢
  await page.evaluate(()=>{ const i=document.getElementById('cfInput'); i.value='اعتماد'; i.dispatchEvent(new Event('input')); document.getElementById('cfGo').click(); }); await page.waitForTimeout(400);
  const purged=await page.evaluate(()=>!window.__store['sessions/sp']);
  ok('T3 الحذف النهائي يزيل الجلسة تماماً', purged);
  await page.close(); }
// T4 — warehouse trash restore + purge
{ const page=await ctx.newPage(); page.on('dialog',d=>d.accept().catch(()=>{}));
  await load(page,{profile:OWNER,users:[OWNER],config:{warehouses:[{id:'w1',name:'مستودع قديم',deleted:true},{id:'w2',name:'مستودع للحذف',deleted:true}]}});
  await page.evaluate(()=>window.__setTab('trash')); await page.waitForTimeout(300);
  const shows=await page.evaluate(()=>window.__contentHtml().includes('مستودع قديم')&&!!document.querySelector('[data-restwh="w1"]'));
  ok('T4 السلة تعرض المستودعات المحذوفة', shows);
  await page.evaluate(()=>{ const b=document.querySelector('[data-restwh="w1"]'); if(b)b.click(); }); await page.waitForTimeout(300);
  const restored=await page.evaluate(()=>{ const c=window.__store['config/permissions']; const w=c.warehouses.find(x=>x.id==='w1'); return w&&w.deleted===false; });
  ok('T4 استرجاع المستودع', restored);
  await page.evaluate(()=>{ const b=document.querySelector('[data-purgewh="w2"]'); if(b)b.click(); }); await page.waitForTimeout(200);
  // ر٢: حذف المستودع نهائيًّا فعل حساس — كتابة «اعتماد»
  await page.evaluate(()=>{ const i=document.getElementById('cfInput'); i.value='اعتماد'; i.dispatchEvent(new Event('input')); document.getElementById('cfGo').click(); }); await page.waitForTimeout(350);
  const purged=await page.evaluate(()=>{ const c=window.__store['config/permissions']; return !c.warehouses.some(x=>x.id==='w2'); });
  ok('T4 الحذف النهائي للمستودع', purged);
  await page.close(); }
// T5 — tab visibility by permission
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_wh',email:'wh@dhtrd.com'},profile:WH,users:[OWNER,WH]});
  const nav=await page.evaluate(()=>window.__nav().html);
  ok('T5 مدير مخزون يرى تبويبَي المستودعات والسلة', nav.includes('data-tab="warehouses"')&&nav.includes('data-tab="trash"'), nav);
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_ct',email:'ct@dhtrd.com'},profile:CT,users:[OWNER,CT]});
  const nav=await page.evaluate(()=>window.__nav());
  ok('T5 العدّاد لا يرى المستودعات ولا السلة', nav.display==='none'||(!nav.html.includes('warehouses')&&!nav.html.includes('trash')), JSON.stringify(nav));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
