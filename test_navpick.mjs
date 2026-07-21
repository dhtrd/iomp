// اختبارات م٦-٣ — تنفيذ اختيار العميل للقائمة الجانبية:
// أ٢ دفع وطيّ كامل (مطويّة = عرض صفري يدفع المحتوى، بلا تعتيم على الجوال)
// ب٢ عرض زجاجي (backdrop-filter مع تراجع مصمت) + إمكانية الطي
// ج٢ مؤشر شريطي نيلي ينزلق للعنصر النشط (#navInd)
// د٦ اهتزازة أيقونة العنصر المفعّل (navwig)
// هـ٣ الزر يتحول سهم إغلاق باتجاه الطي
// التثبيت: زر القائمة أعلى القائمة (أعلى يمين الشاشة) لكل الأجهزة — لا يختفي عند فتحها
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const S1={id:'s1',name:'جرد',status:'open',started:true,location:'م',itemCount:1,createdBy:'u_owner',__chunks:[[{code:'A',name:'صنف',category:'ك',book:5,cost:2}]],__counts:[{code:'A',qty:5}]};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
async function mk(vw){ const ctx=await browser.newContext({viewport:vw}); const page=await ctx.newPage();
  await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER],sessions:[S1]})));
  await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(400); return {ctx,page}; }

// ===== سطح المكتب =====
{ const {ctx,page}=await mk({width:1180,height:760});
  const b=await page.evaluate(()=>{ const m=document.getElementById('menuToggle'); const cs=getComputedStyle(m); const r=m.getBoundingClientRect();
    return { fixed:cs.position==='fixed', z:+cs.zIndex, inTopbar:!!m.closest('.topbar'), spans:m.querySelectorAll('i').length,
      right:Math.round(innerWidth-r.right), top:Math.round(r.top) }; });
  ok('N1 الزر مثبّت (fixed) أعلى يمين الشاشة فوق القائمة — خارج الشريط العلوي', b.fixed&&!b.inTopbar&&b.spans===3&&b.z>=60&&b.right>=6&&b.right<=20&&b.top>=6&&b.top<=20, JSON.stringify(b));
  const g=await page.evaluate(()=>{ const cs=getComputedStyle(document.querySelector('.side'));
    return { bf:(cs.backdropFilter||cs.webkitBackdropFilter||'none'), bg:cs.backgroundColor, w:cs.width }; });
  const semiTransparent=/rgba\(.+,\s*0?\.\d+\)/.test(g.bg)||/color\(srgb[^)]*\/\s*0?\.\d+\)/.test(g.bg); // صيغتا rgba وcolor(srgb …/α) الحديثتان
  ok('N2 ب٢: القائمة زجاجية (ضبابية خلفية + خلفية شبه شفافة) بعرضها الكامل', g.bf.includes('blur')&&semiTransparent&&g.w==='252px', JSON.stringify(g));
  const arrowOpen=await page.evaluate(()=>getComputedStyle(document.querySelector('#menuToggle i:nth-child(1)')).transform!=='none');
  ok('N3 هـ٣: والقائمة مفتوحة الزر سهمُ إغلاق (خطوطه محوّلة)', arrowOpen===true);
  await page.click('#menuToggle'); await page.waitForTimeout(550);
  const c=await page.evaluate(()=>{ const m=document.getElementById('menuToggle'); const r=m.getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return { nav:document.getElementById('appView').getAttribute('data-nav'), sw:getComputedStyle(document.querySelector('.side')).width,
      visible:r.width>0&&!!(el&&(el.id==='menuToggle'||el.closest('#menuToggle'))),
      burger:getComputedStyle(document.querySelector('#menuToggle i:nth-child(1)')).transform==='none' }; });
  ok('N4 أ٢: الطيّ كامل (عرض 0) والمحتوى اندفع', c.nav==='collapsed'&&c.sw==='0px', JSON.stringify({nav:c.nav,sw:c.sw}));
  ok('N4 الزر لا يختفي بعد الطي ويعود ☰', c.visible===true&&c.burger===true);
  await page.click('#menuToggle'); await page.waitForTimeout(450);
  ok('N5 يعود موسّعًا بنفس الزر', await page.evaluate(()=>document.getElementById('appView').getAttribute('data-nav')==='expanded'&&getComputedStyle(document.querySelector('.side')).width==='252px'));
  const ind0=await page.evaluate(()=>{ const i=document.getElementById('navInd'); const on=document.querySelector('#appNav button.on');
    return i&&on?{top:Math.round(parseFloat(i.style.top)),want:Math.round(on.offsetTop),h:Math.round(parseFloat(i.style.height)),wh:Math.round(on.offsetHeight),tab:on.getAttribute('data-tab')}:null; });
  ok('N6 ج٢: المؤشر الشريطي موجود ملاصقًا للعنصر النشط', !!ind0&&Math.abs(ind0.top-ind0.want)<=1&&Math.abs(ind0.h-ind0.wh)<=1&&ind0.tab==='home', JSON.stringify(ind0));
  await page.evaluate(()=>{ const b=document.querySelector('#appNav [data-tab="reports"]'); b&&b.click(); }); await page.waitForTimeout(500);
  const ind1=await page.evaluate(()=>{ const i=document.getElementById('navInd'); const on=document.querySelector('#appNav button.on');
    return {top:Math.round(parseFloat(i.style.top)),want:Math.round(on.offsetTop),tab:on.getAttribute('data-tab')}; });
  ok('N6 وينزلق إلى «التقارير» عند التنقل', ind1.tab==='reports'&&Math.abs(ind1.top-ind1.want)<=1&&ind1.top!==ind0.top, JSON.stringify(ind1));
  ok('N7 د٦: أيقونة العنصر المفعّل تهتز (navwig)', await page.evaluate(()=>getComputedStyle(document.querySelector('#appNav button.on .nvic')).animationName==='navwig'));
  ok('N8 الشريط العلوي بلا زر قائمة قديم', await page.evaluate(()=>!document.querySelector('.topbar #menuToggle')));
  await ctx.close(); }

// ===== الجوال =====
{ const {ctx,page}=await mk({width:420,height:800});
  const m0=await page.evaluate(()=>{ const m=document.getElementById('menuToggle'); const r=m.getBoundingClientRect();
    const s=document.querySelector('.side').getBoundingClientRect();
    return { right:Math.round(innerWidth-r.right), top:Math.round(r.top), sideHidden:s.left>=innerWidth-2 }; });
  ok('N9 الجوال: الزر بنفس المكان أعلى اليمين والقائمة درج مخفي', m0.right>=6&&m0.right<=20&&m0.top>=6&&m0.top<=20&&m0.sideHidden===true, JSON.stringify(m0));
  await page.click('#menuToggle'); await page.waitForTimeout(550);
  const m1=await page.evaluate(()=>{ const m=document.getElementById('menuToggle'); const r=m.getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return { nav:document.getElementById('appView').getAttribute('data-nav'),
      sideShown:document.querySelector('.side').getBoundingClientRect().left<innerWidth-100,
      btnOnTop:!!(el&&(el.id==='menuToggle'||el.closest('#menuToggle'))),
      arrow:getComputedStyle(document.querySelector('#menuToggle i:nth-child(1)')).transform!=='none',
      ovBg:getComputedStyle(document.getElementById('navOverlay')).backgroundColor,
      glass:(getComputedStyle(document.querySelector('.side')).backdropFilter||'').includes('blur') }; });
  ok('N10 فتح الدرج: القائمة ظاهرة والزر فوقها لا يختفي وصار سهمًا', m1.nav==='drawer'&&m1.sideShown&&m1.btnOnTop&&m1.arrow, JSON.stringify(m1));
  ok('N11 أ٢ على الجوال: بلا تعتيم (الطبقة شفافة تمامًا) والقائمة زجاجية', m1.ovBg==='rgba(0, 0, 0, 0)'&&m1.glass===true, m1.ovBg);
  await page.click('#menuToggle'); await page.waitForTimeout(450);
  ok('N12 الزر نفسه يغلق الدرج', await page.evaluate(()=>document.getElementById('appView').getAttribute('data-nav')==='expanded'));
  await page.click('#menuToggle'); await page.waitForTimeout(400);
  await page.evaluate(()=>document.getElementById('navOverlay').click()); await page.waitForTimeout(300);
  ok('N13 والنقر خارج القائمة يغلقها أيضًا (بلا تعتيم مرئي)', await page.evaluate(()=>document.getElementById('appView').getAttribute('data-nav')==='expanded'));
  await ctx.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
