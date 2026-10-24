/* queue-io.js — «🛡 حماية العدّ» (ورقة اتفاق «حماية العدّ من الضياع»، معتمدة ٢٠٢٦-١٠-٢٤)
   يُحمَّل عند الطلب من index.html (qioLoad) — لا يزيد حجم الصفحة الرئيسية.
   ١) حالة الجهاز: الحفظ الدائم (أ)، التثبيت على الشاشة الرئيسية (ب)، النسخة الثانية للطابور (د)، وعدد ما لم يُرسل.
   ٢) الطبقة و — تصدير طابور العدّ ملفًّا، واستيراده على جهازٍ آخر بحساب العدّاد أو المدير المكلَّف بالجلسة:
      • الملف يحمل عمليّات مُصدِّره وحده، مع بصمة (SHA-256) تكشف أيّ تلفٍ أو تعديل.
      • الكميات تُنسب للعدّاد الأصليّ (as) لا لمن استورد؛ وسجلّ الحركة يذكر المستورِد.
      • لا تكرار: الإضافات بمعرّفها؛ والملف نفسه لا يُستورد مرّتين (علامة qimport في سجلّ حركة الجلسة ببصمته).
      • «تصفير صنف» يُنفَّذ فقط إن لم تكن على الخادم كمياتٌ أحدث منه؛ وإلّا يُتخطّى ويظهر في تقرير الاستيراد (قرار المالك).
      • جهاز العدّاد الأصليّ إن عاد للاتصال لا يدفع ما استُورد (offlineFlush0 ← qimpMax).
   لا يمسّ قواعد الأمان: الكتابة بالمسارات نفسها التي يكتبها العدّ العاديّ. */
(function(){
'use strict';
let C=null;
const KIND='iomp-queue', VER=1, PROG='iomp-qimp-';
const $=(id)=>document.getElementById(id);

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
  const own=(await C.queue()).filter(C.own); const bySid={}; own.forEach(o=>{ bySid[o.sid]=(bySid[o.sid]||0)+1; });
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
  $('qioExp').onclick=()=>exportQueue(own);
  $('qioImp').onclick=()=>$('qioFile').click();
  $('qioFile').onchange=(e)=>{ const f=e.target.files&&e.target.files[0]; if(f)importFile(f); };
  if($('qioInst'))$('qioInst').onclick=async()=>{ const b=C.bip(); if(!b)return; try{ await b.prompt(); }catch(e){} };
}

async function exportQueue(own){
  if(!own||!own.length){ C.toastWarn('لا عمليات بانتظار الإرسال على هذا الجهاز.'); return; }
  const ops=own.slice().sort((a,b)=>a.seq-b.seq);
  const body=JSON.stringify(ops); const hash=await digest(body);
  const file={kind:KIND,v:VER,deviceId:C.deviceId,exportedAt:Date.now(),by:{uid:C.uid,name:(C.me&&C.me.name)||''},n:ops.length,hash:hash,ops:ops};
  const blob=new Blob([JSON.stringify(file)],{type:'application/json'});
  const d=new Date(), pad=(x)=>String(x).padStart(2,'0');
  const name='iomp-queue-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+'-'+C.deviceId+'.json';
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} },1500);
  window.__qioLastExport=file; // للاختبارات
  C.toastOk('صُدِّر '+C.fmt(ops.length)+' عملية إلى الملف «'+name+'» — احفظه في مكانٍ آمن. العمليات باقية على الجهاز كما هي.'); }

function readText(f){ return new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result||'')); r.onerror=()=>no(r.error); r.readAsText(f); }); }

async function importFile(f){ let txt; try{ txt=await readText(f); }catch(e){ C.toastErr('تعذّرت قراءة الملف.'); return; }
  return importText(txt); }

async function importText(txt){
  let F; try{ F=JSON.parse(txt); }catch(e){ C.toastErr('الملف ليس ملف طابور عدّ صالحًا.'); return {ok:false,err:'parse'}; }
  if(!F||F.kind!==KIND||F.v!==VER||!Array.isArray(F.ops)||!F.by||!F.by.uid||!F.deviceId||!F.hash){ C.toastErr('الملف ليس ملف طابور عدّ صالحًا.'); return {ok:false,err:'shape'}; }
  const h=await digest(JSON.stringify(F.ops));
  if(h!==F.hash){ C.toastErr('بصمة الملف لا تطابق محتواه — الملف معطوب أو عُدِّل. لم يُستورد شيء.'); return {ok:false,err:'hash'}; }
  if(F.hash.split(':')[0]!==h.split(':')[0]){ C.toastErr('تعذّر التحقّق من بصمة الملف على هذا المتصفّح.'); return {ok:false,err:'algo'}; }
  const AS={uid:F.by.uid,name:F.by.name||''};
  const bySid={}; F.ops.forEach(o=>{ if(o&&o.sid)(bySid[o.sid]=bySid[o.sid]||[]).push(o); });
  const sids=Object.keys(bySid); if(!sids.length){ C.toastWarn('الملف لا يحتوي عمليات.'); return {ok:false,err:'empty'}; }
  // فحص كلّ جلسة قبل كتابة أيّ شيء
  const plan=[], blocked=[];
  for(const sid of sids){ let s=null; try{ const sn=await C.getDoc(C.doc(C.db,'sessions',sid)); s=sn.exists()?sn.data():null; }catch(e){ C.toastErr('تعذّر الوصول للخادم: '+C.errAr(e.code||e.message)); return {ok:false,err:'net'}; }
    const nm=(s&&s.name)||sid;
    if(!s||s.deleted){ blocked.push(nm+': الجلسة غير موجودة'); continue; }
    if((s.status||'open')!=='open'||!s.started){ blocked.push(nm+': الجلسة ليست مفتوحة للعدّ'); continue; }
    if(!(s.assignedCounters||[]).includes(C.uid)){ blocked.push(nm+': حسابك ليس ضمن العدّادين المكلَّفين بها — أضف نفسك من «إدارة ما نُسي» ثم أعد الاستيراد'); continue; }
    let dup=false; try{ const qs=await C.getDocs(C.query(C.collection(C.db,'sessions',sid,'activity'),C.where('type','==','qimport'),C.where('deviceId','==',F.deviceId))); qs.forEach(d=>{ const a=d.data(); if(a&&a.hash===F.hash)dup=true; }); }catch(e){ C.toastErr('تعذّر التحقّق من الاستيراد السابق: '+C.errAr(e.code||e.message)); return {ok:false,err:'net'}; }
    if(dup){ blocked.push(nm+': هذا الملف استُورد سابقًا إلى هذه الجلسة'); continue; }
    plan.push({sid,name:nm,ops:bySid[sid].slice().sort((a,b)=>a.seq-b.seq)}); }
  if(!plan.length){ shell('⬆ استيراد ملف طابور','<div class="cfmsg">لم يُستورد شيء:</div>'+blocked.map(b=>'<div class="muted" style="font-size:13px">• '+C.esc(b)+'</div>').join('')); return {ok:false,err:'blocked',blocked}; }
  const n=plan.reduce((a,p)=>a+p.ops.length,0);
  const msg='سيُستورد '+C.fmt(n)+' عملية عدّ صُدِّرت من جهاز «'+F.deviceId+'» في '+C.fmtDT(new Date(F.exportedAt))+'، وتُنسب الكميات إلى «'+(AS.name||AS.uid)+'».'
    +' الجلسات: '+plan.map(p=>p.name).join('، ')+'.'+(blocked.length?(' (تُستثنى: '+blocked.join('؛ ')+')'):'');
  if(!(await C.confirmDialog({title:'استيراد ملف طابور',message:msg,confirmLabel:'استيراد'})))return {ok:false,err:'cancel'};
  return applyPlan(F,AS,plan,blocked); }

async function applyPlan(F,AS,plan,blocked){
  const me=(C.me&&C.me.name)||''; const tag=' — مستوردة من ملف'+(AS.uid!==C.uid?(' لـ'+(AS.name||'')):'')+' بواسطة '+me;
  const pk=PROG+F.hash; let done=0; try{ done=Number(localStorage.getItem(pk))||0; }catch(e){}
  let applied=0; const skipped=[], errors=[];
  for(const P of plan){ let maxSeq=0, cnt=0, stop=false;
    for(const op of P.ops){ maxSeq=Math.max(maxSeq,op.seq||0); if((op.seq||0)<=done){ cnt++; continue; } // استئنافٌ بعد انقطاع على الجهاز نفسه
      try{ let rv=null;
        if(op.op==='add') await C.countWriteAdd(P.sid,op.code,op.val,op.at,op.eid,op.run||null,op.src||'',AS);
        else if(op.op==='dec') rv=await C.countWriteDec(P.sid,op.code,op.eid);
        else if(op.op==='remove') rv=await C.countWriteRemove(P.sid,op.code,(op.eid!=null?-1:op.index),op.eid);
        else if(op.op==='reset'){ const sn=await C.getDoc(C.doc(C.db,'sessions',P.sid,'counts',C.safeId(op.code)));
          const cur=sn.exists()?sn.data():null; const newer=cur?(cur.entries||[]).filter(e=>e&&(e.at||0)>(op.at||0)):[];
          if(newer.length){ skipped.push({sid:P.sid,sess:P.name,code:op.code,at:op.at,newer:newer.length}); try{ localStorage.setItem(pk,String(op.seq)); }catch(e){} cnt++; continue; }
          if(cur) await C.countWriteReset(P.sid,op.code); }
        else if(op.op==='note') await C.noteWriteAdd(P.sid,op.code,op.text,op.at,op.eid,AS);
        else if(op.op==='additem') await C.extraWriteAdd(P.sid,op.code,op.item);
        if(op.log){ const q=(op.op==='add'?op.val:(op.op==='reset'?(op.log.q==null?null:op.log.q):rv));
          C.addDoc(C.collection(C.db,'sessions',P.sid,'activity'),{type:op.log.t,code:String(op.code),name:(op.log.n||'')+tag,qty:q==null?null:q,by:C.uid,byName:me,at:C.serverTimestamp(),countedAt:op.at,forUid:AS.uid,forName:AS.name}).catch(()=>{}); }
        applied++; cnt++; try{ localStorage.setItem(pk,String(op.seq)); }catch(e){}
      }catch(e){ errors.push(P.name+' — '+op.code+': '+C.errAr(e.code||e.message)); stop=true; break; } }
    if(stop)break;
    try{ await C.addDoc(C.collection(C.db,'sessions',P.sid,'activity'),{type:'qimport',hash:F.hash,deviceId:F.deviceId,forUid:AS.uid,forName:AS.name,maxSeq:maxSeq,
      name:'استيراد ملف طابور: '+C.fmt(cnt)+' عملية لـ'+(AS.name||'')+' (جهاز '+F.deviceId+')',qty:cnt,code:'',by:C.uid,byName:me,at:C.serverTimestamp()}); }
    catch(e){ errors.push(P.name+': تعذّر تسجيل علامة الاستيراد — '+C.errAr(e.code||e.message)); break; } }
  if(!errors.length){ try{ localStorage.removeItem(pk); }catch(e){} }
  const rep='<div class="cfmsg">'+(errors.length?'⚠ توقّف الاستيراد قبل اكتماله.':'✅ اكتمل الاستيراد.')+' طُبّقت '+C.fmt(applied)+' عملية.</div>'
    +(skipped.length?('<div style="margin-top:8px"><b>«تصفير صنف» لم يُنفَّذ لوجود كمياتٍ أحدث منه على الخادم — راجِعه يدويًّا:</b>'+skipped.map(x=>'<div class="muted" style="font-size:13px">• '+C.esc(x.sess)+' — '+C.esc(x.code)+' (تصفير '+C.esc(C.fmtDT(new Date(x.at)))+'، كميات أحدث: '+C.fmt(x.newer)+')</div>').join('')+'</div>'):'')
    +(blocked.length?('<div style="margin-top:8px"><b>مستثنى:</b>'+blocked.map(b=>'<div class="muted" style="font-size:13px">• '+C.esc(b)+'</div>').join('')+'</div>'):'')
    +(errors.length?('<div style="margin-top:8px;color:var(--danger)"><b>أخطاء:</b>'+errors.map(b=>'<div style="font-size:13px">• '+C.esc(b)+'</div>').join('')+'<div class="muted" style="font-size:12.5px">أعد الاستيراد من هذا الجهاز نفسه بعد عودة الاتصال — يُستأنف من حيث توقّف ولا يُكرِّر ما طُبّق.</div></div>'):'');
  shell('⬆ نتيجة الاستيراد',rep);
  return {ok:!errors.length,applied,skipped,errors,blocked}; }

window.IOMPQ={open,exportQueue,importText,_close:close};
})();
