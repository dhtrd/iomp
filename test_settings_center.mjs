// اختبارات المحطّة ٢ (مركز الإعدادات الموحّد) — إعدادات المخرجات المركزية (طباعة/تصدير/تقارير) المقادة بـ config/permissions.settings.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1200,height:1500} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(120); }

// ===== SC1 — الافتراضات المعقولة حين لا إعداد =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const cfg=await page.evaluate(()=>({ p:window.__printCfg(), e:window.__exportCfg(), r:window.__reportCfg() }));
  ok('SC1 افتراضات الطباعة (A4/عمودي/شعار/أرقام صفحات)', cfg.p.paperSize==='A4'&&cfg.p.orientation==='portrait'&&cfg.p.showLogo===true&&cfg.p.showPageNumbers===true&&cfg.p.fontSize===11, JSON.stringify(cfg.p));
  ok('SC1 افتراضات التصدير والتقارير', cfg.e.includeFilters===true&&cfg.r.defaultReport==='executive', JSON.stringify({e:cfg.e,r:cfg.r}));
  await page.close(); }

// ===== SC2 — الإعداد المحفوظ يقود القيم =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{ print:{paperSize:'A5',orientation:'landscape',showLogo:false,headerText:'ترويسة'}, export:{includeFilters:false}, report:{defaultReport:'abc'} }}});
  const cfg=await page.evaluate(()=>({ p:window.__printCfg(), e:window.__exportCfg(), r:window.__reportCfg() }));
  ok('SC2 الطباعة تعكس المحفوظ (A5/أفقي/بلا شعار/ترويسة)', cfg.p.paperSize==='A5'&&cfg.p.orientation==='landscape'&&cfg.p.showLogo===false&&cfg.p.headerText==='ترويسة', JSON.stringify(cfg.p));
  ok('SC2 التصدير/التقرير يعكسان المحفوظ', cfg.e.includeFilters===false&&cfg.r.defaultReport==='abc', JSON.stringify({e:cfg.e,r:cfg.r}));
  await page.close(); }

// ===== SC3 — دورة الحفظ من الواجهة تُثبِّت الإعدادات في config =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  const hasCard=await page.evaluate(()=>window.__has('acSaveOutput')&&window.__has('opPaper'));
  ok('SC3 بطاقة إعدادات المخرجات ظاهرة في مركز الإدارة', hasCard===true);
  await page.evaluate(()=>{ document.getElementById('opPaper').value='Letter'; document.getElementById('opOrient').value='landscape'; document.getElementById('opFont').value='13'; document.getElementById('opHeader').value='شركة الضبيبي'; document.getElementById('opFooter').value='سرّي'; document.getElementById('opWater').value='مسودة'; document.getElementById('opLogo').checked=false; document.getElementById('opPageNum').checked=true; document.getElementById('opExpFilters').checked=false; document.getElementById('opReport').value='sessions'; });
  await page.evaluate(()=>window.__acSaveOutput()); await page.waitForTimeout(250);
  const saved=await page.evaluate(()=>{ const s=window.__store['config/permissions'].settings; return {print:s.print, export:s.export, report:s.report}; });
  ok('SC3 إعدادات الطباعة حُفظت في config', saved.print&&saved.print.paperSize==='Letter'&&saved.print.orientation==='landscape'&&saved.print.fontSize===13&&saved.print.headerText==='شركة الضبيبي'&&saved.print.watermark==='مسودة'&&saved.print.showLogo===false&&saved.print.showPageNumbers===true, JSON.stringify(saved.print));
  ok('SC3 إعدادات التصدير والتقارير حُفظت', saved.export&&saved.export.includeFilters===false&&saved.report&&saved.report.defaultReport==='sessions', JSON.stringify({e:saved.export,r:saved.report}));
  const cfgAfter=await page.evaluate(()=>window.__printCfg());
  ok('SC3 printCfg() يعكس المحفوظ مباشرةً (أثر فوري)', cfgAfter.paperSize==='Letter'&&cfgAfter.fontSize===13, JSON.stringify(cfgAfter));
  await page.close(); }

// ===== SC4 (بدء المحطّة ٣) — الطباعة تحترم إعدادات المخرجات المركزية =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{print:{showLogo:false,headerText:'ترويسة مخصّصة',footerText:'تذييل سرّي',watermark:'مسودة',fontSize:14}}}});
  await page.evaluate(()=>window.__setTab('reports')); await page.waitForTimeout(300);
  const html=await page.evaluate(()=>{ try{ return window.__repxPrintHtml('executive'); }catch(e){ return 'ERR:'+e.message; } });
  ok('SC4 الطباعة تُظهر الترويسة/التذييل/العلامة المائية المركزية', html.indexOf('ترويسة مخصّصة')>=0 && html.indexOf('تذييل سرّي')>=0 && html.indexOf('مسودة')>=0, html.slice(0,100));
  ok('SC4 إخفاء الشعار وحجم الخط ١٤ مُطبَّقان', html.indexOf('font-size:18px;font-weight:700')<0 && html.indexOf('font-size:14px')>=0, 'logo/font');
  await page.close(); }

// ===== SC5 (المحطّة ٥) — التواقيع القابلة للتهيئة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const def=await page.evaluate(()=>window.__docSignatories());
  ok('SC5 الافتراض = لجنة ثلاثية (رئيس + عضوان)', Array.isArray(def)&&def.length===3&&def[0].label==='رئيس اللجنة', JSON.stringify(def));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{signatories:[{key:'fin_mgr',label:'المدير المالي'},{key:'gm',label:'المدير العام'}]}}});
  const cfg=await page.evaluate(()=>window.__docSignatories());
  ok('SC5 التواقيع المهيّأة تعكس المحفوظ (المالي ثم العام)', cfg.length===2&&cfg[0].label==='المدير المالي'&&cfg[1].label==='المدير العام', JSON.stringify(cfg));
  await page.close(); }

// ===== SC6 (المحطّة ٥) — حفظ التواقيع المختارة من الواجهة بالترتيب المعياري =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  await page.evaluate(()=>window.__setTab('admin')); await page.waitForTimeout(200);
  const hasSigs=await page.evaluate(()=>window.__has('opSigs'));
  await page.evaluate(()=>{ document.querySelectorAll('#opSigs .opsig').forEach(c=>{ c.checked=(c.value==='inv_mgr'||c.value==='wh_mgr'||c.value==='gm'); }); });
  await page.evaluate(()=>window.__acSaveOutput()); await page.waitForTimeout(200);
  const sigs=await page.evaluate(()=>window.__store['config/permissions'].settings.signatoryDefaults);
  ok('SC6 المسمّيات الافتراضية ظاهرة وحُفظت بالترتيب', hasSigs&&Array.isArray(sigs)&&sigs.length===3&&sigs[0].title==='مدير الجرد'&&sigs[1].title==='مدير المستودع'&&sigs[2].title==='المدير العام', JSON.stringify(sigs));
  await page.close(); }

// ===== SC7 (المحطّة ٣) — أعمدة التقرير المفصّل قابلة للتهيئة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const def=await page.evaluate(()=>window.__docColumns());
  ok('SC7 أعمدة المفصّل الافتراضية (١٢ عمودًا، تبدأ بالكود)', Array.isArray(def)&&def.length===12&&def[0]==='code', JSON.stringify(def).slice(0,90));
  await page.close(); }
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{export:{columns:['name','counted','diff']}}}});
  const cfg=await page.evaluate(()=>window.__docColumns());
  ok('SC7 أعمدة مهيّأة تعكس المحفوظ (اسم/معدود/فرق)', JSON.stringify(cfg)===JSON.stringify(['name','counted','diff']), JSON.stringify(cfg));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
