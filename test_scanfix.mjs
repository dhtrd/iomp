// اختبارات م٦-٣: إصلاح قارئ الباركود — المطابقة المتسامحة + تسجيل العدّ بالماسح الخارجي (Enter) دون تفعيل «وضع الماسح»
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const SESS = [{ id:'sr', name:'جرد', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:3,
  __chunks:[[{code:'16580',name:'صنف أ',category:'ك',book:5,cost:1},{code:'0012345',name:'صنف ب',category:'ك',book:3,cost:1},{code:'99916382',name:'صنف ج',category:'ك',book:2,cost:1,barcode:'6281000123456'}]] }];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:9000}); await page.waitForTimeout(200); }
const cnt=(page,code)=>page.evaluate(c=>{ const d=window.__store['sessions/sr/counts/'+c]; return d?d.qty:null; }, code);

// ===== S1 — المطابقة المتسامحة (findByScan) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS});
  const ITEMS=[{code:'16580',name:'أ',barcode:''},{code:'0012345',name:'ب',barcode:''},{code:'99916382',name:'ج',barcode:'6281000123456'}];
  const m=(c)=>page.evaluate(([i,x])=>window.__findByScan(i,x),[ITEMS,c]);
  ok('S1 مطابقة مباشرة', await m('16580')==='16580');
  ok('S1 أصفار بادئة في الممسوح', await m('016580')==='16580');
  ok('S1 أصفار بادئة في الكود المخزّن', await m('12345')==='0012345');
  ok('S1 مطابقة عبر الباركود', await m('6281000123456')==='99916382');
  ok('S1 مسافات محيطة', await m('  16580 ')==='16580');
  ok('S1 غير موجود يبقى بلا مطابقة', await m('777777')===null);
  await page.close(); }

// ===== S2 — الماسح الخارجي: كتابة الكود في البحث + Enter يسجّل عدّة ١+ دون «وضع الماسح» =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS});
  await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500);
  ok('S2 حقل البحث حاضر في شاشة العد', await page.evaluate(()=>window.__has('csearch')));
  // محاكاة ماسح: يكتب الكود ثم Enter
  await page.fill('#csearch','16580'); await page.press('#csearch','Enter'); await page.waitForTimeout(350);
  ok('S2 مسح «16580» سجّل عدّة (qty=1) دون تفعيل وضع الماسح', await cnt(page,'16580')===1, 'qty='+await cnt(page,'16580'));
  // مسحة ثانية للصنف نفسه ⇒ تراكم
  await page.fill('#csearch','16580'); await page.press('#csearch','Enter'); await page.waitForTimeout(300);
  ok('S2 مسحة ثانية تراكمت (qty=2)', await cnt(page,'16580')===2, 'qty='+await cnt(page,'16580'));
  // مطابقة متسامحة عبر الماسح (أصفار بادئة)
  await page.fill('#csearch','012345'); await page.press('#csearch','Enter'); await page.waitForTimeout(300);
  ok('S2 مسح «012345» طابق «0012345» وسجّل', await cnt(page,'0012345')===1, 'qty='+await cnt(page,'0012345'));
  // مطابقة عبر الباركود
  await page.fill('#csearch','6281000123456'); await page.press('#csearch','Enter'); await page.waitForTimeout(300);
  ok('S2 مسح الباركود سجّل على كود الصنف', await cnt(page,'99916382')===1, 'qty='+await cnt(page,'99916382'));
  // نصّ بحث لا يطابق صنفًا: Enter لا يسجّل شيئًا خطأً
  await page.fill('#csearch','صنف'); await page.press('#csearch','Enter'); await page.waitForTimeout(200);
  const anyExtra=await page.evaluate(()=>Object.keys(window.__store).filter(k=>k.indexOf('sessions/sr/counts/')===0).length);
  ok('S2 بحث نصّي + Enter لا يُنشئ عدّة خاطئة', anyExtra===3, 'countsDocs='+anyExtra);
  await page.close(); }

// ===== S3 — «وضع الماسح» ما زال يعمل (لا انحدار) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS});
  await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500);
  await page.evaluate(()=>{ const b=document.getElementById('scanModeBtn'); if(b)b.click(); }); await page.waitForTimeout(120);
  await page.fill('#csearch','99916382'); await page.press('#csearch','Enter'); await page.waitForTimeout(350);
  ok('S3 وضع الماسح يسجّل العدّ (qty=1)', await cnt(page,'99916382')===1, 'qty='+await cnt(page,'99916382'));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
