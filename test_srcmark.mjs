// تمييز ما يُضاف يدويًّا عمّا يُضاف بقارئ الباركود (طلب العميل) — في شاشة العدّ وفي التقارير والتصدير.
// القارئ: ماسح خارجي (إيقاع ≤٤٠ مللي) أو كاميرا أو حقل الكمية بالماسح ⇒ src:'scan'.
// اليدوي: كمية مكتوبة في «أضف»، أو كود مكتوب باليد ثم Enter ⇒ src:'manual'.
// البيانات القديمة (قبل التمييز): التتابع المدموج (×n) قارئٌ حتمًا، والمفرد ⇒ «غير مصنّف» — لا اختلاق.
// لا تغيير في أي حساب قائم: الكمية/الفرق/الحالة/القيم كما هي؛ الأعمدة الجديدة مُلحقة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const ITEMS=[{code:'A1001',barcode:'A1001',name:'صنف أ',category:'ك',book:5,cost:2},{code:'B2002',barcode:'B2002',name:'صنف ب',category:'ك',book:3,cost:1}];
const S=(extra)=>[Object.assign({ id:'sr', name:'جرد', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2, __chunks:[ITEMS] },extra||{})];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1300} });
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(250); }
const openSr=async(page)=>{ await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(450); };
const idle=async(page)=>{ for(let i=0;i<80;i++){ if(await page.evaluate(()=>window.__scanIdle()))break; await sleep(40); } await sleep(200); };
const ents=(page,c)=>page.evaluate(x=>window.__cntEntries(x),c);
const srvEnts=(page,c)=>page.evaluate(x=>{ const d=window.__store['sessions/sr/counts/'+x]; return d?(d.entries||[]).map(e=>({q:e.q,src:e.src||'',n:e.n||1})):null; },c);
async function scannerType(page,code){ await page.click('#csearch'); await page.keyboard.type(code,{delay:6}); await sleep(160); await idle(page); }
async function handType(page,code){ await page.click('#csearch'); await page.keyboard.type(code,{delay:160}); await page.keyboard.press('Enter'); await idle(page); }
async function paddType(page,code,qty){ const sel='.padd[data-code="'+code+'"]'; await page.click(sel); await page.keyboard.type(String(qty),{delay:150}); await page.keyboard.press('Enter'); await sleep(350); }

// ===== M1 — التصنيف من الواجهة الحقيقيّة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:S()}); await openSr(page);
  await scannerType(page,'A1001');
  let e=await ents(page,'A1001');
  ok('M1 ماسح خارجي (إيقاع سريع) ⇒ «قارئ»', e.length===1&&e[0].src==='scan'&&e[0].q===1, JSON.stringify(e));
  await scannerType(page,'A1001'); await scannerType(page,'A1001');
  e=await ents(page,'A1001');
  ok('M1 مسحات متتابعة تندمج سطرًا واحدًا ×٣ وتبقى «قارئ»', e.length===1&&e[0].n===3&&e[0].q===3&&e[0].src==='scan', JSON.stringify(e));
  await handType(page,'A1001');
  e=await ents(page,'A1001');
  ok('M1 كود مكتوب باليد + Enter ⇒ سطر «يدوي» مستقلّ (لا يندمج في تتابع القارئ)', e.length===2&&e[1].src==='manual'&&e[1].q===1&&e[0].q===3, JSON.stringify(e));
  await paddType(page,'B2002',5);
  e=await ents(page,'B2002');
  ok('M1 كمية مكتوبة في «أضف» ⇒ «يدوي»', e.length===1&&e[0].src==='manual'&&e[0].q===5, JSON.stringify(e));
  await page.evaluate(()=>window.__scanCommit('B2002','cam')); await idle(page);
  e=await ents(page,'B2002');
  ok('M1 الكاميرا ⇒ «قارئ»', e.length===2&&e[1].src==='scan', JSON.stringify(e));
  const sa=await srvEnts(page,'A1001'), sb=await srvEnts(page,'B2002');
  ok('M1 المصدر محفوظ في الخادم مع كل سطر', sa&&sa.map(x=>x.src).join()==='scan,manual'&&sb&&sb.map(x=>x.src).join()==='manual,scan', JSON.stringify({sa,sb}));
  // M2 — الشاشة
  const row=await page.evaluate(()=>{ const r=document.querySelector('[data-row="A1001"]'); return r?r.textContent:''; });
  ok('M2 شاشة العدّ: سطر الإضافات يذكر «بالقارئ ٣ · يدوي ١»', /بالقارئ\s*3\s*·\s*يدوي\s*1/.test(row), row.slice(0,160));
  ok('M2 شاشة العدّ: شارة «✍ يدوي» على الإضافة اليدويّة', row.includes('✍ يدوي'), '');
  // M3 — الكميات للتقرير (لا تغيير على المعدود)
  const vr=await page.evaluate(()=>window.__varRows());
  const a=vr.find(r=>r.code==='A1001'), b=vr.find(r=>r.code==='B2002');
  ok('M3 الفروقات: المعدود كما هو والتقسيم صحيح (أ: ٤ = ٣ قارئ + ١ يدوي؛ ب: ٦ = ١ + ٥)', a.counted===4&&a.scanQty===3&&a.manQty===1&&a.unkQty===0&&b.counted===6&&b.scanQty===1&&b.manQty===5, JSON.stringify(vr));
  await page.close(); }

// ===== M1b — لوحة مفاتيح الجوّال (keydown «Unidentified») واللصق =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:S()}); await openSr(page);
  const typeVirtual=async(code,gap,kind)=>{ await page.evaluate(()=>document.getElementById('csearch').focus());
    if(kind==='paste'){ await page.evaluate(c=>{ const s=document.getElementById('csearch'); s.value=c; s.dispatchEvent(new InputEvent('input',{inputType:'insertFromPaste',data:c,bubbles:true})); },code); }
    else for(const ch of code){ await page.evaluate(ch=>{ const s=document.getElementById('csearch'); s.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',bubbles:true})); s.value+=ch; s.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:ch,bubbles:true})); },ch); await sleep(gap); }
    await page.evaluate(()=>{ const s=document.getElementById('csearch'); s.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); }); await idle(page); };
  await typeVirtual('A1001',160,'type');
  let e=await ents(page,'A1001');
  ok('M1b كتابة الكود بلوحة الجوّال (keydown «Unidentified») ⇒ «يدوي»', e.length===1&&e[0].src==='manual', JSON.stringify(e));
  await typeVirtual('B2002',0,'paste');
  e=await ents(page,'B2002');
  ok('M1b حقن الكود دفعةً واحدة (لصق/تطبيق ماسح) ⇒ «قارئ»', e.length===1&&e[0].src==='scan', JSON.stringify(e));
  await page.close(); }

// ===== M4 — دون اتصال: المصدر يُحفظ في الطابور ويصل الخادم بعد المزامنة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{features:{offlineCount:true}},sessions:S()}); await openSr(page);
  await page.evaluate(()=>window.__offline.setOnlineNoFlush(false)); await sleep(80);
  await scannerType(page,'A1001'); await paddType(page,'A1001',2);
  const q=await page.evaluate(()=>window.__offline.queue());
  ok('M4 الطابور يحمل المصدر (قارئ ثم يدوي)', q.length===2&&q[0].src==='scan'&&q[1].src==='manual', JSON.stringify(q.map(x=>x.src)));
  const e=await ents(page,'A1001');
  ok('M4 العرض التفاؤليّ يميّز أيضًا', e.map(x=>x.src).join()==='scan,manual', JSON.stringify(e));
  await page.evaluate(()=>window.__offline.setOnline(true)); await sleep(700);
  const s=await srvEnts(page,'A1001');
  ok('M4 بعد المزامنة: الخادم يحمل المصدر لكل سطر', s&&s.map(x=>x.src).join()==='scan,manual'&&s.reduce((a,x)=>a+x.q,0)===3, JSON.stringify(s));
  await page.close(); }

// ===== M5 — التصدير والتقارير =====
const NEW=[{code:'A1001',qty:4,entries:[{id:'e1',q:3,n:3,by:'u_owner',byName:'سالم',at:1,src:'scan'},{id:'e2',q:1,by:'u_owner',byName:'سالم',at:2,src:'manual'}]},
           {code:'B2002',qty:6,entries:[{id:'e3',q:5,by:'u_owner',byName:'سالم',at:3,src:'manual'},{id:'e4',q:1,by:'u_owner',byName:'سالم',at:4,src:'scan'}]}];
const OLD=[{code:'A1001',qty:5,entries:[{id:'o1',q:3,n:3,by:'u_owner',byName:'قديم',at:1},{id:'o2',q:2,by:'u_owner',byName:'قديم',at:2}]}];
async function rep(page,counts,cfg){ await load(page,{profile:OWNER,users:[OWNER],config:cfg,sessions:S({status:'review',__counts:counts})});
  await page.evaluate(()=>window.__openReport('sr')); await page.waitForTimeout(500); }
{ const page=await ctx.newPage(); await rep(page,NEW);
  const a=await page.evaluate(()=>window.__detailedAoa()); const h=a.detail[0];
  ok('M5 التصدير المفصّل: «بالقارئ» و«يدوي» مُلحقان في آخر الأعمدة (بلا «غير مصنّف»)', h[h.length-2]==='بالقارئ'&&h[h.length-1]==='يدوي'&&!h.includes('غير مصنّف')&&h.length===16, JSON.stringify(h.slice(-4)));
  const ra=a.detail.find(r=>r[0]==='A1001'), rb=a.detail.find(r=>r[0]==='B2002');
  ok('M5 قيم الصفوف صحيحة (أ ٣/١ ، ب ١/٥) والمعدود كما هو', ra.slice(-2).join()==='3,1'&&rb.slice(-2).join()==='1,5'&&ra[5]===4&&rb[5]===6, JSON.stringify([ra.slice(-2),rb.slice(-2)]));
  const tot=a.detail[a.detail.length-1];
  ok('M5 صفّ الإجمالي يجمع العمودين (٤ قارئ · ٦ يدوي)', tot[0]==='الإجمالي'&&tot.slice(-2).join()==='4,6', JSON.stringify(tot.slice(-2)));
  ok('M5 ورقة الملخّص تذكر إجمالي القارئ واليدوي', JSON.stringify(a.summary).includes('بالقارئ')&&JSON.stringify(a.summary.slice(-2)).includes('6'), JSON.stringify(a.summary.slice(-2)));
  const br=await page.evaluate(()=>window.__exportAoa('branch'));
  ok('M5 تصدير «مراجعة الفرع»: الأعمدة القائمة بترتيبها و«بالقارئ/يدوي» مُلحقان في النهاية', JSON.stringify(br[0])===JSON.stringify(['الباركود','اسم الصنف','الفئة','الرصيد الدفتري','المعدود','الفرق','بالقارئ','يدوي']), JSON.stringify(br[0]));
  const who=a.detail.find(r=>r[0]==='A1001')[12];
  ok('M5 «من أضاف» يوسم الجزء اليدوي بـ✍', /✍1/.test(String(who)), String(who));
  const pr=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('M5 الطباعة الافتراضيّة للمفصّل لم تتغيّر (لا أعمدة جديدة إلا بالتهيئة)', !pr.includes('>بالقارئ<'), '');
  await page.close(); }
{ const page=await ctx.newPage(); await rep(page,NEW,{settings:{export:{columns:['name','counted','scanQty','manQty','diff']}}});
  const pr=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('M5 الطباعة: «بالقارئ/يدوي» متاحان من إعدادات أعمدة التقرير المفصّل', pr.includes('بالقارئ')&&pr.includes('يدوي'), '');
  const keys=await page.evaluate(()=>window.__docColumns());
  ok('M5 الأعمدة المهيّأة محترمة', JSON.stringify(keys)==='["name","counted","scanQty","manQty","diff"]', JSON.stringify(keys));
  await page.close(); }
// ===== M6 — بيانات قبل التمييز =====
{ const page=await ctx.newPage(); await rep(page,OLD);
  const a=await page.evaluate(()=>window.__detailedAoa()); const h=a.detail[0]; const r=a.detail.find(x=>x[0]==='A1001');
  ok('M6 بيانات قديمة: يظهر «غير مصنّف» والتتابع المدموج يُحسب قارئًا (٣ قارئ · ٠ يدوي · ٢ غير مصنّف)', h[h.length-1]==='غير مصنّف'&&r.slice(-3).join()==='3,0,2'&&r[5]===5, JSON.stringify([h.slice(-3),r.slice(-3)]));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
