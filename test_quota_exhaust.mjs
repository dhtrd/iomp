// محاكاة «نفاد حصّة القراءة اليوميّة» (resource-exhausted) طرفًا لطرف — طلب العميل:
// «الجرد يعمل حتى لو خلصت حصّة القراءات، ولا يتزامن حتى تعود القراءات في اليوم التالي».
// المحاكي (build_harness.js): __quotaOut(true) ⇒ كل قراءة/معاملة/مستمع خادم يرفض بـ resource-exhausted،
// والمستمعون الحيّون يموتون بالخطأ، والكاش الدائم للجهاز متاح (getDocFromCache) — كما في Firestore الحقيقي.
// السيناريو: عدّ أثناء النفاد ← تحديث الصفحة أثناء النفاد ← فتح الجلسة ← ظهور العدّات المحفوظة ← تجدّد الحصّة ← مزامنة تلقائية بلا ازدواج.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const SESS = [{ id:'sr', name:'جرد ليلي', status:'open', started:true, assignedCounters:['u_owner'], location:'فرع أ', itemCount:2,
  __chunks:[[{code:'A1001',name:'صنف أ',category:'ك',book:5,cost:1},{code:'B2002',name:'صنف ب',category:'ك',book:3,cost:1}]] }];
const ON = { features:{ offlineCount:true } };

const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
// «تحديث الصفحة» = تنقّلٌ في التبويب نفسه (يُفرِغ localStorage إلى القرص كما في المتصفّح الحقيقيّ)؛ المسح يقع مرّةً واحدة فقط لكلّ تبويب
async function boot(page,sc,clear){ if(clear) await page.addInitScript(()=>{ try{ if(!sessionStorage.getItem('__c')){ localStorage.clear(); sessionStorage.setItem('__c','1'); } }catch(e){} });
  await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(350); }
// «تحديث الصفحة» على الجهاز نفسه: يُنقل تخزين الجهاز حرفيًّا إلى تبويبٍ جديد قبل إقلاع التطبيق.
// (Chromium بلا واجهة قد يُسقط localStorage بين تنقّلات file:// — والإنتاج يحفظ الطابور في IndexedDB المعاملاتيّ.)
async function reloadLike(page,sc){ const dump=await page.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
  const np=await page.context().newPage(); await np.addInitScript((d)=>{ try{ if(!sessionStorage.getItem('__r')){ localStorage.clear(); for(const k in d)localStorage.setItem(k,d[k]); sessionStorage.setItem('__r','1'); } }catch(e){} },dump);
  await page.close(); await boot(np,sc,false); return np; }
const openSr=async(page)=>{ await page.evaluate(()=>window.__openSession('sr')); await page.waitForTimeout(500); };
const idle=async(page)=>{ for(let i=0;i<60;i++){ if(await page.evaluate(()=>window.__scanIdle()))break; await sleep(50); } await sleep(150); };
const scan=async(page,code,n)=>{ for(let i=0;i<n;i++){ await page.evaluate(c=>window.__scanCommit(c,'field'),code); await idle(page); } };
const qlen=(page)=>page.evaluate(()=>window.__offline.queue().then(q=>q.length));
const srv=(page,code)=>page.evaluate(c=>{ const d=window.__store['sessions/sr/counts/'+c]; return d?d.qty:null; },code);
const qty=(page,code)=>page.evaluate(c=>window.__qtyOf(c),code);
const toasts=(page)=>page.evaluate(()=>{ const h=document.getElementById('toastHost'); return h?h.textContent:''; });
const safe=async(page,fn)=>{ try{ return await page.evaluate(fn); }catch(e){ return 'ERR:'+String(e.message||e).slice(0,80); } };

// ===== رحلة واحدة كاملة على سياقٍ واحد (localStorage/طابور الجهاز مشترك بين الصفحات = «نفس الجهاز») =====
const ctx=await browser.newContext({ viewport:{width:1100,height:1200} });

// Q1 — العدّاد داخل شاشة العدّ لحظة نفاد الحصّة: كل مسحة تُحفظ محليًّا ولا تضيع
let p1;
{ const page=await ctx.newPage(); p1=page; await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true);
  await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(100);
  await scan(page,'A1001',2);
  ok('Q1 مسحتان أثناء النفاد ظاهرتان في الشاشة (٢)', (await qty(page,'A1001'))===2, 'qty='+(await qty(page,'A1001')));
  ok('Q1 حُفظتا في طابور الجهاز (٢)', (await qlen(page))===2, 'qlen='+(await qlen(page)));
  ok('Q1 الخادم لم يستلم شيئًا بعد', (await srv(page,'A1001'))===null); }

// Q2 — تحديث الصفحة والحصّة ما زالت نافدة: التطبيق يقلع من كاش الجهاز (لا شاشة دخولٍ بخطأ)
let p2;
{ p2=await reloadLike(p1,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS,quotaOut:true});
  const me=await safe(p2,()=>window.__me()); const le=await safe(p2,()=>window.__loginErr());
  ok('Q2 التطبيق يقلع بعد التحديث رغم نفاد الحصّة (الملف من كاش الجهاز)', me==='u_owner', 'me='+me+' loginErr='+String(le).slice(0,90));
  await openSr(p2);
  const shell=await safe(p2,()=>window.__has('clist'));
  ok('Q2 الجلسة تُفتح للعدّ من كاش الجهاز (لا بطاقة «تعذّر تحميل الجلسة»)', shell===true, 'clist='+shell);
  const q3=await safe(p2,()=>window.__qtyOf('A1001'));
  ok('Q3 العدّات غير المُزامَنة تظهر بعد التحديث (٢ لا ٠) — يمنع إعادة المسح والعدّ المزدوج', q3===2, 'qty='+q3);
  await scan(p2,'A1001',1);
  const q3b=await safe(p2,()=>window.__qtyOf('A1001'));
  ok('Q3 العدّ يستمرّ بعد التحديث (٣) والطابور (٣)', q3b===3&&(await qlen(p2))===3, 'qty='+q3b+' qlen='+(await qlen(p2)));
  // ما زالت نافدة: المحاولة التلقائيّة لا تُفرغ الطابور ولا تُغرق الشاشة بأخطاء
  const t0=await toasts(p2); const r=await safe(p2,()=>window.__autoTick()); await sleep(300);
  ok('Q4 المحاولة التلقائيّة أثناء النفاد: الطابور باقٍ كما هو (٣)', (await qlen(p2))===3, 'tick='+JSON.stringify(r));
  const t1=await toasts(p2);
  ok('Q4 لا رسالة خطأ إضافيّة مع كل محاولةٍ تلقائيّة (لا إغراق)', (t1.split('تعذّرت مزامنة').length)<=(t0.split('تعذّرت مزامنة').length), t1.slice(-120));
}

// Q5 — اليوم التالي: الحصّة تجدّدت ⇒ مزامنة تلقائيّة (بلا ضغط زرّ) وبلا ازدواج
{ const retry=await safe(p2,()=>window.__retryMs());
  ok('Q5 مؤقّت إعادة محاولةٍ تلقائيّ مضبوط (≤ ١٠ دقائق)', typeof retry==='number'&&retry>0&&retry<=600000, 'retryMs='+retry);
  await p2.evaluate(()=>window.__quotaOut(false));
  await safe(p2,()=>window.__autoTick()); await sleep(700);
  ok('Q5 الطابور فرغ تلقائيًّا بعد تجدّد الحصّة', (await qlen(p2))===0, 'qlen='+(await qlen(p2)));
  ok('Q5 الخادم استلم العدد الصحيح بالضبط (٣ — لا ازدواج)', (await srv(p2,'A1001'))===3, 'srv='+(await srv(p2,'A1001')));
  const q5=await safe(p2,()=>window.__qtyOf('A1001'));
  ok('Q5 الشاشة تعرض ٣ بعد المزامنة (لا ٦)', q5===3, 'qty='+q5);
  await p2.close(); }

// Q6 — فتح التطبيق صباحًا وفي الطابور عمليات: تُزامَن عند الإقلاع بلا أي ضغط
{ const ctx2=await browser.newContext(); const page=await ctx2.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true);
  await openSr(page); await page.evaluate(()=>window.__quotaOut(true)); await sleep(80);
  await scan(page,'B2002',2); const before=await qlen(page);
  const p=await reloadLike(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS}); await sleep(900);
  ok('Q6 عند الإقلاع مع حصّةٍ متجدّدة: الطابور يُدفَع تلقائيًّا', before===2&&(await qlen(p))===0, 'before='+before+' after='+(await qlen(p)));
  const sv6=await p.evaluate(()=>{ const d=window.__store['sessions/sr/counts/B2002']; return d?d.qty:null; }); ok('Q6 والخادم استلم ٢ بالضبط', sv6===2, 'srv='+sv6);
  await ctx2.close(); }

// Q7 — إعادة بناء العرض من الخادم (عدّاد آخر كتب) لا تُسقط عدّاتي غير المُزامَنة
{ const ctx3=await browser.newContext(); const page=await ctx3.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__offline.setOnlineNoFlush(false)); await sleep(80);
  await page.evaluate(()=>window.__addEntry('A1001',3)); await sleep(250);
  await page.evaluate(()=>window.__mockSet('sessions/sr/counts/B2002',{code:'B2002',qty:1,entries:[{id:'x1',q:1,by:'u_other',byName:'عدّاد آخر',at:1}]})); await sleep(250);
  const a=await qty(page,'A1001'), b=await qty(page,'B2002');
  ok('Q7 وصول تحديثٍ من الخادم لا يُخفي عدّي المحفوظ محليًّا (A=٣، B=١)', a===3&&b===1, 'A='+a+' B='+b);
  await page.close(); await ctx3.close(); }

// Q8 — جهاز لم يفتح الجلسة قبل النفاد (لا كاش): رسالة واضحة مع «إعادة المحاولة»، بلا انهيار
{ const ctx4=await browser.newContext(); const page=await ctx4.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true);
  await page.evaluate(()=>{ window.__cacheMiss(true); window.__quotaOut(true); }); await sleep(60);
  await openSr(page);
  const html=await page.evaluate(()=>window.__contentHtml());
  ok('Q8 بلا كاش: بطاقة خطأ مفهومة بزرّ إعادة المحاولة', html.includes('errRetry')&&/حصّة|تعذّر/.test(html), html.replace(/<[^>]+>/g,' ').slice(0,140));
  await page.close(); await ctx4.close(); }

// Q9 — العلم مطفأ: لا طابور — والرسالة تشرح النفاد وتوجّه لتفعيل «العدّ دون اتصال» (سلوك موثَّق)
{ const ctx5=await browser.newContext(); const page=await ctx5.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  const r=await page.evaluate(()=>window.__addEntry('A1001',1)); await sleep(200);
  const t=await toasts(page);
  ok('Q9 العلم مطفأ: لا يُحفظ شيء والرسالة تذكر الحصّة وتفعيل العدّ دون اتصال', r&&r.ok===false&&/حصّة/.test(t)&&/دون اتصال/.test(t), JSON.stringify(r)+' '+t.slice(0,100));
  await page.close(); await ctx5.close(); }

// Q10 — الوضع المتدهور: Firestore الحقيقيّ يعيد محاولة المعاملة عند النفاد (~٨ ثوانٍ لكل مسحة) ⇒ بعد أوّل خطأ
// تذهب المسحات مباشرةً إلى طابور الجهاز بلا أي محاولةٍ للخادم (فوريّة)، وتعود للخادم بعد أوّل مزامنةٍ ناجحة.
{ const ctx6=await browser.newContext(); const page=await ctx6.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  const t0=await page.evaluate(()=>window.__txCalls());
  await scan(page,'A1001',1); const t1=await page.evaluate(()=>window.__txCalls());
  const st=Date.now(); await scan(page,'A1001',4); const dur=Date.now()-st; const t2=await page.evaluate(()=>window.__txCalls());
  ok('Q10 أوّل مسحة بعد النفاد فقط تحاول الخادم', t1-t0===1, 't1-t0='+(t1-t0));
  ok('Q10 المسحات التالية لا تمسّ الخادم إطلاقًا (طابور الجهاز مباشرةً)', t2===t1, 'extra tx='+(t2-t1));
  ok('Q10 والطابور يحمل الخمس', (await qlen(page))===5, 'qlen='+(await qlen(page)));
  const tw=(await toasts(page)).split('تعذّر الوصول للخادم مؤقّتًا').length-1;
  ok('Q10 تنبيهٌ واحد لا مع كلّ مسحة', tw<=1, 'toasts='+tw);
  await page.evaluate(()=>window.__quotaOut(false)); await page.evaluate(()=>window.__autoTick()); await sleep(700);
  ok('Q10 بعد تجدّد الحصّة: المزامنة أفرغت الطابور والخادم = ٥', (await qlen(page))===0&&(await srv(page,'A1001'))===5, 'qlen='+(await qlen(page))+' srv='+(await srv(page,'A1001')));
  const t3=await page.evaluate(()=>window.__txCalls()); await scan(page,'A1001',1); const t4=await page.evaluate(()=>window.__txCalls());
  ok('Q10 وبعدها تعود المسحات للخادم مباشرةً (خرجنا من الوضع المتدهور)', t4-t3===1&&(await qlen(page))===0&&(await srv(page,'A1001'))===6, 'tx='+(t4-t3)+' srv='+(await srv(page,'A1001')));
  await page.close(); await ctx6.close(); }

// Q11 — الترتيب محفوظ: «تصفير» في الطابور لا تسبقه مسحاتٌ أحدث إلى الخادم ثم يمحوها
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  await scan(page,'A1001',2);
  await page.evaluate(()=>window.__resetItem('A1001')); await sleep(200);
  await page.evaluate(()=>{ window.__quotaOut(false); window.__qDownClear(); }); await sleep(60);
  await scan(page,'A1001',3); await sleep(1500);
  ok('Q11 بعد تجدّد الحصّة: الطابور فرغ بالترتيب (إضافة، إضافة، تصفير، ثم الجديد)', (await qlen(page))===0, 'qlen='+(await qlen(page)));
  ok('Q11 الخادم = ٣ (المسحات الأحدث لم يمحها التصفير الأقدم)', (await srv(page,'A1001'))===3, 'srv='+(await srv(page,'A1001')));
  ok('Q11 الشاشة = ٣', (await qty(page,'A1001'))===3, 'qty='+(await qty(page,'A1001')));
  await page.close(); await c.close(); }

// Q12 — قفل الطابور: مسحٌ متواصل أثناء الدفع لا يُفقد عمليّةً ولا يكرّرها
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  for(let i=0;i<20;i++) await page.evaluate(()=>window.__scanCommit('B2002','field'));
  await idle(page);
  await page.evaluate(()=>window.__quotaOut(false));
  await page.evaluate(()=>{ window.__autoTick(); for(let i=0;i<10;i++) window.__scanCommit('B2002','field'); });
  await idle(page); await sleep(1800);
  const seqs=await page.evaluate(()=>window.__offline.queue().then(q=>q.map(x=>x.seq)));
  ok('Q12 الطابور فرغ تمامًا', seqs.length===0, JSON.stringify(seqs));
  ok('Q12 الخادم = ٣٠ بالضبط (٢٠ قبل الدفع + ١٠ أثناءه — لا فقد ولا تكرار)', (await page.evaluate(()=>{ const d=window.__store['sessions/sr/counts/B2002']; return d?d.qty:null; }))===30, 'srv='+(await page.evaluate(()=>{ const d=window.__store['sessions/sr/counts/B2002']; return d?d.qty:null; })));
  ok('Q12 الشاشة = ٣٠', (await qty(page,'B2002'))===30, 'qty='+(await qty(page,'B2002')));
  await page.close(); await c.close(); }

// Q13 — تحذيرٌ ظاهر حين يتوقّف البثّ الحيّ، ولا سحبٌ للمستخدم إلى شاشة العدّ بعد المزامنة
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(80); await scan(page,'A1001',1);
  const chip=await page.evaluate(()=>window.__offChip());
  ok('Q13 شريحة الحالة تحذّر: قد لا تظهر عدّات الأجهزة الأخرى', chip.includes('قد لا تظهر عدّات الأجهزة الأخرى'), chip);
  await page.evaluate(()=>window.__setTab('home')); await sleep(200);
  await page.evaluate(()=>window.__quotaOut(false)); await page.evaluate(()=>window.__autoTick()); await sleep(900);
  const onCount=await page.evaluate(()=>window.__has('clist'));
  ok('Q13 بعد المزامنة يبقى المستخدم حيث هو (لا يُسحب لشاشة العدّ)', onCount===false&&(await srv(page,'A1001'))===1, 'clist='+onCount);
  await page.close(); await c.close(); }

// Q14 — عمليّةٌ عالقة لصنفٍ لا تُعطّل بقيّة الأصناف: صنفٌ آخر يُكتب للخادم مباشرةً
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60); await scan(page,'A1001',1);
  await page.evaluate(()=>{ window.__quotaOut(false); window.__qDownClear(); window.__offline.failNext(true); }); // دفع A1001 يفشل دائمًا (محاكاة عمليّة عالقة)
  await scan(page,'B2002',1);
  const b=await page.evaluate(()=>{ const d=window.__store['sessions/sr/counts/B2002']; return d?d.qty:null; });
  ok('Q14 الصنف ب يُكتب مباشرةً رغم بقاء عمليّة أ في الطابور', b===1, 'B srv='+b);
  ok('Q14 وعمليّة أ ما زالت محفوظة (لم تضع)', (await qlen(page))===1&&(await qty(page,'A1001'))===1, 'qlen='+(await qlen(page)));
  await page.close(); await c.close(); }

// Q15 — سجلّ الحركة لا يضيع: التصفير المحفوظ في الطابور يُسجَّل في سجلّ الجلسة بعد الدفع
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  await scan(page,'A1001',2); await page.evaluate(()=>window.__resetItem('A1001')); await sleep(200);
  await page.evaluate(()=>window.__quotaOut(false)); await page.evaluate(()=>window.__autoTick()); await sleep(900);
  const acts=await page.evaluate(()=>{ const out=[]; const s=window.__store; for(const k in s){ if(k.indexOf('sessions/sr/activity/')===0&&s[k])out.push(s[k].type+':'+(s[k].qty==null?'':s[k].qty)); } return out; });
  ok('Q15 «تصفير» من الطابور مُسجَّل في سجلّ الحركة بالكمية السابقة (٢)', acts.includes('reset:2'), JSON.stringify(acts));
  await page.close(); await c.close(); }

// Q16 — عمليّات مستخدمٍ آخر على الجهاز نفسه لا تُدفَع باسمي ولا تُعرَض كعدّي
{ const c=await browser.newContext(); const page=await c.newPage();
  await page.addInitScript(()=>{ try{ if(!sessionStorage.getItem('seeded')){ localStorage.clear(); localStorage.setItem('iomp-offline-queue',JSON.stringify([{seq:1,op:'add',code:'A1001',sid:'sr',deviceId:'d',at:1,val:4,eid:'fx1',src:'scan',uid:'u_other'}])); localStorage.setItem('iomp-offline-seq','1'); sessionStorage.setItem('seeded','1'); } }catch(e){} });
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},false); await openSr(page); await sleep(1300);
  const srvA=await srv(page,'A1001'); const ql=await qlen(page); const qa=await qty(page,'A1001');
  ok('Q16 عمليّة المستخدم الآخر بقيت في الطابور ولم تُدفَع باسمي', srvA===null&&ql===1, 'srv='+srvA+' qlen='+ql);
  ok('Q16 ولا تظهر ضمن عدّي في الشاشة', qa===0, 'qty='+qa);
  await page.close(); await c.close(); }

// Q17 — عمليّة صنفٍ عالقة لا تحجب عمليّات صنفٍ آخر خلفها في الطابور
{ const c=await browser.newContext(); const page=await c.newPage();
  await boot(page,{profile:OWNER,users:[OWNER],config:ON,sessions:SESS},true); await openSr(page);
  await page.evaluate(()=>window.__quotaOut(true)); await sleep(60);
  await scan(page,'A1001',1); await scan(page,'B2002',2);
  await page.evaluate(()=>{ window.__quotaOut(false); window.__failRead('sessions/sr/counts/A1001',true); });
  await page.evaluate(()=>window.__autoTick()); await sleep(900);
  const b=await page.evaluate(()=>{ const d=window.__store['sessions/sr/counts/B2002']; return d?d.qty:null; });
  ok('Q17 عمليّة أ تتعثّر وحدها: ب وصلت الخادم (٢)', b===2, 'B='+b);
  ok('Q17 وعمليّة أ باقية في الطابور وحدها', (await qlen(page))===1, 'qlen='+(await qlen(page)));
  await page.evaluate(()=>window.__failRead('sessions/sr/counts/A1001',false)); await page.evaluate(()=>window.__autoTick()); await sleep(900);
  ok('Q17 حين تزول العلّة: أ تُزامَن (١) والطابور فارغ', (await srv(page,'A1001'))===1&&(await qlen(page))===0, 'A='+(await srv(page,'A1001'))+' qlen='+(await qlen(page)));
  await page.close(); await c.close(); }

await ctx.close(); await browser.close();
let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length}`);
process.exit(pass===results.length?0:1);
