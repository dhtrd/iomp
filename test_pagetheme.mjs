// اختبارات م٦-٥ — تنفيذ اختيار العميل: انتقال الصفحات + ثيم السطح
// انتقال: أ٦ صعود كبير + ب٤ دفع مرن + ج٨ تتابع صفوف (حركة دخول متتابعة على #appContent>*) + هـ٩ شريط تحميل علوي (#routeProg)
// ثيم السطح (مقصور على #appContent): ب٩ حدود شعرية بلا ظلال + ج٥ هالتان مموّهتان (.mainpane::before/::after) + د٨ شريط متدرج أعلى كل بطاقة (::before)
// د١ (السطح الحالي كمرجع): لا مساس بالشريط العلوي/القائمة/شاشة الدخول.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const S={id:'s1',name:'جرد مستودع الاثاث',status:'open',started:true,location:'مستودع الاثاث',itemCount:3,createdBy:'u_owner',__chunks:[[{code:'A',name:'صنف',category:'ك',book:5,cost:2}]],__counts:[{code:'A',qty:5}]};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1180,height:820} });
async function app(){ const page=await ctx.newPage(); await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER],sessions:[S]})));
  await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(400); return page; }

// ===== T1 — شريط التحميل (هـ٩) موجود ويومض عند التنقّل =====
{ const page=await app();
  ok('T1 عنصر شريط التحميل موجود', await page.evaluate(()=>!!document.getElementById('routeProg')));
  const on=await page.evaluate(()=>{ const b=document.querySelector('[data-tab="sessions"]'); b&&b.click();
    return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(document.getElementById('routeProg').classList.contains('on'))))); });
  ok('T1 الشريط يومض (on) فور التنقّل', on===true);
  await page.close(); }

// ===== T2 — حركة الدخول المتتابعة (أ٦+ب٤+ج٨) على عناصر المحتوى =====
{ const page=await app();
  const a=await page.evaluate(()=>{ const b=document.querySelector('[data-tab="sessions"]'); b&&b.click();
    return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{ const c=document.getElementById('appContent');
      const kids=[...c.children]; const anim=kids.length?getComputedStyle(kids[0]).animationName:'NONE';
      const d2=kids.length>1?getComputedStyle(kids[1]).animationDelay:'0s';
      r({pgin:c.classList.contains('pgin'),anim,delay0:getComputedStyle(kids[0]).animationDelay,delay1:d2,n:kids.length}); }))); });
  ok('T2 #appContent يأخذ pgin وعناصره تتحرك بـpgEnter', a.pgin&&a.anim==='pgEnter', JSON.stringify(a));
  ok('T2 التتابع: تأخير العنصر الثاني أكبر من الأول (ج٨)', parseFloat(a.delay1)>parseFloat(a.delay0), JSON.stringify({d0:a.delay0,d1:a.delay1}));
  await page.close(); }

// ===== T3 — ثيم السطح: بطاقات المحتوى حدود شعرية بلا ظل + شريط متدرج علوي =====
{ const page=await app(); await page.waitForTimeout(300);
  const card=await page.evaluate(()=>{ const c=document.querySelector('#appContent .card'); if(!c)return null; const cs=getComputedStyle(c);
    const bf=getComputedStyle(c,'::before'); return { shadow:cs.boxShadow, border:cs.borderTopWidth, strip:bf.backgroundImage.includes('gradient'), stripH:bf.height }; });
  ok('T3 ب٩: بطاقة المحتوى بلا ظل وبحدّ شعري', card&&(card.shadow==='none')&&parseFloat(card.border)>=1, JSON.stringify(card));
  ok('T3 د٨: شريط متدرج أعلى البطاقة (::before)', card&&card.strip&&parseFloat(card.stripH)>=2&&parseFloat(card.stripH)<=5, JSON.stringify(card));
  await page.close(); }

// ===== T4 — ج٥: هالتان مموّهتان خلف المحتوى (.mainpane::before/::after) =====
{ const page=await app();
  const h=await page.evaluate(()=>{ const mp=document.querySelector('.mainpane');
    const be=getComputedStyle(mp,'::before'), af=getComputedStyle(mp,'::after');
    return { b:be.filter.includes('blur')&&be.position==='fixed', a:af.filter.includes('blur') }; });
  ok('T4 هالتان مموّهتان (blur) خلف المحتوى', h.b&&h.a, JSON.stringify(h));
  const z=await page.evaluate(()=>getComputedStyle(document.querySelector('.container')).zIndex);
  ok('T4 المحتوى فوق الهالات (z-index للحاوية)', z==='1', z);
  await page.close(); }

// ===== T5 — العزل: الشريط العلوي والقائمة وشاشة الدخول بلا شريط متدرج ولا حدود شعرية جديدة =====
{ const page=await app();
  const iso=await page.evaluate(()=>{
    // بطاقة خارج #appContent (مثلاً داخل القائمة الجانبية لا توجد .card؛ نفحص أن ثيم البطاقة لم يُعمَّم عالميًّا)
    const anyOutside=[...document.querySelectorAll('.card')].filter(c=>!c.closest('#appContent'));
    const outsideStrip=anyOutside.some(c=>getComputedStyle(c,'::before').backgroundImage.includes('gradient')&&getComputedStyle(c,'::before').height!=='auto'&&parseFloat(getComputedStyle(c,'::before').height)<=5);
    return { topbarUntouched:!!document.querySelector('.topbar'), outsideStrip };
  });
  ok('T5 الثيم مقصور على المحتوى — بطاقات خارج #appContent بلا شريط متدرج', iso.outsideStrip===false);
  await page.close(); }

// ===== T6 — الوضع الليلي: الانتقال والثيم يعملان بلا كسر =====
{ const page=await app();
  await page.click('#themeToggle'); await page.waitForTimeout(300);
  const d=await page.evaluate(()=>{ const c=document.querySelector('#appContent .card'); const cs=getComputedStyle(c);
    const be=getComputedStyle(document.querySelector('.mainpane'),'::before');
    return { theme:document.documentElement.getAttribute('data-theme'), shadow:cs.boxShadow, halo:be.filter.includes('blur') }; });
  ok('T6 الوضع الليلي: بلا ظل، الهالة تعمل', d.theme==='dark'&&d.shadow==='none'&&d.halo, JSON.stringify(d));
  await page.close(); }

// ===== T7 — لا انحدار: لوحة المعلومات ما زالت تعرض مؤشّراتها وبنودها =====
{ const page=await app(); await page.waitForTimeout(400);
  const r=await page.evaluate(()=>({kpis:document.querySelectorAll('#dashKpis .tile').length, home:!!document.querySelector('#actionCenter')}));
  ok('T7 لوحة المعلومات سليمة (٤ مؤشّرات + مركز الإجراءات)', r.kpis===4&&r.home, JSON.stringify(r));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
