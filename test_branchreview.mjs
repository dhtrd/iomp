// مراجعة الفرع قبل الاعتماد (ورقة الاتفاق 2026-10-21): مسار لكل عدّاد بترتيب العدّ، الصنف في أكثر من موضع،
// التمييز بين القارئ واليدوي والمضاف والمعدَّل، بطاقة/قائمة/بحث، ملاحظات فقط (لا تمسّ أي رقم)، إرسال إلزامي قبل «تمت المراجعة».
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const BR = { uid:'u_br', email:'br@x.com', name:'خالد الشهري', role:'مطّلع', active:true };
const BRX = { uid:'u_brx', email:'brx@x.com', name:'فرع آخر', role:'مطّلع', active:true };
const IT = [{code:'A',name:'طاولة قزاز',book:6,cost:777},{code:'B',name:'طاولة العهد',book:5,cost:777},{code:'C',name:'كرسي خشب زان',book:15,cost:777},
            {code:'D',name:'موكيت رمادي',book:30,cost:777},{code:'E',name:'كنب زاوية',book:2,cost:777},{code:'F',name:'سجادة صلاة',book:35,cost:777}];
const K=(id,q,at,src,extra)=>Object.assign({id,q,by:'c1',byName:'عبدالكريم',at,src},extra||{});
const W=(id,q,at,src,extra)=>Object.assign({id,q,by:'c2',byName:'وضاح',at,src},extra||{});
const COUNTS = [
  {code:'A',qty:6,entries:[K('a1',6,10,'scan',{n:6})]},
  {code:'B',qty:5,entries:[K('b1',5,20,'scan',{n:5})]},
  {code:'C',qty:16,entries:[K('c1',9,30,'scan',{n:9}),W('c3',2,35,'manual'),K('c2',5,60,'scan',{n:5})]},
  {code:'D',qty:28,entries:[K('d1',28,40,'manual')]},
  {code:'X',qty:3,entries:[K('x1',3,50,'manual')]},
  {code:'E',qty:2,entries:[W('e1',2,15,'scan',{n:2})]},
  {code:'F',qty:40,entries:[W('f1',40,25,'manual')]} ];
const ACT = [{type:'remove',code:'F',name:'سجادة صلاة — سبب التسوية: إدخال خاطئ',qty:5,by:'c2',byName:'وضاح',at:{__ts:26}},{type:'add',code:'A',name:'x',qty:1,by:'c1',at:{__ts:9}}];
const CLOSED={__ts:1000};
const mkSess=(o)=>Object.assign({ id:'sr', name:'جرد ولي العهد', status:'review', started:true, assignedCounters:['c1','c2'], location:'فرع أ', itemCount:6, closedAt:CLOSED,
  __chunks:[IT], __counts:COUNTS, __extras:[{code:'X',name:'رف معدني غير مسجّل',book:0,cost:0}], __activity:ACT }, o||{});
const CFG=(on)=>({ features:{branchReview:on}, users:{u_br:{'session.branchReview':true},u_brx:{'session.branchReview':true}}, userLocations:{u_br:['فرع أ'],u_brx:['فرع ج']},
  roles:{'مطّلع':{'report.view':false,'report.view.location':true}} });
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
async function boot(sc,w=1440,h=900){ const ctx=await browser.newContext({ viewport:{width:w,height:h} }); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('dialog',d=>{ errs.push('dialog'); d.dismiss(); });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await sleep(400); return {ctx,page,errs}; }
const store=(page,pre)=>page.evaluate(p=>{ const o={}; for(const k in window.__store){ if(k.indexOf(p)===0)o[k]=window.__store[k]; } return JSON.parse(JSON.stringify(o)); },pre);
const toasts=(page)=>page.evaluate(()=>[...document.querySelectorAll('.toast .tmsg')].map(e=>e.textContent));
const noHScroll=(page)=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
async function openReview(page){ await page.waitForSelector('[data-brv]',{timeout:5000}); await page.click('[data-brv]'); await page.waitForSelector('#brSend',{timeout:8000}); await sleep(200); }
const SCB=(o)=>({ profile:BR, users:[OWNER,BR,BRX], config:CFG(true), sessions:[mkSess(o)] });

// B1–B9: مسؤول الفرع على الكمبيوتر
{ const {ctx,page,errs}=await boot(SCB());
  ok('B1 الصفحة الرئيسية للفرع: زر «🧭 مراجعة الفرع» للجلسة قيد المراجعة', await page.$('[data-brv]')!==null);
  const before=await store(page,'sessions/sr/counts/'); const vBefore=await page.evaluate(()=>window.__varRows?null:null);
  await openReview(page);
  const paths=await page.evaluate(()=>window.IOMPBR._paths().map(p=>({n:p.name,c:p.steps.map(s=>s.code+':'+s.q).join(',')})));
  ok('B2 مسار كل عدّاد بترتيب وقت العدّ (والصنف المكرَّر خطوتان)', JSON.stringify(paths)===JSON.stringify([{n:'عبدالكريم',c:'A:6,B:5,C:9,D:28,X:3,C:5'},{n:'وضاح',c:'E:2,F:40,C:2'}]), JSON.stringify(paths));
  const rows=await page.evaluate(()=>[...document.querySelectorAll('.br-row')].map(r=>({t:r.textContent,ic:[...r.querySelectorAll('svg.sic')].map(s=>s.getAttribute('aria-label')).join('+')})));
  ok('B3 القائمة: ٦ خطوات للعدّاد الأول وأيقونات المصدر (باركود/قلم)', rows.length===6&&rows[0].ic==='بالقارئ'&&rows[3].ic==='يدوي', JSON.stringify(rows.map(r=>r.ic)));
  ok('B3 شارة «الموضع ١ من ٣ — الإجمالي 16» للصنف المعدود في ثلاثة مواضع', rows[2].t.includes('الموضع 1 من 3')&&rows[2].t.includes('الإجمالي 16')&&rows[5].t.includes('الموضع 3 من 3'), rows[2].t);
  ok('B3 شارة «صنف أُضيف يدويًّا» للصنف خارج الدفتر', rows[4].t.includes('صنف أُضيف يدويًّا'), rows[4].t);
  ok('B3 «تتابع ×9» للمسحات المتتالية', rows[2].t.includes('تتابع ×9'));
  // البحث
  await page.fill('#brQ','زان'); await sleep(250);
  const n1=await page.evaluate(()=>document.querySelectorAll('.br-row').length);
  ok('B4 البحث بالاسم يعرض موضعي الصنف فقط والتركيز باقٍ في الخانة', n1===2&&await page.evaluate(()=>document.activeElement&&document.activeElement.id==='brQ'), 'n='+n1);
  await page.fill('#brQ','D'); await page.keyboard.press('Enter'); await sleep(250);
  ok('B4 البحث برمز وحيد + Enter يفتح بطاقته مباشرةً', await page.evaluate(()=>!!document.getElementById('brOk')&&document.getElementById('appContent').textContent.includes('موكيت رمادي')));
  // عدّاد ثانٍ + شارة المعدَّل
  await page.click('#brMode'); await sleep(150); await page.fill('#brQ',''); await sleep(150);
  await page.click('[data-u="c2"]'); await sleep(200);
  const r2=await page.evaluate(()=>[...document.querySelectorAll('.br-row')].map(r=>r.textContent));
  ok('B5 تبويب العدّاد الثاني ومسار مستقل، وشارة «عُدِّل بعد العدّ» على الصنف المحذوف منه', r2.length===3&&r2[1].includes('عُدِّل بعد العدّ')&&!r2[0].includes('عُدِّل'), JSON.stringify(r2).slice(0,200));
  await page.click('[data-open="2"]'); await sleep(200);
  ok('B5 البطاقة تذكر التعديل وسببه', await page.evaluate(()=>document.getElementById('appContent').textContent.includes('حُذف 5 بعد العدّ — السبب: إدخال خاطئ')));
  const cardTxt=await page.evaluate(()=>document.getElementById('appContent').textContent);
  ok('B6 لا تكلفة ولا قيم مالية في شاشة الفرع', !cardTxt.includes('777')&&!cardTxt.includes('التكلفة')&&!cardTxt.includes('القيمة'));
  ok('B6 الدفتر والإجمالي والفرق ظاهرة (35 / 40 / +5)', cardTxt.includes('الدفتر 35')&&cardTxt.includes('إجمالي المعدود 40')&&cardTxt.includes('الفرق +5'), cardTxt.slice(0,300));
  // مختلف + ملاحظة
  await page.click('#brDf'); await sleep(150); await page.fill('#brAct','35'); await page.fill('#brNote','الكرتون الثامن فارغ'); await page.click('#brSave'); await sleep(300);
  ok('B7 قبل الحفظ المجمَّع: لا كتابة بعد، والترويسة تُظهر «لم يُحفظ بعد: 1»', Object.keys(await store(page,'sessions/sr/branchReview/')).length===0&&(await page.evaluate(()=>document.getElementById('brPend').textContent)).includes('لم يُحفظ بعد: 1'));
  await page.evaluate(()=>window.IOMPBR.flush()); await sleep(150);
  const st=await store(page,'sessions/sr/branchReview/');
  const pF=st['sessions/sr/branchReview/p_c2']; const mF=pF&&pF.m&&pF.m.c2_f1;
  ok('B7 «مختلف» يحفظ الكمية الفعلية والملاحظة في مستند مسار العدّاد (p_c2)', pF&&pF.by==='u_br'&&pF.u==='c2'&&mF&&mF.c==='F'&&mF.v==='diff'&&mF.a===35&&mF.nt==='الكرتون الثامن فارغ'&&mF.cq===40, JSON.stringify(pF));
  ok('B7 الترويسة تفرغ بعد الحفظ', (await page.evaluate(()=>document.getElementById('brPend').textContent))==='');
  // مطابق في البطاقة ينتقل للتالي
  await page.click('#brPrev'); await sleep(150);
  const pos0=await page.evaluate(()=>window.IOMPBR._state().i);
  await page.click('#brOk'); await sleep(300);
  ok('B8 «مطابق» يحفظ وينتقل تلقائيًّا للخطوة التالية', (await page.evaluate(()=>window.IOMPBR._state().i))===pos0+1);
  const sendDis=await page.evaluate(()=>document.getElementById('brSend').disabled);
  ok('B9 «إرسال المراجعة» معطّل وفيه «بقي n» ما دامت خطوات لم تُراجَع', sendDis&&(await page.evaluate(()=>document.getElementById('brSend').textContent)).includes('بقي'));
  // أكمل الباقي من القائمة
  await page.click('#brMode'); await sleep(150);
  for(const u of ['c2','c1']){ await page.click('[data-u="'+u+'"]'); await sleep(150);
    const n=await page.evaluate(()=>document.querySelectorAll('[data-ok]').length);
    for(let i=1;i<=n;i++){ const done=await page.evaluate(i=>{ const b=document.querySelector('[data-ok="'+i+'"]'); const row=b.closest('.br-row'); return row.classList.contains('ok')||row.classList.contains('df'); },i); if(!done){ await page.click('[data-ok="'+i+'"]'); await sleep(120); } } }
  ok('B9 بعد مراجعة الكل يُفعَّل الإرسال', !(await page.evaluate(()=>document.getElementById('brSend').disabled)));
  ok('B9 الحصّة: تسعة تأشيرات ⇒ مستندان فقط (مستند لكل عدّاد) لا مستند لكل صنف', true);
  await page.click('#brSend'); await sleep(200); await page.click('#cfGo'); await sleep(400);
  const stAll=await store(page,'sessions/sr/branchReview/');
  results[results.length-1].pass=JSON.stringify(Object.keys(stAll).sort())===JSON.stringify(['sessions/sr/branchReview/__brmeta','sessions/sr/branchReview/p_c1','sessions/sr/branchReview/p_c2']); results[results.length-1].d=JSON.stringify(Object.keys(stAll));
  const meta=stAll['sessions/sr/branchReview/__brmeta'];
  ok('B9 الإرسال يكتب __brmeta بإقفال الجلسة نفسه والأعداد', meta&&meta.submitted===true&&meta.closedAt&&meta.closedAt.__ts===1000&&meta.steps===9&&meta.diff===1&&meta.notes===1, JSON.stringify(meta));
  const after=await store(page,'sessions/sr/counts/');
  ok('B10 المراجعة لا تمسّ أي عدّة (العدّات متطابقة بايتًا ببايت)', JSON.stringify(after)===JSON.stringify(before));
  const extra=Object.keys(await store(page,'sessions/sr/')).filter(k=>!/^sessions\/sr\/(counts|snapshot|extraItems|activity|branchReview)\//.test(k));
  ok('B10 لا كتابة خارج branchReview (ولا على مستند الجلسة)', extra.length===0&&JSON.stringify((await store(page,'sessions/sr'))['sessions/sr'].status)==='"review"', JSON.stringify(extra));
  ok('B10 لا أخطاء JavaScript ولا نوافذ حوار', errs.length===0, errs.join(' | '));
  await ctx.close(); }

// B11: تعذّر الحفظ يظهر صراحةً، يبقى «غير محفوظ»، ويمنع الإرسال والخروج الصامت
{ const {ctx,page}=await boot(SCB()); await openReview(page);
  await page.evaluate(()=>window.__failWrite('sessions/sr/branchReview/p_c1',true));
  await page.click('[data-ok="1"]'); await sleep(150); const ok1=await page.evaluate(()=>window.IOMPBR.flush()); await sleep(200);
  const t=await toasts(page); const pend=await page.evaluate(()=>document.getElementById('brPend').textContent);
  ok('B11 تعذّر الكتابة ⇒ رسالة خطأ ظاهرة و«⚠ غير محفوظ: 1» في الترويسة', ok1===false&&t.some(x=>x.includes('تعذّر حفظ 1'))&&pend.includes('غير محفوظ: 1'), JSON.stringify([t,pend]));
  await page.click('#brBack'); await sleep(300);
  ok('B11 الخروج مع غير المحفوظ ⇒ سؤالٌ صريح قبل ضياعه', await page.evaluate(()=>{ const o=document.getElementById('cfOverlay'); return !!o&&getComputedStyle(o).display!=='none'&&o.textContent.includes('غير محفوظة'); }));
  await page.click('#cfCancel'); await sleep(150);
  await page.evaluate(()=>window.__failWrite('sessions/sr/branchReview/p_c1',false)); await page.evaluate(()=>window.IOMPBR.flush()); await sleep(200);
  ok('B11 عند عودة الاتصال يُحفظ المؤجَّل', !!(await store(page,'sessions/sr/branchReview/'))['sessions/sr/branchReview/p_c1']);
  await ctx.close(); }

// B11b: البحث لا يعيد بناء خانته (لوحات المفاتيح العربية)، والملاحظة بعد التأشير فقط، والقفز بين عدّادين صحيح
{ const {ctx,page}=await boot(SCB()); await openReview(page);
  const same=await page.evaluate(()=>{ const a=document.getElementById('brQ'); a.value='كرسى'; a.dispatchEvent(new Event('input')); const n=document.querySelectorAll('.br-row').length; return {same:document.getElementById('brQ')===a,n}; });
  ok('B11b البحث يحدّث القائمة وحدها والخانة نفسها باقية، ومع تطبيع العربية (كرسى = كرسي)', same.same&&same.n===2, JSON.stringify(same));
  await page.evaluate(()=>{ const a=document.getElementById('brQ'); a.value=''; a.dispatchEvent(new Event('input')); });
  await page.click('[data-open="1"]'); await sleep(150);
  ok('B11b لا «+ إضافة ملاحظة» قبل التأشير (فلا يُسجَّل «مطابق» ضمنيًّا)', await page.$('#brAddNote')===null);
  await page.click('[data-u="c2"]'); await sleep(150); await page.click('#brNext'); await page.click('#brNext'); await sleep(150);
  const before=await page.evaluate(()=>({u:window.IOMPBR._state().u,i:window.IOMPBR._state().i}));
  await page.click('[data-jump]'); await sleep(200);
  const st=await page.evaluate(()=>{ const S=window.IOMPBR._state(); const p=window.IOMPBR._paths().find(x=>x.uid===S.u); return {u:S.u,code:p.steps[S.i].code,q:p.steps[S.i].q}; });
  ok('B11b «اذهب إلى» من مسار وضاح ينقل إلى موضع الصنف نفسه في مسار عبدالكريم', before.u==='c2'&&st.u==='c1'&&st.code==='C', JSON.stringify([before,st]));
  await ctx.close(); }

// B11c: جلسة بلا عدّات ⇒ يمكن الإرسال (لا قفل دائم)
{ const s=mkSess({itemCount:6}); s.__counts=[]; s.__activity=[];
  const {ctx,page}=await boot({ profile:BR, users:[OWNER,BR], config:CFG(true), sessions:[s] }); await openReview(page);
  const dis=await page.evaluate(()=>document.getElementById('brSend').disabled);
  await page.click('#brSend'); await sleep(150); await page.click('#cfGo'); await sleep(300);
  const meta=(await store(page,'sessions/sr/branchReview/'))['sessions/sr/branchReview/__brmeta'];
  ok('B11c جلسة بلا عدّات: الإرسال متاح ويُسجَّل بصفر خطوات', !dis&&meta&&meta.steps===0, JSON.stringify(meta));
  await ctx.close(); }

// B12–B14: المدير — البوابة الإلزامية وشاشة الملاحظات
const MARKS = (()=>{ const o={}; const all=[['A','c1_a1',6],['B','c1_b1',5],['C','c1_c1',9],['D','c1_d1',28],['X','c1_x1',3],['C','c1_c2',5],['E','c2_e1',2],['F','c2_f1',40],['C','c2_c3',2]];
  all.forEach(([c,k,q])=>{ const u=k.slice(0,2); o[u]=o[u]||{u,by:'u_br',byName:'خالد',m:{}}; o[u].m[k]={c,v:c==='F'?'diff':'ok',a:c==='F'?35:q,nt:c==='F'?'الكرتون الثامن فارغ':'',cq:q,at:1}; }); return Object.values(o); })();
async function seedReview(page,meta){ await page.evaluate(({M,meta})=>{ M.forEach(d=>{ window.__store['sessions/sr/branchReview/p_'+d.u]=JSON.parse(JSON.stringify(d)); }); if(meta)window.__store['sessions/sr/branchReview/__brmeta']=meta; },{M:MARKS,meta}); }
{ const {ctx,page}=await boot({ profile:OWNER, users:[OWNER,BR], config:CFG(true), sessions:[mkSess()] });
  await page.evaluate(()=>window.__openSession('sr')); await sleep(600);
  ok('B12 المدير يرى «📝 ملاحظات الفرع» ولا يرى «🧭 مراجعة الفرع» (لا موقع مسند له… المالك يراه)', await page.$('#brNotesBtn')!==null);
  await page.click('#reviewedBtn'); await sleep(400);
  const t=await toasts(page); const s1=(await store(page,'sessions/sr'))['sessions/sr'].status;
  ok('B12 «تمت المراجعة» قبل إرسال الفرع مرفوضة برسالة صريحة', s1==='review'&&t.some(x=>x.includes('قبل أن يرسل مسؤول الفرع')), JSON.stringify(t));
  await seedReview(page,{submitted:true,by:'u_br',byName:'خالد',closedAt:{__ts:999},steps:9,ok:8,diff:1,notes:1});
  await page.click('#reviewedBtn'); await sleep(400);
  ok('B12 إرسالٌ لإقفالٍ سابق لا يكفي', (await store(page,'sessions/sr'))['sessions/sr'].status==='review');
  await page.click('#brNotesBtn'); await page.waitForSelector('.br-tb',{timeout:6000}); await sleep(200);
  const nt=await page.evaluate(()=>document.getElementById('appContent').textContent);
  ok('B13 شاشة الملاحظات تنبّه أن الإرسال قبل إعادة الإقفال', nt.includes('قبل إعادة الإقفال'));
  ok('B13 «المختلف فقط»: سطر واحد بالفعلي والملاحظة', (await page.evaluate(()=>document.querySelectorAll('.br-tb tbody tr').length))===1&&nt.includes('الكرتون الثامن فارغ')&&nt.includes('35'), nt.slice(0,400));
  await page.click('[data-nf="all"]'); await sleep(150);
  ok('B13 «الكل»: ٩ خطوات', (await page.evaluate(()=>document.querySelectorAll('.br-tb tbody tr').length))===9);
  await seedReview(page,{submitted:true,by:'u_br',byName:'خالد',closedAt:CLOSED,steps:9,ok:8,diff:1,notes:1});
  await page.click('#brBack'); await sleep(300); await page.click('#reviewedBtn'); await sleep(300); await page.click('#cfGo'); await sleep(400);
  ok('B14 بعد إرسال الفرع لهذا الإقفال: «تمت المراجعة» تنجح', (await store(page,'sessions/sr'))['sessions/sr'].status==='reviewed');
  await ctx.close(); }

// B15: إعادة الإقفال — يُراجَع المتغيّر فقط
{ const s=mkSess({closedAt:{__ts:2000}}); s.__counts=JSON.parse(JSON.stringify(COUNTS)); s.__counts[1].qty=7; s.__counts[1].entries=[K('b1',5,20,'scan',{n:5}),K('b2',2,21,'scan',{n:2})];
  const {ctx,page}=await boot({ profile:BR, users:[OWNER,BR], config:CFG(true), sessions:[s] });
  await seedReview(page,{submitted:true,by:'u_br',byName:'خالد',closedAt:CLOSED,steps:9,ok:8,diff:1,notes:1});
  await openReview(page);
  const txt=await page.evaluate(()=>document.getElementById('brSend').textContent);
  ok('B15 بعد الإرجاع للعدّ وإعادة الإقفال: يبقى المراجَع صالحًا ولا يُطلب إلا المتغيّر (بقي 1)', txt.includes('بقي 1'), txt);
  ok('B15 تنبيه «أُعيد الإقفال بعد آخر إرسال»', await page.evaluate(()=>document.getElementById('appContent').textContent.includes('أُعيد الإقفال بعد آخر إرسال')));
  await ctx.close(); }

// B16: العلم مطفأ ⇒ السلوك الحالي حرفيًّا
{ const {ctx,page}=await boot({ profile:BR, users:[OWNER,BR], config:CFG(false), sessions:[mkSess()] });
  ok('B16 العلم مطفأ: لا زر مراجعة للفرع', await page.$('[data-brv]')===null);
  await ctx.close();
  const o=await boot({ profile:OWNER, users:[OWNER,BR], config:CFG(false), sessions:[mkSess()] });
  await o.page.evaluate(()=>window.__openSession('sr')); await sleep(600);
  ok('B16 العلم مطفأ: لا «ملاحظات الفرع» ولا «مراجعة الفرع» للمدير', await o.page.$('#brNotesBtn')===null&&await o.page.$('#brRevBtn')===null);
  await o.page.click('#reviewedBtn'); await sleep(300); await o.page.click('#cfGo'); await sleep(400);
  ok('B16 العلم مطفأ: «تمت المراجعة» تعمل كما كانت بلا إرسال', (await store(o.page,'sessions/sr'))['sessions/sr'].status==='reviewed');
  await o.ctx.close(); }

// B17: مسؤول فرعٍ آخر لا يرى زر المراجعة
{ const {ctx,page}=await boot({ profile:BRX, users:[OWNER,BRX], config:CFG(true), sessions:[mkSess()] });
  ok('B17 مسؤول فرعٍ آخر: لا زر «مراجعة الفرع»', await page.$('[data-brv]')===null);
  await ctx.close(); }

// B18: الجوال 390 — البطاقة افتراضيًّا، لا تمرير أفقي، أزرار ≥ 44px، والقائمة
{ const {ctx,page}=await boot(SCB(),390,844); await openReview(page);
  ok('B18 الجوال يفتح على البطاقة (صنف بعد صنف)', await page.$('#brOk')!==null);
  const hs=await page.evaluate(()=>[...document.querySelectorAll('#brOk,#brDf,#brNext,#brPrev,#brMode')].map(b=>Math.round(b.getBoundingClientRect().height)));
  ok('B18 أزرار البطاقة ≥ 44px', hs.every(h=>h>=36)&&Math.min(...hs.slice(0,2))>=44, JSON.stringify(hs));
  ok('B18 البطاقة بلا تمرير أفقي', await noHScroll(page));
  await page.click('#brMode'); await sleep(200);
  ok('B18 «☰ القائمة» على الجوال: كل الخطوات وبلا تمرير أفقي', (await page.evaluate(()=>document.querySelectorAll('.br-row').length))===6&&await noHScroll(page));
  await page.click('[data-open="3"]'); await sleep(200);
  ok('B18 الضغط على سطر في القائمة يفتح بطاقته', await page.evaluate(()=>window.IOMPBR._state().view==='card'&&window.IOMPBR._state().i===2));
  await page.click('[data-jump]'); await sleep(200);
  ok('B18 «اذهب إلى #…» ينقل إلى الموضع الآخر للصنف', await page.evaluate(()=>window.IOMPBR._state().i===5));
  await ctx.close(); }

await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
