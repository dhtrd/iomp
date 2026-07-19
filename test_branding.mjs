// اختبارات الهوية والشعار — شعار SVG افتراضي («الصندوق المُتحقَّق») + رفع شعار مخصّص (config/permissions.settings.branding) بأثرٍ فوري في الواجهة والطباعة، وبلا انحدار.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1500} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }

// ===== BR1 — الافتراضي: بلا إعداد ⇒ شعار «الصندوق المُتحقَّق» SVG (لا صورة، لا حرف «ج») =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const b=await page.evaluate(()=>window.__brandingCfg());
  ok('BR1 افتراضي: اسم الشركة مضبوط والشعار فارغ', b && b.companyName==='شركة الضبيبي التجارية' && !b.logo, JSON.stringify(b));
  const mark=await page.evaluate(()=>window.__brandMarkHtml());
  ok('BR1 رمز الشعار الافتراضي = SVG بعلامة تحقّق ذهبية (لا صورة)', mark.includes('<svg') && mark.includes('C9A227') && !mark.includes('<img'), mark.slice(0,60));
  const side=await page.evaluate(()=>{ const el=document.querySelector('.side-brand .m'); return el?el.innerHTML:''; });
  ok('BR1 الشريط الجانبي يعرض الشعار الافتراضي (SVG) لا الحرف «ج»', side.includes('<svg') && !side.includes('ج'), side.slice(0,40));
  await page.close(); }

// ===== BR2 — شعار مخصّص عبر الإعداد ⇒ صورة تحلّ محلّ الافتراضي فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{branding:{companyName:'مؤسسة الضبيبي',logo:DATA_URL}}}});
  const b=await page.evaluate(()=>window.__brandingCfg());
  ok('BR2 الإعداد يعكس الشعار المخصّص واسم الشركة', b.logo===DATA_URL && b.companyName==='مؤسسة الضبيبي', b.companyName);
  const mark=await page.evaluate(()=>window.__brandMarkHtml());
  ok('BR2 رمز الشعار = صورة الشعار المخصّص', mark.includes('<img') && mark.includes(DATA_URL), mark.slice(0,40));
  const side=await page.evaluate(()=>{ window.__applyBrandMarks(); const el=document.querySelector('.side-brand .m'); return {h:el?el.innerHTML:'', c:el?el.classList.contains('has-logo'):false}; });
  ok('BR2 طبع العلامات: الشريط الجانبي صورة + صنف has-logo', side.h.includes('<img') && side.c===true, JSON.stringify({h:side.h.slice(0,30),c:side.c}));
  await page.close(); }

// ===== BR3 — ترويسة الطباعة: افتراضي (مربّع كحلي + اسم)، مخصّص (صورة)، وإخفاء الشعار =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const p=await page.evaluate(()=>window.__printLogoHtml());
  ok('BR3 طباعة افتراضية: مربّع كحلي + SVG + اسم الشركة (لا صورة)', p.includes('<svg') && p.includes('#1F3864') && p.includes('شركة الضبيبي التجارية') && !p.includes('<img'), p.slice(0,50));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{branding:{logo:DATA_URL}}}});
  const p=await page.evaluate(()=>window.__printLogoHtml());
  ok('BR3 طباعة بشعار مخصّص: صورة في الترويسة', p.includes('<img') && p.includes(DATA_URL), p.slice(0,40));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{print:{showLogo:false}}}});
  const p=await page.evaluate(()=>window.__printLogoHtml());
  ok('BR3 «إظهار الشعار» مُطفأ ⇒ لا شعار في الطباعة (يحترم الإعداد)', p==='', 'p='+JSON.stringify(p));
  await page.close(); }

// ===== BR4 — الحفظ من واجهة مركز الإدارة يُثبِّت settings.branding ويُطبَّق فورًا =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  const has=await page.evaluate(()=>window.__has('brFile')&&window.__has('acSaveBranding')&&window.__has('brCompany'));
  await page.evaluate((u)=>{ document.getElementById('brCompany').value='شركة تجريبية'; window.__setBrandingLogo(u); }, DATA_URL);
  await page.evaluate(()=>window.__acSaveBranding()); await page.waitForTimeout(250);
  const saved=await page.evaluate(()=>window.__store['config/permissions'].settings.branding);
  ok('BR4 بطاقة الهوية ظاهرة والحفظ يُثبِّت الشعار والاسم', has && saved && saved.logo===DATA_URL && saved.companyName==='شركة تجريبية', JSON.stringify({has,cn:saved&&saved.companyName}));
  const side=await page.evaluate(()=>{ const el=document.querySelector('.side-brand .m'); return el?el.innerHTML:''; });
  ok('BR4 بعد الحفظ: الشريط الجانبي يعرض الشعار المحفوظ فورًا', side.includes('<img'), side.slice(0,30));
  await page.close(); }

// ===== BR5 — «استخدام الشعار الافتراضي» يزيل الشعار المخصّص ويعيد SVG =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{branding:{companyName:'س',logo:DATA_URL}}}});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  await page.evaluate(()=>window.__acClearLogo()); await page.waitForTimeout(250);
  const saved=await page.evaluate(()=>window.__store['config/permissions'].settings.branding);
  const mark=await page.evaluate(()=>window.__brandMarkHtml());
  ok('BR5 الإزالة تُفرّغ الشعار وتعيد الافتراضي (SVG)', saved && saved.logo==='' && mark.includes('<svg') && !mark.includes('<img'), JSON.stringify({logo:saved&&saved.logo, svg:mark.includes('<svg')}));
  await page.close(); }

// ===== BR6 — تكامل الطباعة: ترويسة محضر مطبوع تتضمّن الشعار الافتراضي واسم الشركة (لا انحدار) =====
const EXI=[[{code:'A',name:'صنف أ',category:'ك',book:10,cost:2},{code:'B',name:'صنف ب',category:'ك',book:5,cost:1}]];
const EXC=[{code:'A',qty:12}];
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    sessions:[{id:'sx',name:'جرد اللجنة',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('committee'); }catch(e){ return 'ERR:'+e.message; } });
  ok('BR6 المحضر المطبوع (افتراضي) يحوي شعار SVG واسم الشركة في الترويسة', typeof html==='string' && html.includes('شركة الضبيبي التجارية') && html.includes('<svg'), (html||'').slice(0,60));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],
    config:{settings:{branding:{logo:DATA_URL,companyName:'مؤسسة الضبيبي'}}},
    sessions:[{id:'sx',name:'جرد اللجنة',status:'approved',location:'فرع أ',itemCount:2,approvedByName:'المالك',__chunks:EXI,__counts:EXC}]});
  await page.evaluate(()=>window.__openReport('sx')); await page.waitForTimeout(450);
  const html=await page.evaluate(()=>{ try{ return window.__buildReasonPrint('committee'); }catch(e){ return 'ERR:'+e.message; } });
  ok('BR6 المحضر المطبوع (مخصّص) يحوي صورة الشعار في الترويسة', typeof html==='string' && html.includes(DATA_URL), (html||'').slice(0,60));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
