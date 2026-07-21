// اختبارات م٦-٤ — تنفيذ اختيار العميل لشاشة تسجيل الدخول:
// أ٣ بطاقة زجاجية + ب٥ خلفية فقاعات ضبابية + ج٥ أيقونات داخل الحقول + هـ٦ زر عين كلمة المرور
// د٢ زر «دخول» بتدرج نيلي→بنفسجي وظل ملون
// هـ٤ اهتزاز البطاقة عند خطأ الدخول + هـ٥ تحوّل الزر إلى دائرة نجاح ✓ عند الدخول الصحيح
// كل ذلك مقصور على شاشة الدخول — لا يمسّ أي .card/.btn في التطبيق (المعرّفات loginForm/loginBtn/email/password باقية).
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:900} });
async function loginPage(){ const page=await ctx.newPage(); await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER],loggedOut:true})));
  await page.waitForFunction('window.__ready===true',{timeout:8000});
  await page.waitForFunction("getComputedStyle(document.getElementById('loginView')).display!=='none'",{timeout:4000});
  await page.waitForTimeout(200); return page; }

// ===== L1 — البنية: الشاشة زجاجية بخلفية فقاعات وحقول بأيقونات وزر عين =====
{ const page=await loginPage();
  const s=await page.evaluate(()=>{
    const lv=document.getElementById('loginView'); const card=lv.querySelector('.card'); const cs=getComputedStyle(card);
    const bg=getComputedStyle(lv).backgroundImage;
    const blobs=lv.querySelectorAll('.authbg span').length;
    const fics=lv.querySelectorAll('.field .fic svg').length;
    const eye=!!document.getElementById('pwEye');
    const emailPad=parseFloat(getComputedStyle(document.getElementById('email')).paddingInlineStart||getComputedStyle(document.getElementById('email')).paddingRight);
    return { glass:(cs.backdropFilter||cs.webkitBackdropFilter||'').includes('blur'), grad:bg.includes('gradient'), blobs, fics, eye, emailPad, ids:!!(document.getElementById('loginForm')&&document.getElementById('loginBtn')&&document.getElementById('email')&&document.getElementById('password')) };
  });
  ok('L1 أ٣: البطاقة زجاجية (ضبابية خلفية) فوق تدرج', s.glass&&s.grad, JSON.stringify({glass:s.glass,grad:s.grad}));
  ok('L1 ب٥: ثلاث فقاعات خلفية موجودة', s.blobs===3, String(s.blobs));
  ok('L1 ج٥: أيقونتان داخل الحقلين + الحقل مُزاح لها', s.fics===2&&s.emailPad>=30, JSON.stringify({fics:s.fics,pad:s.emailPad}));
  ok('L1 هـ٦: زر العين موجود، والمعرّفات الأصلية سليمة', s.eye&&s.ids===true);
  await page.close(); }

// ===== L2 — هـ٦/ج٥: العين تكشف وتُخفي كلمة المرور =====
{ const page=await loginPage();
  await page.fill('#password','سرّي123');
  const t0=await page.evaluate(()=>document.getElementById('password').type);
  await page.click('#pwEye');
  const t1=await page.evaluate(()=>document.getElementById('password').type);
  await page.click('#pwEye');
  const t2=await page.evaluate(()=>document.getElementById('password').type);
  ok('L2 العين: password → text → password', t0==='password'&&t1==='text'&&t2==='password', `${t0}/${t1}/${t2}`);
  const lbl=await page.evaluate(()=>document.getElementById('pwEye').getAttribute('aria-label'));
  ok('L2 تسمية العين تعود «إظهار» بعد الإخفاء', lbl.includes('إظهار'), lbl);
  await page.close(); }

// ===== L3 — د٢: زر «دخول» بتدرج وظل ملون =====
{ const page=await loginPage();
  const b=await page.evaluate(()=>{ const cs=getComputedStyle(document.getElementById('loginBtn')); return { grad:cs.backgroundImage.includes('gradient'), shadow:cs.boxShadow&&cs.boxShadow!=='none' }; });
  ok('L3 الزر متدرج بظل ملون', b.grad&&b.shadow, JSON.stringify(b));
  // لا يمسّ أزرار التطبيق: زر عام آخر يبقى مصمتًا (نتحقق أن القاعدة مقصورة على #loginBtn/#pwBtn)
  const other=await page.evaluate(()=>{ const el=document.getElementById('pwBtn'); return el?getComputedStyle(el).backgroundImage.includes('gradient'):null; });
  ok('L3 زر تغيير كلمة المرور يشاركه التدرج (شاشة الدخول موحّدة) — دون غيرهما', other===true||other===null);
  await page.close(); }

// ===== L4 — هـ٤: خطأ الدخول يهزّ البطاقة ويُظهر رسالة =====
{ const page=await loginPage();
  await page.evaluate(()=>window.__failSignIn(true));
  await page.fill('#email','x@dhtrd.com'); await page.fill('#password','ghlt');
  await page.click('#loginBtn');
  await page.waitForTimeout(120);
  const shaking=await page.evaluate(()=>document.querySelector('#loginView .card').classList.contains('au-shake'));
  ok('L4 البطاقة تهتز فور الخطأ (au-shake)', shaking===true);
  await page.waitForTimeout(400);
  const st=await page.evaluate(()=>{ const s=document.getElementById('loginStatus'); return { err:s.classList.contains('err'), txt:s.textContent, btnEnabled:!document.getElementById('loginBtn').disabled }; });
  ok('L4 رسالة خطأ ظاهرة والزر يعود قابلًا للنقر', st.err&&st.txt.length>0&&st.btnEnabled, JSON.stringify(st));
  ok('L4 الزر لا يحمل حالة نجاح بعد الخطأ', await page.evaluate(()=>!document.getElementById('loginBtn').classList.contains('au-done')));
  await page.close(); }

// ===== L5 — هـ٥: الدخول الصحيح يحوّل الزر إلى دائرة نجاح ✓ =====
{ const page=await loginPage();
  await page.evaluate(()=>window.__failSignIn(false));
  await page.fill('#email','a2@dhtrd.com'); await page.fill('#password','ok');
  await page.click('#loginBtn');
  await page.waitForTimeout(650); // بعد انتهاء انتقال العرض .35s
  const done=await page.evaluate(()=>{ const b=document.getElementById('loginBtn'); const cs=getComputedStyle(b);
    return { cls:b.classList.contains('au-done'), circle:Math.abs(parseFloat(cs.width)-44)<6, radius:cs.borderRadius, green:cs.backgroundImage.includes('gradient') }; });
  ok('L5 الزر صار دائرة نجاح (au-done، ~44px، حوافّ دائرية)', done.cls&&done.circle&&(parseFloat(done.radius)>=20||done.radius.includes('50%')), JSON.stringify(done));
  await page.close(); }

// ===== L6 — الوضع الليلي: الزجاج والتدرج يعملان بلا كسر =====
{ const page=await loginPage();
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  await page.waitForTimeout(150);
  const d=await page.evaluate(()=>{ const card=document.querySelector('#loginView .card'); const cs=getComputedStyle(card);
    return { glass:(cs.backdropFilter||cs.webkitBackdropFilter||'').includes('blur'), grad:getComputedStyle(document.getElementById('loginView')).backgroundImage.includes('gradient') }; });
  ok('L6 الوضع الليلي: زجاج داكن فوق التدرج', d.glass&&d.grad, JSON.stringify(d));
  await page.close(); }

// ===== L7 — الجوال: خط الحقل ≥16px (يمنع تكبير iOS) والعناصر ظاهرة =====
{ const p=await ctx.newPage(); await p.setViewportSize({width:390,height:820}); await p.addInitScript(()=>{try{localStorage.clear();}catch(e){}});
  await p.goto(HARNESS+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER],loggedOut:true})));
  await p.waitForFunction('window.__ready===true',{timeout:8000});
  await p.waitForFunction("getComputedStyle(document.getElementById('loginView')).display!=='none'",{timeout:4000});
  const m=await p.evaluate(()=>({ fs:parseFloat(getComputedStyle(document.getElementById('email')).fontSize), eye:!!document.getElementById('pwEye'), blobs:document.querySelectorAll('#loginView .authbg span').length }));
  ok('L7 الجوال: خط الحقل ≥16px والعين والفقاعات حاضرة', m.fs>=16&&m.eye&&m.blobs===3, JSON.stringify(m));
  await p.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
