// ج٢ (طلب المالك ٢١-١٠-٢٠٢٦، ورقة الاتفاق المعتمدة): أيقونة المصدر بجانب الرقم (باركود = قارئ، قلم = يدوي،
// بلا أيقونة = قديم غير مصنّف) في شاشة العدّ وتقرير الفروقات، وملء عرض الشاشتين (عمودان ≥ ١٠٢٤px)
// — دون أي تغيير في الأرقام أو الطباعة أو تصدير Excel.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const IT = [{code:'A1001',name:'صنف ممسوح',category:'ك',book:5,cost:2},{code:'B2002',name:'صنف يدوي',category:'ك',book:3,cost:2},
            {code:'C3003',name:'صنف قديم',category:'ك',book:2,cost:2},{code:'D4004',name:'صنف مختلط',category:'ك',book:9,cost:2}];
const E = (id,q,src,extra)=>Object.assign({id,q,by:'u_c',byName:'عبدالكريم',at:1},src?{src}:{},extra||{});
const COUNTS = [
  {code:'A1001',qty:6,entries:[E('a1',4,'scan',{n:4}),E('a2',2,'scan',{n:2})]},
  {code:'B2002',qty:5,entries:[E('b1',5,'manual')]},
  {code:'C3003',qty:2,entries:[E('c1',1),E('c2',1)]},
  {code:'D4004',qty:12,entries:[E('d1',9,'scan',{n:9}),E('d2',3,'manual')]} ];
const SESS = [{ id:'sr', name:'جرد', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع', itemCount:4, __chunks:[IT], __counts:COUNTS }];
const SC = { profile:OWNER, users:[OWNER], sessions:SESS };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
async function boot(w,h){ const ctx=await browser.newContext({ viewport:{width:w,height:h} }); const page=await ctx.newPage();
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(SC))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await sleep(400); return {ctx,page}; }
const chipIcons=(page,code)=>page.evaluate(c=>{ const r=document.querySelector('[data-row="'+c+'"]'); if(!r)return null;
  return [...r.querySelectorAll('svg.sic')].map(s=>s.getAttribute('aria-label')); },code);
const noHScroll=(page)=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);

// I1–I4 — شاشة العدّ على 1440
{ const {ctx,page}=await boot(1440,900); await page.evaluate(()=>window.__openSession('sr')); await sleep(600);
  ok('I1 القارئ: أيقونة باركود على كل إضافة (٢)', JSON.stringify(await chipIcons(page,'A1001'))==='["بالقارئ","بالقارئ"]', JSON.stringify(await chipIcons(page,'A1001')));
  ok('I1 اليدوي: أيقونة قلم', JSON.stringify(await chipIcons(page,'B2002'))==='["يدوي"]', JSON.stringify(await chipIcons(page,'B2002')));
  ok('I1 القديم (بلا src): بلا أيقونة', JSON.stringify(await chipIcons(page,'C3003'))==='[]', JSON.stringify(await chipIcons(page,'C3003')));
  ok('I1 المختلط: باركود ثم قلم بترتيب الإضافات', JSON.stringify(await chipIcons(page,'D4004'))==='["بالقارئ","يدوي"]', JSON.stringify(await chipIcons(page,'D4004')));
  const txt=await page.evaluate(()=>document.getElementById('clist').textContent);
  ok('I2 النصّ «✍ يدوي» وذيل «— بالقارئ X · يدوي Y» لم يعودا في شاشة العدّ', !txt.includes('✍')&&!/—\s*بالقارئ/.test(txt), txt.slice(0,200));
  const q=await page.evaluate(()=>['A1001','B2002','C3003','D4004'].map(c=>window.__qtyOf(c)).join());
  ok('I3 الكميات كما هي (6,5,2,12)', q==='6,5,2,12', q);
  ok('I3 «الإجمالي» المعروض في البطاقات كما هو', await page.evaluate(()=>['6','5','2','12'].every((v,i)=>document.querySelector('[data-row="'+['A1001','B2002','C3003','D4004'][i]+'"]').textContent.includes('الإجمالي: '+v))));
  const g=await page.evaluate(()=>{ const c=document.getElementById('clist'); const cs=getComputedStyle(c); const pane=document.getElementById('appContent').parentElement.getBoundingClientRect().width; return {cols:cs.display==='grid'?cs.gridTemplateColumns.split(' ').length:1, w:c.getBoundingClientRect().width, pane}; });
  ok('I4 على 1440: عمودان والبطاقات تملأ كامل المساحة بجانب القائمة الجانبيّة (هامش ٢٤px لكلّ جهة)', g.cols===2&&g.w>=g.pane-50&&g.w>1100, JSON.stringify(g));
  ok('I4 على 1440: لا تمرير أفقي', await noHScroll(page));
  await ctx.close(); }

// I5 — مقاسات أخرى
for(const [w,cols] of [[1024,2],[768,1],[390,1]]){ const {ctx,page}=await boot(w,900); await page.evaluate(()=>window.__openSession('sr')); await sleep(600);
  const c=await page.evaluate(()=>{ const cs=getComputedStyle(document.getElementById('clist')); return cs.display==='grid'?cs.gridTemplateColumns.split(' ').length:1; });
  ok(`I5 على ${w}px: ${cols===2?'عمودان':'عمود واحد'} ولا تمرير أفقي`, c===cols&&(await noHScroll(page)), 'cols='+c);
  await ctx.close(); }

// I6–I8 — تقرير الفروقات على 1440 + الطباعة والتصدير بلا تغيير
{ const {ctx,page}=await boot(1440,900); await page.evaluate(()=>window.__openReport('sr')); await sleep(800);
  await page.evaluate(()=>{ const cb=document.getElementById('repWho'); if(cb&&!cb.checked){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); } }); await sleep(400);
  const rows=await page.evaluate(()=>{ const out={}; document.querySelectorAll('#appContent table tbody tr').forEach(tr=>{ const code=(tr.querySelector('.tag')||{}).textContent; const tds=tr.querySelectorAll('td');
      out[code]={counted:[...tds[4].querySelectorAll('svg.sic')].map(s=>s.getAttribute('aria-label')).join('+'), cnt:tds[4].textContent.trim(),
        who:[...tds[tds.length-1].querySelectorAll('svg.sic')].map(s=>s.getAttribute('aria-label')).join('+'), whoTxt:tds[tds.length-1].textContent}; }); return out; });
  ok('I6 «المعدود»: باركود للممسوح، قلم لليدوي، لا شيء للقديم، الاثنان للمختلط', rows.A1001&&rows.A1001.counted==='بالقارئ'&&rows.B2002.counted==='يدوي'&&rows.C3003.counted===''&&rows.D4004.counted==='بالقارئ+يدوي', JSON.stringify(rows).slice(0,300));
  ok('I6 «المعدود»: الأرقام كما هي', rows.A1001&&rows.A1001.cnt==='6'&&rows.B2002.cnt==='5'&&rows.C3003.cnt==='2'&&rows.D4004.cnt==='12', JSON.stringify(Object.values(rows).map(r=>r.cnt)));
  ok('I7 «من أضاف»: أيقونة لكل جزء بدل «✍» (المختلط: باركود+قلم)', rows.D4004&&rows.D4004.who==='بالقارئ+يدوي'&&rows.A1001.who==='بالقارئ+بالقارئ'&&rows.B2002.who==='يدوي'&&rows.C3003.who===''&&!rows.D4004.whoTxt.includes('✍'), JSON.stringify(rows).slice(0,300));
  const t=await page.evaluate(()=>{ const tb=document.querySelector('#appContent table'); const pane=document.getElementById('appContent').parentElement.getBoundingClientRect().width; const box=tb?tb.parentElement.clientWidth:0; return {w:tb?tb.getBoundingClientRect().width:0,box,pane}; });
  ok('I8 التقرير على 1440: الجدول يملأ المساحة بجانب القائمة الجانبيّة ولا تمرير أفقي للصفحة', t.w>=t.box-2&&t.w>1050&&(await noHScroll(page)), JSON.stringify(t));
  const aoa=await page.evaluate(()=>JSON.stringify(window.__detailedAoa?window.__detailedAoa():null));
  ok('I9 تصدير Excel المفصّل بلا أيقونات ويُبقي «✍» كما كان', aoa&&!aoa.includes('<svg')&&aoa.includes('✍3'), String(aoa).slice(0,200));
  const pr=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('branch'); }catch(e){ return 'ERR '+e.message; } });
  ok('I9 طباعة «مراجعة الفرع» بلا أيقونات وتُبقي «✍» كما كانت', !pr.startsWith('ERR')&&!pr.includes('sic')&&pr.includes('✍3'), pr.slice(0,160));
  await ctx.close(); }

// I10 — بقيّة الشاشات لم تتّسع
{ const {ctx,page}=await boot(1440,900); await page.evaluate(()=>window.__setTab('sessions')); await sleep(400);
  const w=await page.evaluate(()=>document.getElementById('appContent').getBoundingClientRect().width);
  ok('I10 الشاشات الأخرى بعرضها السابق (≤ 900px)', w<=900, 'w='+w);
  await page.evaluate(()=>window.__openSession('sr')); await sleep(500); await page.evaluate(()=>window.__setTab('home')); await sleep(400);
  const w2=await page.evaluate(()=>document.getElementById('appContent').getBoundingClientRect().width);
  ok('I10 بعد مغادرة شاشة العدّ يعود العرض كما كان', w2<=900, 'w='+w2);
  await ctx.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
