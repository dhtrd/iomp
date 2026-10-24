/* queue-io.js — «🛡 حماية العدّ» (ورقة اتفاق «حماية العدّ من الضياع»، معتمدة ٢٠٢٦-١٠-٢٤)
   يُحمَّل عند الطلب من index.html (qioLoad) — لا يزيد حجم الصفحة الرئيسية.
   يعرض حالة الجهاز: عدد ما لم يُرسل، الحفظ الدائم (أ)، التثبيت على الشاشة الرئيسية (ب)، النسخة الثانية للطابور (د)، وتنبيه النافذة الخاصة (ج).
   الطبقة و (تصميم المالك ٢٠٢٦-١٠-٢٤): تصدير طابور الجهاز ملفًّا، واستيراده على جهازٍ آخر بحساب العدّاد أو مديرٍ مكلَّفٍ بالجلسة.
     • الملف يحمل عمليّات مُصدِّره وحده، مع بصمة SHA-256 تكشف التلف.
     • كلّ عمليّةٍ تُطبَّق عبر C.qApply (index.html) في معاملةٍ مع علامةٍ حتميّة على الخادم ⇒ لا تُطبَّق أيّ عمليّةٍ مرّتين أبدًا
       (ملفٌّ مكرَّر أو متداخل، استئنافٌ بعد انقطاع، أو جهازٌ أصليّ عاد فدفع الطابور نفسه) — هذا ما أوقف التصميم الأوّل في المراجعة المستقلّة.
     • الكميات تُنسب للعدّاد الأصليّ؛ والعلامة/سطر السجلّ يذكر المستورِد (by) والعدّاد (forUid/forName).
     • «تصفير صنف» يُتخطّى إن كانت على الخادم كمياتٌ أحدث منه، ويظهر في التقرير (قرار المالك).
     • الملف لا يُستورد مرّتين (سطر qimport ببصمته) — حمايةٌ للمستخدم فوق الضمان الذرّيّ. */
(function(){
'use strict';
let C=null;
const $=(id)=>document.getElementById(id);
const KIND='iomp-queue', VER=1;
async function digest(str){
  try{ if(window.crypto&&crypto.subtle&&crypto.subtle.digest){ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)); return 'sha256:'+Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''); } }catch(e){}
  return 'fnv:'+C.acChecksum(str); }

function close(){ const o=$('qioOverlay'); if(o)o.remove(); }
function shell(title,body){ close(); const ov=document.createElement('div'); ov.id='qioOverlay'; ov.className='cfov';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML='<div class="cfcard" role="dialog" aria-modal="true" aria-labelledby="qioTitle" style="max-width:520px;width:100%;max-height:88vh;overflow:auto"><h3 id="qioTitle">'+C.esc(title)+'</h3><div id="qioBody">'+body+'</div><div class="cfrow"><button id="qioClose" class="btn ghost sm">إغلاق</button></div></div>';
  document.body.appendChild(ov); $('qioClose').onclick=close; ov.addEventListener('click',e=>{ if(e.target===ov)close(); }); }

function row(ok,label,detail){ const ic=ok===true?'✅':(ok===false?'⚠️':'ℹ️');
  return '<div style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--hair)"><span>'+ic+'</span><div style="flex:1"><b>'+C.esc(label)+'</b>'+(detail?'<div class="muted" style="font-size:12.5px;line-height:1.7">'+C.esc(detail)+'</div>':'')+'</div></div>'; }

async function open(ctx){ C=ctx;
  const own=(await C.queue()).filter(C.own);
  const p=C.persist(); let h='';
  h+=row(own.length===0, own.length?('عمليات لم تُرسل بعد: '+C.fmt(own.length)):'لا عمليات بانتظار الإرسال',
        own.length?'محفوظة على هذا الجهاز وتُرسل تلقائيًّا عند عودة الاتصال/الحصّة. صدّرها ملفًّا قبل أيّ تنظيفٍ للمتصفّح أو إن كان الجهاز معرَّضًا للتلف.':'');
  h+=row(p===true?true:(p===false?false:null),'الحفظ الدائم في المتصفّح: '+(p===true?'ممنوح':(p===false?'غير ممنوح':'غير مدعوم/غير معروف')),
        p===true?'لا يمسح المتصفّح بيانات العدّ آليًّا عند ضيق المساحة.':'قد يمسح المتصفّح البيانات عند امتلاء الجهاز. التثبيت على الشاشة الرئيسية يرفع فرص منحه.');
  h+=row(C.installed?true:(C.ios?false:null),'التطبيق مثبّت على الشاشة الرئيسية: '+(C.installed?'نعم':'لا'),
        C.installed?'':(C.ios?'آيفون/آيباد: زرّ المشاركة ← «إضافة إلى الشاشة الرئيسية». سفاري يمسح بيانات المواقع غير المثبّتة بعد ٧ أيام بلا استخدام.':'يُنصح بتثبيته لأجهزة العدّ.'));
  h+=row(C.backend==='idb'?(C.mirrorOk()?true:false):null,'النسخة الثانية من الطابور: '+(C.backend!=='idb'?'غير مطلوبة هنا':(C.mirrorOk()?'تعمل':'تعذّرت (مساحة الجهاز ممتلئة؟)')),'');
  h+=row(null,'النافذة الخاصة/المتخفّية','لا تعدّ فيها — ما لم يُرسل يُمسح عند إغلاقها. المتصفّحات تمنع كشفها آليًّا، فالتنبيه ثابت.');
  h+='<div class="cfrow" style="flex-wrap:wrap;justify-content:flex-start;gap:8px;margin-top:10px">'
    +'<button id="qioExp" class="btn sm"'+(own.length?'':' disabled')+'>⬇ تصدير الطابور ملفًّا</button>'
    +'<button id="qioImp" class="btn ghost sm">⬆ استيراد ملف طابور</button>'
    +(C.bip()?'<button id="qioInst" class="btn ghost sm">📲 تثبيت التطبيق</button>':'')
    +'<input id="qioFile" type="file" accept=".json,application/json" style="display:none"></div>';
  shell('🛡 حماية العدّ',h);
  if($('qioInst'))$('qioInst').onclick=async()=>{ const b=C.bip(); if(!b)return; try{ await b.prompt(); }catch(e){} };
  $('qioExp').onclick=()=>exportQueue(own);
  $('qioImp').onclick=()=>$('qioFile').click();
  $('qioFile').onchange=(e)=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(f)importFile(f); };
}

async function exportQueue(own){
  if(!own||!own.length){ C.toastWarn('لا عمليات بانتظار الإرسال على هذا الجهاز.'); return; }
  const ops=own.slice().sort((a,b)=>a.seq-b.seq);
  const hash=await digest(JSON.stringify(ops));
  const file={kind:KIND,v:VER,deviceId:C.deviceId,exportedAt:Date.now(),by:{uid:C.uid,name:(C.me&&C.me.name)||''},n:ops.length,hash:hash,ops:ops};
  const blob=new Blob([JSON.stringify(file)],{type:'application/json'});
  const d=new Date(), pad=(x)=>String(x).padStart(2,'0');
  const name='iomp-queue-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+'-'+C.deviceId+'.json';
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} },1500);
  window.__qioLastExport=file; // للاختبارات
  C.toastOk('صُدِّر '+C.fmt(ops.length)+' عملية إلى الملف «'+name+'» — احفظه في مكانٍ آمن. العمليات باقية على الجهاز كما هي.'); }

function readText(f){ return new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result||'')); r.onerror=()=>no(r.error); r.readAsText(f); }); }
async function importFile(f){ let txt; try{ txt=await readText(f); }catch(e){ C.toastErr('تعذّرت قراءة الملف.'); return; } return importText(txt); }

async function importText(txt){
  let F; try{ F=JSON.parse(txt); }catch(e){ C.toastErr('الملف ليس ملف طابور عدّ صالحًا.'); return {ok:false,err:'parse'}; }
  if(!F||F.kind!==KIND||F.v!==VER||!Array.isArray(F.ops)||!F.by||!F.by.uid||!F.deviceId||!F.hash){ C.toastErr('الملف ليس ملف طابور عدّ صالحًا.'); return {ok:false,err:'shape'}; }
  const h=await digest(JSON.stringify(F.ops));
  if(F.hash.split(':')[0]!==h.split(':')[0]){ C.toastErr('تعذّر التحقّق من بصمة الملف على هذا المتصفّح.'); return {ok:false,err:'algo'}; }
  if(h!==F.hash){ C.toastErr('بصمة الملف لا تطابق محتواه — الملف معطوب أو عُدِّل. لم يُستورد شيء.'); return {ok:false,err:'hash'}; }
  if(F.ops.some(o=>!o||o.uid!==F.by.uid||o.deviceId!==F.deviceId||typeof o.seq!=='number'||typeof o.at!=='number')){ C.toastErr('الملف يحتوي عمليات لا تخصّ مُصدِّره أو ناقصة — لم يُستورد شيء.'); return {ok:false,err:'ops'}; }
  const AS={uid:F.by.uid,name:F.by.name||''};
  const bySid={}; F.ops.forEach(o=>{ if(o.sid)(bySid[o.sid]=bySid[o.sid]||[]).push(o); });
  const sids=Object.keys(bySid); if(!sids.length){ C.toastWarn('الملف لا يحتوي عمليات.'); return {ok:false,err:'empty'}; }
  const plan=[], blocked=[];
  for(const sid of sids){ let s=null; try{ const sn=await C.getDoc(C.doc(C.db,'sessions',sid)); s=sn.exists()?sn.data():null; }catch(e){ C.toastErr('تعذّر الوصول للخادم: '+C.errAr(e.code||e.message)); return {ok:false,err:'net'}; }
    const nm=(s&&s.name)||sid, ac=(s&&s.assignedCounters)||[];
    if(!s||s.deleted){ blocked.push(nm+': الجلسة غير موجودة'); continue; }
    if((s.status||'open')!=='open'||!s.started){ blocked.push(nm+': الجلسة ليست مفتوحة للعدّ'); continue; }
    if(!ac.includes(C.uid)){ blocked.push(nm+': حسابك ليس ضمن العدّادين المكلَّفين بها — أضف نفسك من «إدارة ما نُسي» ثم أعد الاستيراد'); continue; }
    if(!ac.includes(AS.uid)){ blocked.push(nm+': «'+(AS.name||AS.uid)+'» ليس ضمن العدّادين المكلَّفين بهذه الجلسة — لا تُنسب له كميات فيها'); continue; }
    let dup=false; try{ const qs=await C.getDocs(C.query(C.collection(C.db,'sessions',sid,'activity'),C.where('type','==','qimport'),C.where('hash','==',F.hash))); dup=!qs.empty; }catch(e){ C.toastErr('تعذّر التحقّق من الاستيراد السابق: '+C.errAr(e.code||e.message)); return {ok:false,err:'net'}; }
    if(dup){ blocked.push(nm+': هذا الملف استُورد سابقًا إلى هذه الجلسة'); continue; }
    plan.push({sid,name:nm,ops:bySid[sid].slice().sort((a,b)=>a.seq-b.seq)}); }
  if(!plan.length){ shell('⬆ استيراد ملف طابور','<div class="cfmsg">لم يُستورد شيء:</div>'+blocked.map(b=>'<div class="muted" style="font-size:13px">• '+C.esc(b)+'</div>').join('')); return {ok:false,err:'blocked',blocked}; }
  const n=plan.reduce((a,p)=>a+p.ops.length,0);
  const msg='سيُستورد '+C.fmt(n)+' عملية عدّ صُدِّرت من جهاز «'+F.deviceId+'» في '+C.fmtDT(new Date(F.exportedAt))+'، وتُنسب الكميات إلى «'+(AS.name||AS.uid)+'».'
    +' الجلسات: '+plan.map(p=>p.name).join('، ')+'.'+(blocked.length?(' (تُستثنى: '+blocked.join('؛ ')+')'):'')
    +' ما سبق تطبيقه على الخادم من هذه العمليات لا يُطبَّق ثانيةً.';
  if(!(await C.confirmDialog({title:'استيراد ملف طابور',message:msg,confirmLabel:'استيراد'})))return {ok:false,err:'cancel'};
  return applyPlan(F,AS,plan,blocked); }

async function applyPlan(F,AS,plan,blocked){
  const me=(C.me&&C.me.name)||''; const tag=' — مستوردة من ملف'+(AS.uid!==C.uid?(' لـ'+(AS.name||'')):'')+' بواسطة '+me;
  let applied=0, already=0; const skipped=[], errors=[];
  for(const P of plan){ let cnt=0, stop=false;
    for(const op of P.ops){
      try{ const r=await C.qApply(op,AS,tag,true);
        if(r===C.QSKIP)already++;
        else if(r&&r.skipped)skipped.push({sess:P.name,code:op.code,at:op.at,newer:r.newer});
        else applied++;
        cnt++;
      }catch(e){ errors.push(P.name+' — '+op.code+': '+C.errAr(e.code||e.message)); stop=true; break; } }
    if(!stop){ try{ await C.addDoc(C.collection(C.db,'sessions',P.sid,'activity'),{type:'qimport',hash:F.hash,deviceId:F.deviceId,forUid:AS.uid,forName:AS.name,
        name:'استيراد ملف طابور: '+C.fmt(cnt)+' عملية لـ'+(AS.name||'')+' (جهاز '+F.deviceId+')',qty:cnt,code:'',by:C.uid,byName:me,at:C.serverTimestamp()}); }catch(e){} }
    if(stop)break; }
  const rep='<div class="cfmsg">'+(errors.length?'⚠ توقّف الاستيراد قبل اكتماله.':'✅ اكتمل الاستيراد.')+' طُبّقت '+C.fmt(applied)+' عملية'+(already?(' — و'+C.fmt(already)+' كانت مطبّقةً سلفًا على الخادم فلم تتكرّر'):'')+'.</div>'
    +(skipped.length?('<div style="margin-top:8px"><b>«تصفير صنف» لم يُنفَّذ لوجود كمياتٍ أحدث منه على الخادم — راجِعه يدويًّا:</b>'+skipped.map(x=>'<div class="muted" style="font-size:13px">• '+C.esc(x.sess)+' — '+C.esc(x.code)+' (تصفير '+C.esc(C.fmtDT(new Date(x.at)))+'، كميات أحدث: '+C.fmt(x.newer)+')</div>').join('')+'</div>'):'')
    +(blocked.length?('<div style="margin-top:8px"><b>مستثنى:</b>'+blocked.map(b=>'<div class="muted" style="font-size:13px">• '+C.esc(b)+'</div>').join('')+'</div>'):'')
    +(errors.length?('<div style="margin-top:8px;color:var(--danger)"><b>أخطاء:</b>'+errors.map(b=>'<div style="font-size:13px">• '+C.esc(b)+'</div>').join('')+'<div class="muted" style="font-size:12.5px">أعد استيراد الملف نفسه بعد عودة الاتصال — ما طُبّق لا يتكرّر، ويُكمل الباقي.</div></div>'):'');
  shell('⬆ نتيجة الاستيراد',rep);
  return {ok:!errors.length,applied,already,skipped,errors,blocked}; }

window.IOMPQ={open,exportQueue,importText,_close:close};
})();
