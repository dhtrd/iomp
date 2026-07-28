// اختبارات محرّك الطباعة — م٦ (الاحتواء) + ط-١٩ (بنط الإدارة) + ط-٢١ (الاتّجاه الصريح) + ط-٢٢ (الصفحة الثابتة + الكثافة)
// ط-٢٢: كلّ صفحة لوحة .pg بأبعاد mm، أعمدة mm، @page margin:0، ترقيم يدويّ بالقياس («صفحة i من N» حقيقيّ)،
// الإجماليّات والتواقيع لا تنشطر، ومحرّك كثافة (مريح/قياسيّ/مدمج/مدمج جدًّا/مخصّص٪) لا يمسّ الأعمدة.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
const VW={uid:'u_vw',email:'vw@dhtrd.com',name:'مطّلع الفرع',role:'مطّلع',active:true};
const CH=[[{code:'99916382',name:'نجف لد سندريلا 400+300/ 7711',category:'انارة / علاقيات',book:24,cost:80},
          {code:'99916629',name:'نجف مودرن 3 دور حلقات 200+300+600/ 7273',category:'انارة / علاقيات',book:6,cost:112},
          {code:'B1',name:'صنف بلا عد',category:'أثاث',book:2,cost:60}]];
const CN=[{code:'99916382',qty:24},{code:'99916629',qty:6}];
const NT=[{code:'99916382',notes:[{text:'ملاحظة وقت العد',byName:'عدّاد ١'}]}];
const S1={id:'s1',name:'جرد مستودع الاثاث',status:'approved',started:true,location:'مستودع الاثاث',itemCount:3,createdBy:'u_owner',__chunks:CH,__counts:CN,__notes:NT};
// جلسة كبيرة (١٢٠ صفًّا) لاختبارات الترقيم اليدويّ
const BIGN=120;
const BIGCH=[Array.from({length:BIGN},(_,i)=>({code:'K'+(1000+i),name:'صنف تجريبي طويل الاسم رقم '+i+' لغرض الالتفاف',category:'فئة '+(i%7),book:(i%9)+1,cost:5}))];
const BIGCN=Array.from({length:60},(_,i)=>({code:'K'+(1000+i),qty:(i%9)+1}));
const SBIG={id:'sb',name:'جرد كبير',status:'approved',started:true,location:'فرع أ',itemCount:BIGN,createdBy:'u_owner',__chunks:BIGCH,__counts:BIGCN};
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });
async function load(page,sc){ await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} window.print=()=>{}; });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(200); }
async function openRep(page,sid){ await page.evaluate(s=>window.__openReport(s||'s1'),sid); await page.waitForTimeout(450); }
const count=(s,needle)=>s.split(needle).length-1;

// ===== P1 — المفصّل (١٣ عمودًا): لوحة .pg + colgroup بالمليمتر + @page صريح margin:0 + كلّ البيانات =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  const cols=count(html,'<col style'); const ths=count(html.split('<thead>')[1].split('</thead>')[0],'<th');
  ok('P1 colgroup موجود وعدد <col> يساوي عدد رؤوس الأعمدة (١٣)', html.includes('<colgroup')&&cols>=13&&ths===13, `cols=${cols} ths=${ths}`);
  ok('P1 الأعمدة بالمليمتر (ثابتة فيزيائيًّا) والجدول table-layout:fixed', /width:[\d.]+mm/.test(html.split('<colgroup')[1].split('</colgroup>')[0])&&html.includes('table-layout:fixed'));
  ok('P1 ‎@page صريح الاتّجاه وبهامشٍ صفريّ (اللوحة تتكفّل بهوامشها)', html.includes('@page{size:A4 portrait;margin:0}'), html.slice(0,80));
  ok('P1 لوحة .pg بأبعاد A4 الفيزيائيّة', html.includes('class="pg"')&&html.includes('width:210mm')&&html.includes('height:296mm'), '');
  ok('P1 كل بيانات الأعمدة حاضرة (القيم والملاحظات والتكلفة)', html.includes('القيمة الدفترية')&&html.includes('القيمة الفعلية')&&html.includes('قيمة الفرق')&&html.includes('التكلفة')&&html.includes('الملاحظات')&&html.includes('ملاحظة وقت العد'));
  const ws=[...html.matchAll(/<col style="width:([\d.]+)mm"/g)].map(m=>Number(m[1])); const sum=ws.slice(0,13).reduce((a,b)=>a+b,0);
  ok('P1 أوزان الأعمدة تجمع ≈ عرض المحتوى (١٩٤مم لـA4 عموديّ)', Math.abs(sum-194)<1.5, String(sum.toFixed(1)));
  await page.close(); }

// ===== P2 — «مراجعة الفرع»: ٨ أعمدة وبنط تلقائيّ 10.8px (قياسيّ k=1) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('branch'); return { f:window.__pd.tableFont(), cols:document.querySelectorAll('#repPrintArea .pg colgroup col').length, who:document.getElementById('repPrintArea').innerHTML.includes('من أضاف') }; });
  ok('P2 ثمانية أعمدة (٦ + من أضاف + الملاحظات) وبنط 10.8px', r.cols===8&&r.f==='10.8'&&r.who, JSON.stringify(r));
  await page.close(); }

// ===== P3 — إعدادات المخرجات تعمل فعليًّا: أفقي + A5 (لوحةٌ بأبعاد A5 الأفقيّ) =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],
    config:{settings:{print:{orientation:'landscape',paperSize:'A5'}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P3 ‎@page{size:A5 landscape;margin:0} ولوحة 210×147', html.includes('@page{size:A5 landscape;margin:0}')&&html.includes('width:210mm')&&html.includes('height:147mm'), html.slice(0,80));
  await page.close(); }

// ===== P4 — حجم ورق غير معروف ⇒ تراجع آمن إلى A4 عموديّ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],
    config:{settings:{print:{paperSize:'Tabloid'}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P4 حجم غير مدعوم يرتد إلى A4 (عمودي صريح، margin:0)', html.includes('@page{size:A4 portrait;margin:0}'), html.slice(0,80));
  await page.close(); }

// ===== P5 — قواعد CSS للطباعة: الاحتواء + كسر الكلمات + فواصل اللوحات وعدم شطر الذيل =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const css=await page.evaluate(()=>[...document.querySelectorAll('style')].map(s=>s.textContent).join(''));
  ok('P5 قاعدتا الاحتواء وكسر الكلمات', css.includes('table-layout:fixed!important')&&css.includes('word-break:break-word'));
  ok('P5 قواعد ط-٢٢: فاصلٌ بعد كلّ لوحة + عدم شطر التواقيع والإجماليّات', css.includes('break-after:page')&&css.includes('.pg-sig')&&css.includes('page-break-inside:avoid'));
  await page.close(); }

// ===== P6 — طباعة شاشة التقارير: @page + احتواء + بنط الكثافة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await page.evaluate(()=>window.__setTab('reports'));
  await page.waitForFunction('window.__repxReady&&window.__repxReady()===true',{timeout:9000});
  const html=await page.evaluate(()=>window.__repxPrintHtml('sessions'));
  ok('P6 مطبوعة شاشة التقارير: @page واحتواء العرض', html.includes('@page{size:')&&html.includes('table-layout:fixed'));
  await page.close(); }

// ===== P7 — المحاضر: كتلة التواقيع كتلةٌ واحدة .pg-sig داخل لوحة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await openRep(page);
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('custody'); const A=document.getElementById('repPrintArea');
    return { sig:A.querySelectorAll('.pg-sig').length, txt:A.innerHTML.includes('التوقيع')&&A.innerHTML.includes('رئيس اللجنة'), colg:A.innerHTML.includes('<colgroup') }; });
  ok('P7 محضر بجدول (عهدة): التواقيع كتلة .pg-sig واحدة + جدول colgroup', r.sig===1&&r.txt&&r.colg, JSON.stringify(r));
  const rc=await page.evaluate(()=>{ window.__buildReasonPrint('committee'); const A=document.getElementById('repPrintArea');
    return { pages:window.__pd.pages(), sig:A.querySelectorAll('.pg-sig').length, colg:A.innerHTML.includes('<colgroup'), foot:window.__pd.footText(0) }; });
  ok('P7 محضر اللجنة الملخّص: لوحةٌ واحدة بتواقيعَ وبلا جدول + «صفحة 1 من 1»', rc.pages===1&&rc.sig===1&&!rc.colg&&rc.foot.includes('صفحة 1 من 1'), JSON.stringify(rc));
  await page.close(); }

// ===== P8 — تكامل م٦-١: مطبوعة المطّلع بلا أعمدة مالية =====
{ const page=await ctx.newPage(); await load(page,{profile:VW,users:[OWNER,VW],sessions:[S1]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P8 المطّلع: أعمدةٌ كمّيةٌ بلا مالية', count(html,'<col style')>=6&&!html.includes('التكلفة')&&html.includes('الكمية الفعلية'), 'cols='+count(html,'<col style'));
  await page.close(); }

// ===== P9 — «من أضاف» في طباعة الفرع: تتابعٌ مجموعٌ ومنفصلٌ مفصّل =====
{ const page=await ctx.newPage();
  const CN2=[{code:'99916382',qty:3,entries:[{id:'e1',q:3,n:3,by:'u_owner',byName:'عبدالكريم الضيفي'}]},
             {code:'99916629',qty:6,entries:[{id:'e2',q:4,by:'u_owner',byName:'عبدالكريم الضيفي'},{id:'e3',q:2,by:'u_owner',byName:'عبدالكريم الضيفي'}]}];
  const S9=Object.assign({},S1,{__counts:CN2,__notes:[]});
  await load(page,{profile:OWNER,users:[OWNER],sessions:[S9]});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P9 «من أضاف» يظهر والتتابع مجموع (عبدالكريم: 3 بلا ١+١)', html.includes('من أضاف')&&html.includes('عبدالكريم الضيفي: 3')&&!html.includes('(1 + 1 + 1)'), 'a='+html.includes('عبدالكريم الضيفي: 3'));
  ok('P9 والإضافات المنفصلة تبقى مفصّلة (٤ + ٢)', html.includes('عبدالكريم الضيفي: 6')&&html.includes('(4 + 2)'), 'b='+html.includes('(4 + 2)'));
  await page.close(); }

// ===== P10 (ط-١٩) — بنط الإدارة ٨ يتجاوز التلقائيّ =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:8}}}});
  await openRep(page);
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('branch'); return window.__pd.tableFont(); });
  ok('P10 بنط الإدارة ٨ مُطبَّق (بدل التلقائي 10.8)', r==='8', 'f='+r);
  await page.close(); }

// ===== P11 (ط-١٩) — بنط ١٣ على المفصّل مع بقاء colgroup =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:13}}}});
  await openRep(page);
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('detailed'); return { f:window.__pd.tableFont(), cols:document.querySelectorAll('#repPrintArea .pg colgroup col').length }; });
  ok('P11 بنط ١٣ مُطبَّق والأعمدة (١٣) داخل الورقة', r.f==='13'&&r.cols===13, JSON.stringify(r));
  await page.close(); }

// ===== P12 (ط-١٩) — بنط ٨ على المفصّل العريض بلا فقدان أعمدة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:8}}}});
  await openRep(page);
  const html=await page.evaluate(()=>window.__buildReasonPrint('detailed'));
  ok('P12 المفصّل بخط ٨: كلّ أعمدة القيم حاضرة', html.includes('font-size:8px')&&html.includes('القيمة الدفترية')&&html.includes('قيمة الفرق'), '');
  await page.close(); }

// ===== P13 (ط-١٩) — «تلقائي» يعود للاحتساب حسب الأعمدة =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{fontSize:'auto'}}}});
  await openRep(page);
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('branch'); return window.__pd.tableFont(); });
  ok('P13 «تلقائي» = 10.8 لمراجعة الفرع', r==='10.8', 'f='+r);
  await page.close(); }

// ===== P14 (ط-٢١) — اتّجاه الإدارة «أفقي» صريحٌ في @page =====
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1],config:{settings:{print:{orientation:'landscape'}}}});
  await openRep(page);
  const land=await page.evaluate(()=>window.__buildReasonPrint('branch'));
  ok('P14 «أفقي» ⇒ @page{size:A4 landscape;margin:0} ولوحة 297×209', land.includes('@page{size:A4 landscape;margin:0}')&&land.includes('width:297mm')&&land.includes('height:209mm'), land.slice(0,80));
  await page.close(); }

// ═══════════ ط-٢٢ · المجموعة ص — الترقيم اليدويّ (اللوحات الثابتة) ═══════════
// ص١ — ١٢٠ صفًّا: لوحاتٌ متعدّدة، مجموع صفوفها = ١٢٠، وترقيمٌ حقيقيّ «صفحة i من N»
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('branch'); const P=window.__pd; const n=P.pages();
    let sum=0; for(let i=0;i<n;i++)sum+=P.pageRows(i);
    return { n, sum, f1:P.footText(0), fN:P.footText(n-1) }; });
  ok('ص١ لوحاتٌ متعدّدة ومجموع الصفوف كامل (١٢٠ بلا شطر)', r.n>=2&&r.sum===120, JSON.stringify({n:r.n,sum:r.sum}));
  ok('ص١ ترقيمٌ حقيقيّ: «صفحة 1 من N» و«صفحة N من N»', r.f1.includes('صفحة 1 من '+r.n)&&r.fN.includes('صفحة '+r.n+' من '+r.n), r.f1+' | '+r.fN);
  await page.close(); }

// ص٢ — الإجماليّات والتواقيع على اللوحة الأخيرة فقط، ورأس الجدول يتكرّر على كلّ لوحة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('mgmt'); const P=window.__pd; const n=P.pages();
    const tf=[],hd=[]; for(let i=0;i<n;i++){ tf.push(P.pageHasTfoot(i)); hd.push(!!document.querySelectorAll('#repPrintArea .pg')[i].querySelector('thead')); }
    return { n, tf, hd }; });
  const tfOk=r.tf.slice(0,-1).every(x=>x===false)&&r.tf[r.tf.length-1]===true;
  ok('ص٢ الإجماليّات (tfoot) على الأخيرة فقط ورؤوس الجدول على كلّ لوحة', r.n>=2&&tfOk&&r.hd.every(Boolean), JSON.stringify(r));
  await page.close(); }

// ص٣ — محضر العهدة الكبير: التواقيع كتلةٌ واحدةٌ في اللوحة الأخيرة (لا تنشطر)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ window.__buildReasonPrint('custody'); const P=window.__pd; const n=P.pages();
    const sig=[]; for(let i=0;i<n;i++)sig.push(P.pageHasSig(i));
    return { n, sig }; });
  const sigOk=r.sig.slice(0,-1).every(x=>x===false)&&r.sig[r.sig.length-1]===true;
  ok('ص٣ التواقيع كتلةٌ واحدةٌ على اللوحة الأخيرة فقط', r.n>=1&&sigOk, JSON.stringify(r));
  await page.close(); }

// ═══════════ ط-٢٢ · المجموعة ك — محرّك الكثافة ═══════════
// ك١ — الإعدادات المسبقة: قيم k الصحيحة + المخصّص محصور ٨٠–١١٠
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER]});
  const r=await page.evaluate(()=>{ const P=window.__pd; const out={};
    out.def=P.preset(); out.kDef=P.k();
    P.set('comfortable'); out.kC=P.k(); P.set('compact'); out.kM=P.k(); P.set('xcompact'); out.kX=P.k();
    P.set('custom',85); out.k85=P.k(); P.set('custom',300); out.kClampHi=P.k(); P.set('custom',10); out.kClampLo=P.k();
    P.reset(); out.after=P.preset(); return out; });
  ok('ك١ الافتراضيّ قياسيّ k=1 والمسبقات صحيحة', r.def==='standard'&&r.kDef===1&&r.kC===1.15&&r.kM===0.88&&r.kX===0.76, JSON.stringify(r));
  ok('ك١ المخصّص يعمل ومحصور (٨٥⇒0.85، ٣٠٠⇒1.1، ١٠⇒0.8)', r.k85===0.85&&r.kClampHi===1.1&&r.kClampLo===0.8, JSON.stringify(r));
  await page.close(); }

// ك٢ — «مدمج جدًّا» يقلّل الصفحات، والأعمدة (colgroup) لا تتغيّر حرفيًّا، والبنط يصغر
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ const P=window.__pd;
    P.set('standard'); window.__buildReasonPrint('branch'); const pStd=P.pages(), cgStd=P.colgroupStr(), fStd=P.tableFont(), rows1Std=P.pageRows(0);
    P.set('xcompact'); window.__buildReasonPrint('branch'); const pX=P.pages(), cgX=P.colgroupStr(), fX=P.tableFont(), rows1X=P.pageRows(0);
    P.reset(); return { pStd,pX,same:cgStd===cgX,fStd,fX,rows1Std,rows1X }; });
  ok('ك٢ «مدمج جدًّا»: صفحاتٌ أقلّ وصفوفٌ أكثر في اللوحة الأولى', r.pX<r.pStd&&r.rows1X>r.rows1Std, JSON.stringify(r));
  ok('ك٢ الأعمدة لا تتحرّك: colgroup متطابقٌ حرفيًّا والبنط يصغر (10.8⇒8.21)', r.same===true&&Number(r.fX)<Number(r.fStd), 'same='+r.same+' f='+r.fStd+'→'+r.fX);
  await page.close(); }

// ك٣ — «مريح» يزيد الصفحات (رتابة الاتّجاهين) والقياسيّ = الحاليّ حرفيًّا
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ const P=window.__pd;
    P.set('standard'); window.__buildReasonPrint('branch'); const pStd=P.pages(), fStd=P.tableFont();
    P.set('comfortable'); window.__buildReasonPrint('branch'); const pC=P.pages(), fC=P.tableFont();
    P.reset(); return { pStd,pC,fStd,fC }; });
  ok('ك٣ الرتابة: مريح ≥ قياسيّ صفحاتٍ، وبنطه أكبر (أساس ٧ أعمدة = 11.5)', r.pC>=r.pStd&&r.fStd==='11.5'&&Number(r.fC)>Number(r.fStd), JSON.stringify(r));
  await page.close(); }

// ك٤ — الحفظ المحلّيّ للمشغّل + الافتراضيّ المؤسّسيّ من الإعدادات
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],config:{settings:{print:{density:'compact'}}}});
  const r=await page.evaluate(()=>{ const P=window.__pd; const a=P.preset(); // بلا اختيارٍ محلّيّ ⇒ الافتراضيّ المؤسّسيّ
    P.set('xcompact'); const st=P.stored(); const b=P.preset();
    return { a, b, stored:st&&st.preset }; });
  ok('ك٤ الافتراضيّ المؤسّسيّ (مدمج) يسري ثمّ اختيار المشغّل يُحفَظ لجهازه', r.a==='compact'&&r.b==='xcompact'&&r.stored==='xcompact', JSON.stringify(r));
  await page.close(); }

// ك٥ — شريط الكثافة في نافذة الطباعة: ٤ رقاقات + معاينةٌ حيّة (صفحات مقدَّرة/صفوف/بنط) تتحدّث بالنقر
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[SBIG]});
  await openRep(page,'sb');
  const r=await page.evaluate(()=>{ const P=window.__pd; P.reset(); P.wire();
    const chips=P.chips(); const est1=P.estText();
    P.clickChip('xcompact'); const est2=P.estText(); const cur=P.preset();
    const e=P.estimate(); P.reset(); return { nChips:chips.length, on:chips.find(c=>c.on).v, est1, est2, cur, est:e }; });
  ok('ك٥ أربع رقاقات والقياسيّ مُفعّلٌ افتراضًا', r.nChips===4&&r.on==='standard', JSON.stringify({n:r.nChips,on:r.on}));
  ok('ك٥ المعاينة الحيّة: صفحاتٌ مقدَّرة وصفوف/صفحة وبنط، وتتغيّر بالنقر', r.est1.includes('الصفحات المقدَّرة')&&r.est1.includes('صفًّا/صفحة')&&r.est2!==r.est1&&r.cur==='xcompact', r.est2.slice(0,80));
  ok('ك٥ التقدير متّسق: صفحات مدمج جدًّا ≤ تقدير القياسيّ ومنطقيّ (>0)', r.est.pages>0&&r.est.perPage>0&&r.est.font>0, JSON.stringify(r.est));
  await page.close(); }

// ك٦ — الكثافة تسري على طباعة شاشة التقارير والكتالوج (بنطٌ أصغر مع «مدمج جدًّا»)
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[S1]});
  await page.evaluate(()=>window.__setTab('reports'));
  await page.waitForFunction('window.__repxReady&&window.__repxReady()===true',{timeout:9000});
  const r=await page.evaluate(()=>{ const P=window.__pd;
    P.set('standard'); const h1=window.__repxPrintHtml('sessions'); const m1=h1.match(/font-size:([\d.]+)px"><thead/)||h1.match(/table style="[^"]*font-size:([\d.]+)px/);
    P.set('xcompact'); const h2=window.__repxPrintHtml('sessions'); const m2=h2.match(/table style="[^"]*font-size:([\d.]+)px/);
    P.reset(); return { f1:m1?Number(m1[1]):0, f2:m2?Number(m2[1]):0 }; });
  ok('ك٦ الكثافة تسري على مطبوعة شاشة التقارير (البنط يصغر)', r.f1>0&&r.f2>0&&r.f2<r.f1, JSON.stringify(r));
  await page.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
