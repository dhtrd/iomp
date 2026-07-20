// اختبارات إصلاح-٣ (الفروع) — بند ٢: (٢أ) إنشاء/تحرير فرع من الواجهة، (٢ب) استعلام مُفلتَر لمدير الفرع، (٢ج) الفرع المعطّل يمنع الجلسات الجديدة في createSession.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const BM    = { uid:'u_bm', email:'bm@dhtrd.com', name:'مدير الرياض', role:'مدير مخزون', active:true };
const WH_RY='مستودع الرياض', WH_JD='مستودع جدة', WH_DIS='مستودع معطّل';
const BR = [
  {id:'bMine',  name:'فرع الرياض', city:'الرياض', managerUid:'u_bm',    warehouses:[WH_RY],  active:true},
  {id:'bOther', name:'فرع جدة',    city:'جدة',    managerUid:'u_owner', warehouses:[WH_JD],  active:true},
  {id:'bDis',   name:'فرع معطّل',  city:'الدمام', managerUid:'u_owner', warehouses:[WH_DIS], active:false}];
const WHS=[{id:'w1',name:WH_RY},{id:'w2',name:WH_JD},{id:'w3',name:WH_DIS}];
const CFG_C  = { features:{branches:true}, warehouses:WHS };
const CFG_BM = { features:{branches:true}, warehouses:WHS, users:{ 'u_bm':{ 'branch.manage':true, 'report.view.location':true } }, userLocations:{ 'u_bm':[WH_RY] } };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1300} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(150); }

// ===== G1 (٢ب) — مدير الفرع: استعلام مُفلتَر ⇒ يرى فرعه فقط (لا الفروع الأخرى) =====
{ const page=await ctx.newPage(); await load(page,{profile:BM,users:[OWNER,BM],config:CFG_BM,branches:BR});
  const central=await page.evaluate(()=>window.__brxIsCentral());
  await page.evaluate(()=>window.__brxLoad());
  const mine=await page.evaluate(()=>window.__brxBranchModel('bMine'));
  const other=await page.evaluate(()=>window.__brxBranchModel('bOther'));
  const vis=await page.evaluate(()=>window.__brxVisible());
  ok('G1 مدير الفرع ليس مركزيًّا', central===false);
  ok('G1 يرى فرعه (bMine) بالاستعلام المُفلتَر', !!mine && mine.name==='فرع الرياض');
  ok('G1 لا يُحمّل فرع غيره (bOther غير مُحمَّل)', other===null && JSON.stringify(vis)==='["bMine"]', 'vis='+JSON.stringify(vis));
  await page.close(); }

// ===== G2 (٢أ) — المركزي يُنشئ فرعًا من الواجهة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,BM],config:CFG_C,branches:BR});
  await page.evaluate(()=>window.__brxLoad());
  const r=await page.evaluate(()=>window.__brxCreate({name:'فرع مكة',city:'مكة',managerUid:'u_bm',managerName:'مدير الرياض',warehouses:['مستودع الرياض']}));
  const inStore=await page.evaluate(id=>{ const d=window.__store['branches/'+id]; return d?{name:d.name,active:d.active,mgr:d.managerUid,wh:d.warehouses}:null; }, r.id);
  ok('G2 الإنشاء نجح وأعاد معرّفًا', r&&r.ok===true&&!!r.id, JSON.stringify(r));
  ok('G2 الفرع كُتب على الخادم (نشط، بمدير ومستودع)', inStore&&inStore.name==='فرع مكة'&&inStore.active===true&&inStore.mgr==='u_bm'&&JSON.stringify(inStore.wh)==='["مستودع الرياض"]', JSON.stringify(inStore));
  // بلا اسم ⇒ رفض
  const bad=await page.evaluate(()=>window.__brxCreate({name:'   '}));
  ok('G2 بلا اسم ⇒ رفض بخطأ', bad&&!!bad.err);
  await page.close(); }

// ===== G3 (٢أ) — غير المركزي يُمنع من الإنشاء =====
{ const page=await ctx.newPage(); await load(page,{profile:BM,users:[OWNER,BM],config:CFG_BM,branches:BR});
  const r=await page.evaluate(()=>window.__brxCreate({name:'فرع مهرَّب'}));
  ok('G3 مدير الفرع يُمنع من إنشاء فرع (مركزيّ فقط)', r&&!!r.err, JSON.stringify(r));
  await page.close(); }

// ===== G4 (٢أ) — المركزي يحرّر فرعًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,BM],config:CFG_C,branches:BR});
  await page.evaluate(()=>window.__brxLoad());
  const r=await page.evaluate(()=>window.__brxUpdate('bOther',{name:'فرع جدة المحدّث',city:'جدة'}));
  const nm=await page.evaluate(()=>window.__store['branches/bOther'].name);
  ok('G4 التحرير نجح وانعكس على الخادم', r&&r.ok===true&&nm==='فرع جدة المحدّث', 'nm='+nm);
  await page.close(); }

// ===== G5 (٢ج) — حارس الفرع المعطّل: يكشف الموقع التابع لفرع معطّل =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_C,branches:BR});
  const dis=await page.evaluate(w=>window.__locDisabled(w), WH_DIS);
  const act=await page.evaluate(w=>window.__locDisabled(w), WH_RY);
  const none=await page.evaluate(()=>window.__locDisabled('لا مكان'));
  ok('G5 موقع فرع معطّل ⇒ true', dis===true);
  ok('G5 موقع فرع نشط ⇒ false', act===false);
  ok('G5 موقع بلا فرع ⇒ false', none===false);
  await page.close(); }

// ===== G6 (٢ج) — createSession يمنع الجلسة في موقع فرع معطّل، ويسمح في موقع نشط =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:CFG_C,branches:BR});
  await page.evaluate(()=>window.__setTab('sessions')); await page.waitForTimeout(200);
  const before=await page.evaluate(()=>Object.keys(window.__store).filter(k=>/^sessions\/[^/]+$/.test(k)).length);
  // محاولة الإنشاء في موقع فرع معطّل
  await page.evaluate((loc)=>{ if(document.getElementById('s_name'))document.getElementById('s_name').value='جلسة معطّلة'; if(document.getElementById('s_loc'))document.getElementById('s_loc').value=loc; }, WH_DIS);
  await page.evaluate(()=>{ const r=document.getElementById('s_resp'); if(r)r.value='مسؤول الموقع'; }); await page.evaluate(()=>window.__createSession()); await page.waitForTimeout(250);
  const afterDis=await page.evaluate(()=>Object.keys(window.__store).filter(k=>/^sessions\/[^/]+$/.test(k)).length);
  const errTxt=await page.evaluate(()=>{ const s=document.getElementById('sessStatus'); return s?s.textContent:''; });
  ok('G6 لم تُنشأ جلسة في موقع فرع معطّل', afterDis===before, 'before='+before+' after='+afterDis);
  ok('G6 ظهرت رسالة «فرع معطّل»', /معطَّل|معطّل/.test(errTxt), errTxt);
  // الإنشاء في موقع نشط ينجح
  await page.evaluate((loc)=>{ document.getElementById('s_name').value='جلسة سليمة'; document.getElementById('s_loc').value=loc; }, WH_RY);
  await page.evaluate(()=>{ const r=document.getElementById('s_resp'); if(r)r.value='مسؤول الموقع'; }); await page.evaluate(()=>window.__createSession()); await page.waitForTimeout(250);
  const afterAct=await page.evaluate(()=>Object.keys(window.__store).filter(k=>/^sessions\/[^/]+$/.test(k)).length);
  ok('G6 أُنشئت الجلسة في موقع نشط', afterAct===before+1, 'afterAct='+afterAct);
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
