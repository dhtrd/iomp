/* queue-io.js — «🛡 حماية العدّ» (ورقة اتفاق «حماية العدّ من الضياع»، معتمدة ٢٠٢٦-١٠-٢٤)
   يُحمَّل عند الطلب من index.html (qioLoad) — لا يزيد حجم الصفحة الرئيسية.
   يعرض حالة الجهاز: عدد ما لم يُرسل، الحفظ الدائم (أ)، التثبيت على الشاشة الرئيسية (ب)، النسخة الثانية للطابور (د)، وتنبيه النافذة الخاصة (ج).
   الطبقة و (تصدير/استيراد الطابور) تُضاف هنا في طلب دمجٍ مستقلّ بعد المراجعة المستقلّة. لا يكتب شيئًا في الخادم. */
(function(){
'use strict';
let C=null;
const $=(id)=>document.getElementById(id);

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
        own.length?'محفوظة على هذا الجهاز وتُرسل تلقائيًّا عند عودة الاتصال/الحصّة. لا تمسح بيانات المتصفّح ولا تخرج من الجهاز قبل إرسالها.':'');
  h+=row(p===true?true:(p===false?false:null),'الحفظ الدائم في المتصفّح: '+(p===true?'ممنوح':(p===false?'غير ممنوح':'غير مدعوم/غير معروف')),
        p===true?'لا يمسح المتصفّح بيانات العدّ آليًّا عند ضيق المساحة.':'قد يمسح المتصفّح البيانات عند امتلاء الجهاز. التثبيت على الشاشة الرئيسية يرفع فرص منحه.');
  h+=row(C.installed?true:(C.ios?false:null),'التطبيق مثبّت على الشاشة الرئيسية: '+(C.installed?'نعم':'لا'),
        C.installed?'':(C.ios?'آيفون/آيباد: زرّ المشاركة ← «إضافة إلى الشاشة الرئيسية». سفاري يمسح بيانات المواقع غير المثبّتة بعد ٧ أيام بلا استخدام.':'يُنصح بتثبيته لأجهزة العدّ.'));
  h+=row(C.backend==='idb'?(C.mirrorOk()?true:false):null,'النسخة الثانية من الطابور: '+(C.backend!=='idb'?'غير مطلوبة هنا':(C.mirrorOk()?'تعمل':'تعذّرت (مساحة الجهاز ممتلئة؟)')),'');
  h+=row(null,'النافذة الخاصة/المتخفّية','لا تعدّ فيها — ما لم يُرسل يُمسح عند إغلاقها. المتصفّحات تمنع كشفها آليًّا، فالتنبيه ثابت.');
  h+='<div class="cfrow" style="flex-wrap:wrap;justify-content:flex-start;gap:8px;margin-top:10px">'
    +(C.bip()?'<button id="qioInst" class="btn sm">📲 تثبيت التطبيق</button>':'')+'</div>';
  shell('🛡 حماية العدّ',h);
  if($('qioInst'))$('qioInst').onclick=async()=>{ const b=C.bip(); if(!b)return; try{ await b.prompt(); }catch(e){} };
}

window.IOMPQ={open,_close:close};
})();
