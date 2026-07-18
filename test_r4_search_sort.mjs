// اختبارات الدفعة ر٤ — البحث المطبَّع (م٢١) + فرز جدول التقرير (م١٣) في التطبيق الحي
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
// أصناف بتنويعات إملائية + قيم للفرز
const ITEMS=[[
  {code:'K1',name:'أدوات كهربائية كبيرة',book:10,cost:5},
  {code:'K2',name:'ادوات كهربائيه صغيره',book:3,cost:2},
  {code:'M1',name:'مواد بناء',book:50,cost:1},
  {code:'M2',name:'مظلة حديقة',book:7,cost:9},
]];
const results = [];
const ok = (n,c,d='') => results.push({n,pass:!!c,d});
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page, sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
const SESS={id:'s1',name:'جرد',status:'open',started:true,assignedCounters:['u_owner'],itemCount:4,__chunks:ITEMS};

// N1 — arNorm معرّفة وتطبّع (همزات/تاء مربوطة/ياء/تشكيل)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>({
    a:window.arNorm('أَدَوَات')===window.arNorm('ادوات'),
    b:window.arNorm('كهربائية')===window.arNorm('كهربائيه'),
    c:window.arNorm('مصطفى')===window.arNorm('مصطفي')}));
  ok('N1 التطبيع العربي (أ/ة/ى/تشكيل)', r.a&&r.b&&r.c, JSON.stringify(r));
  await page.close(); }
// N2 — بحث شاشة العد: «كهربائيه» تجد الاثنين (المكتوب بالتاء والهاء)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SESS]});
  await page.evaluate(()=>window.__openSession('s1')); await page.waitForTimeout(350);
  const r=await page.evaluate(()=>{ const s=document.getElementById('csearch'); s.value='كهربائيه'; s.oninput();
    const h=window.__contentHtml(); return {k1:h.includes('K1'),k2:h.includes('K2'),m1:!h.includes('مواد بناء')}; });
  ok('N2 بحث العد المطبَّع يجد التنويعين ويستبعد غيرهما', r.k1&&r.k2&&r.m1, JSON.stringify(r));
  await page.close(); }
// N3 — بحث ⌘K مطبَّع: «جده» تجد «جدة»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[{id:'sj',name:'جرد فرع جدة',status:'open',started:false,itemCount:1,location:'فرع جدة',__chunks:[[{code:'A',name:'أ'}]]}]});
  await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
  await page.type('#ckInput','جده'); await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({n:(window.__ckItems||[]).length, hit:(window.__ckItems||[]).some(x=>String(x.title).includes('جدة'))}));
  ok('N3 بحث ⌘K المطبَّع («جده»←«جدة»)', r.n>=1&&r.hit, JSON.stringify(r));
  await page.close(); }
// N4 — بحث تقرير الفروقات مطبَّع
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SESS]});
  await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{ const s=document.getElementById('repSearch'); if(!s)return {no:true};
    s.value='كهربائيه'; s.oninput?s.oninput():s.dispatchEvent(new Event('input'));
    return {rows:document.querySelectorAll('#repTable tbody tr').length}; });
  ok('N4 بحث التقرير المطبَّع (نتيجتان)', r.rows===2, JSON.stringify(r));
  await page.close(); }
// S1 — فرز رقمي: نقر «الدفتري» يصعد ثم النقر الثاني يهبط
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SESS]});
  await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    const get=()=>[...document.querySelectorAll('#repTable tbody tr')].map(tr=>tr.cells[3].textContent.trim());
    document.querySelector('[data-rsort="book"]').click();
    const asc=get();
    document.querySelector('[data-rsort="book"]').click();
    const desc=get();
    const nums=a=>a.map(x=>+String(x).replace(/[^0-9.-]/g,'')||0);
    const na=nums(asc), nd=nums(desc);
    return {asc:na.every((v,i)=>i===0||v>=na[i-1]), desc:nd.every((v,i)=>i===0||v<=nd[i-1]),
      car:document.querySelector('[data-rsort="book"]').textContent.includes('▼')};
  });
  ok('S1 فرز «الدفتري» صعودًا ثم هبوطًا بمؤشر اتجاه', r.asc&&r.desc&&r.car, JSON.stringify(r));
  await page.close(); }
// S2 — فرز نصّي مطبَّع: «الصنف» يرتب بالتطبيع (أدوات=ادوات معًا)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SESS]});
  await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    document.querySelector('[data-rsort="name"]').click();
    const names=[...document.querySelectorAll('#repTable tbody tr')].map(tr=>tr.cells[1].textContent);
    // بالتطبيع: «أدوات…» و«ادوات…» متجاورتان قبل «مظلة» و«مواد»
    const i1=names.findIndex(n=>n.includes('كهربائية')), i2=names.findIndex(n=>n.includes('كهربائيه'));
    return {adj:Math.abs(i1-i2)===1, first:Math.min(i1,i2)===0};
  });
  ok('S2 الفرز النصي بالتطبيع يجاور التنويعين ويقدّمهما', r.adj&&r.first, JSON.stringify(r));
  await page.close(); }
// S3 — الفرز يعمل مع المرشحات معًا (فئة+فرز) ولا يفسد الإجماليات
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SESS]});
  await page.evaluate(()=>window.__openReport('s1')); await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    document.querySelector('[data-rsort="cost"]').click();
    const tf=document.querySelector('#repTable tfoot');
    return {rows:document.querySelectorAll('#repTable tbody tr').length===4, hasTotal:tf&&tf.textContent.includes('الإجمالي')};
  });
  ok('S3 الفرز لا يفسد الصفوف ولا الإجماليات', r.rows&&r.hasTotal, JSON.stringify(r));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
