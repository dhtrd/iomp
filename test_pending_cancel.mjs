// حذف الكمية المنتظرة (⏳) أثناء نفاد الحصّة — طلب المالك 2026-10-24:
// «لا أستطيع حذف كمية في الجرد إذا نفذت الحصّة».
// الكمية المحفوظة في طابور الجهاز تُعرض الآن بزرّ ×؛ الحذف يمرّ بالمسار المعتاد (تأكيد + سبب التسوية)
// ويُدرَج «حذفًا» في الطابور خلف الإضافة ⇒ عند المزامنة تُكتب الإضافة ثم تُحذف، ويُسجَّل الحذف وسببه في سجلّ الحركة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const SESS = [{ id:'sr', name:'جرد ليلي', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2,
  __chunks:[[{code:'A1001',name:'صنف أ',category:'ك',book:5,cost:1},{code:'B2002',name:'صنف ب',category:'ك',book:3,cost:1}]] }];
const CFG = { features:{ offlineCount:true }, settings:{ adjustmentReasonRequired:true } };
const SC = { profile:OWNER, users:[OWNER], config:CFG, sessions:SESS };

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function boot(page,sc,clear){ if(clear) await page.addInitScript(()=>{ try{ if(!sessionStorage.getItem('__c')){ localStorage.clear(); sessionStorage.setItem('__c','1'); } }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(350); }
async function reloadLike(page,sc){ const dump=await page.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
  const np=await page.context().newPage(); await np.addInitScript((d)=>{ try{ if(!sessionStorage.getItem('__r')){ localStorage.clear(); for(const k in d)localStorage.setItem(k,d[k]); sessionStorage.setItem('__r','1'); } }catch(e){} },dump);
  await page.close(); await boot(np,sc,false); return np; }
const openSr=async(page)=>{ await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500); };
const idle=async(page)=>{ for(let i=0;i<60;i++){ if(await page.evaluate(()=>window.__scanIdle()))break; await sleep(50); } await sleep(150); };
const scan=async(page,code,n)=>{ for(let i=0;i<n;i++){ await page.evaluate(c=>window.__scanCommit(c,'field'),code); await idle(page); } };
const qlen=(page)=>page.evaluate(()=>window.__offline.queue().then(q=>q.length));
const srvDoc=(page,code)=>page.evaluate(c=>window.__store['sessions/sr/counts/'+c]||null,code);
const qty=(page,code)=>page.evaluate(c=>window.__qtyOf(c),code);
const ents=(page,code)=>page.evaluate(c=>window.__cntEntries(c),code);
// أزرار الحذف لصنفٍ معيّن (data-delp="1" = كمية في طابور الجهاز)
const delBtns=(page,code)=>page.evaluate(c=>[...document.querySelectorAll('#clist [data-delc]')].filter(b=>b.getAttribute('data-delc')===c).map(b=>({i:+b.getAttribute('data-deli'),p:b.getAttribute('data-delp')==='1',n:+b.getAttribute('data-deln')})),code);
const clickDel=(page,code,i)=>page.evaluate(([c,i])=>{ const b=[...document.querySelectorAll('#clist [data-delc]')].find(x=>x.getAttribute('data-delc')===c&&+x.getAttribute('data-deli')===i); if(!b)return false; b.click(); return true; },[code,i]);
const vis=(page,id)=>page.evaluate(id=>{ const e=document.getElementById(id); if(!e)return false; const st=getComputedStyle(e); return st.display!=='none'&&st.visibility!=='hidden'&&e.getClientRects().length>0; },id); // الطبقات ثابتة الموضع ⇒ offsetParent دائمًا null
const waitVis=async(page,id)=>{ for(let k=0;k<40;k++){ if(await vis(page,id))return true; await sleep(50); } return false; };
const activity=(page)=>page.evaluate(()=>Object.keys(window.__store).filter(k=>k.startsWith('sessions/sr/activity/')).map(k=>window.__store[k]).filter(Boolean));

const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
let page=await ctx.newPage(); await boot(page,SC,true); await openSr(page);

// ك١ — أثناء نفاد الحصّة: كميتان يدويّتان تُحفظان على الجهاز وتظهر لكلٍّ منهما ×
await page.evaluate(()=>window.__quotaOut(true)); await sleep(100);
await page.evaluate(()=>window.__addEntry('A1001',5)); await sleep(250);
await page.evaluate(()=>window.__addEntry('A1001',3)); await sleep(250);
{ const e=await ents(page,'A1001'), b=await delBtns(page,'A1001');
  ok('ك١ الكميتان منتظرتان (⏳) في طابور الجهاز', e.length===2&&e.every(x=>x.pending)&&(await qlen(page))===2, JSON.stringify(e)+' q='+(await qlen(page)));
  ok('ك١ لكلّ كميةٍ منتظرة زرّ حذف × (كان مخفيًّا)', b.length===2&&b.every(x=>x.p), JSON.stringify(b)); }

// ك٢ — إلغاء الحوار لا يغيّر شيئًا
await clickDel(page,'A1001',0); await waitVis(page,'cfOverlay');
{ const msg=await page.evaluate(()=>document.getElementById('cfMsg').textContent);
  ok('ك٢ رسالة التأكيد توضّح أن الكمية على الجهاز ولم تُرسل بعد', /محفوظة على جهازك/.test(msg), msg);
  await page.evaluate(()=>document.getElementById('cfCancel').click()); await sleep(250);
  ok('ك٢ «إلغاء» لا يحذف شيئًا (٨، والطابور ٢)', (await qty(page,'A1001'))===8&&(await qlen(page))===2, 'qty='+(await qty(page,'A1001'))); }

// ك٣ — الحذف الفعليّ: تأكيد + سبب التسوية ⇒ تختفي الكمية فورًا، ويُدرَج «حذف» في الطابور
await clickDel(page,'A1001',0); await waitVis(page,'cfOverlay');
await page.evaluate(()=>document.getElementById('cfGo').click());
const askedReason=await waitVis(page,'ppOverlay');
ok('ك٣ يُطلب سبب التسوية كالمعتاد', askedReason);
await page.evaluate(()=>{ const i=document.getElementById('ppInput'); i.value='خطأ إدخال'; i.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('ppGo').click(); });
await sleep(400);
{ const e=await ents(page,'A1001');
  ok('ك٣ الكمية المحذوفة (٥) اختفت والباقي ٣', (await qty(page,'A1001'))===3&&e.length===1&&e[0].q===3, JSON.stringify(e));
  ok('ك٣ الحذف محفوظ في الطابور خلف الإضافة (٣ عمليات)', (await qlen(page))===3, 'q='+(await qlen(page)));
  ok('ك٣ الخادم لم يُلمس بعد', (await srvDoc(page,'A1001'))===null); }

// ك٤ — تحديث الصفحة والحصّة ما زالت نافدة: الحذف باقٍ (لا تعود الكمية المحذوفة)
page=await reloadLike(page,Object.assign({},SC,{quotaOut:true})); await openSr(page);
{ ok('ك٤ بعد التحديث: الكمية ٣ لا ٨ (الحذف محفوظ)', (await qty(page,'A1001'))===3, 'qty='+(await qty(page,'A1001')));
  const b=await delBtns(page,'A1001');
  ok('ك٤ الكمية الباقية المنتظرة ما زال لها ×', b.length===1&&b[0].p, JSON.stringify(b)); }

// ك٥ — تتابع مسحٍ (×٣) أثناء النفاد: «إنقاص واحد» يعمل على الكمية المنتظرة
await scan(page,'B2002',3);
{ const b=await delBtns(page,'B2002');
  ok('ك٥ تتابع المسح المنتظر (×٣) له ×', b.length===1&&b[0].p&&b[0].n===3, JSON.stringify(b)); }
const clickedB=await clickDel(page,'B2002',0);
const runAsk=await waitVis(page,'rdOverlay');
if(runAsk){ await page.evaluate(()=>document.getElementById('rdOne').click()); }
else if(await waitVis(page,'cfOverlay')){ await page.evaluate(()=>document.getElementById('cfGo').click()); }
ok('ك٥ ظهر حوار حذف التتابع (إنقاص واحد / الكل)', clickedB&&runAsk, 'clicked='+clickedB+' runAsk='+runAsk);
if(await waitVis(page,'ppOverlay')) await page.evaluate(()=>{ const i=document.getElementById('ppInput'); i.value='مسحة مكرّرة'; i.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('ppGo').click(); });
await sleep(400);
ok('ك٥ إنقاص مسحةٍ من التتابع المنتظر: ٣ ⇒ ٢', (await qty(page,'B2002'))===(runAsk?2:0), 'runAsk='+runAsk+' qty='+(await qty(page,'B2002')));

// ك٦ — تجدّد الحصّة: مزامنة تلقائيّة، الخادم يطابق الشاشة بالضبط، والسجلّ يحمل الحذف وسببه
await page.evaluate(()=>window.__quotaOut(false));
await page.evaluate(()=>window.__autoTick()); await sleep(900);
{ const a=await srvDoc(page,'A1001'), bdoc=await srvDoc(page,'B2002');
  ok('ك٦ الطابور فرغ بعد تجدّد الحصّة', (await qlen(page))===0, 'q='+(await qlen(page)));
  ok('ك٦ الخادم: A1001 = ٣ بسطرٍ واحد (الـ٥ المحذوفة لم تبقَ)', a&&a.qty===3&&(a.entries||[]).length===1&&a.entries[0].q===3, JSON.stringify(a&&a.entries));
  ok('ك٦ الخادم: B2002 = ٢ (التتابع أُنقص مسحةً واحدة)', bdoc&&bdoc.qty===(runAsk?2:0), JSON.stringify(bdoc&&bdoc.entries));
  ok('ك٦ الشاشة = الخادم (لا ازدواج)', (await qty(page,'A1001'))===3&&(await qty(page,'B2002'))===(runAsk?2:0));
  const act=await activity(page); const rm=act.filter(x=>x.type==='remove'&&x.code==='A1001');
  ok('ك٦ سجلّ الحركة: «حذف كمية» ٥ مع سبب التسوية', rm.length===1&&rm[0].qty===5&&/خطأ إدخال/.test(rm[0].name||''), JSON.stringify(rm));
  const rmB=act.filter(x=>x.type==='remove'&&x.code==='B2002');
  ok('ك٦ سجلّ الحركة: إنقاص التتابع مسجَّل بسببه', rmB.length===1&&/مسحة مكرّرة/.test(rmB[0].name||''), JSON.stringify(rmB)); }

// ك٧ — بعد المزامنة: لا كميات منتظرة، وأزرار الحذف العاديّة كما هي (بلا وسم الطابور)
{ const b=await delBtns(page,'A1001');
  ok('ك٧ بعد المزامنة: × عاديّ (ليس كمية طابور)', b.length===1&&!b[0].p, JSON.stringify(b)); }

// ك٨ — بلا نفاد: الإضافة العاديّة لا تُوسَم كمية طابور (السلوك القائم دون تغيير)
await page.evaluate(()=>window.__addEntry('A1001',2)); await sleep(500);
{ const e=await ents(page,'A1001'), b=await delBtns(page,'A1001');
  ok('ك٨ الاتصال سليم: الإضافة تصل الخادم ولا تبقى منتظرة', (await qlen(page))===0&&e.every(x=>!x.pending)&&(await srvDoc(page,'A1001')).qty===5, JSON.stringify(e));
  ok('ك٨ لا وسم طابور على أيّ ×', b.length===2&&b.every(x=>!x.p), JSON.stringify(b)); }
await ctx.close();

// ك٩ — جلسة أُقفلت للمراجعة: لا × حتى على المنتظر (السلوك القائم محفوظ)
{ const c2=await browser.newContext({ viewport:{width:1100,height:1200} }); const p=await c2.newPage();
  const S2=[Object.assign({},SESS[0],{status:'review'})];
  await boot(p,{profile:OWNER,users:[OWNER],config:CFG,sessions:S2},true); await openSr(p);
  const n=await p.evaluate(()=>document.querySelectorAll('#clist [data-delc]').length);
  ok('ك٩ جلسة مقفلة: لا أزرار حذف', n===0, 'n='+n); await c2.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
