/* مراجعة الفرع للجرد قبل الاعتماد — IOMP | شركة الضبيبي التجارية
   وحدة مستقلّة تُحمَّل عند الطلب فقط (brLoad في index.source.html) فلا تدخل في حجم index.html.
   لا تملك أي وصول خاص: كل ما تحتاجه يُمرَّر عبر ctx من التطبيق (نفس دوال Firestore المُعترَضة لعدّاد الحصّة).

   المبادئ (ورقة الاتفاق — قرارات المالك 2026-10-21):
   • المسار لكل عدّاد = قيوده مرتّبة بوقت الإضافة (entries[].at) — أي ترتيب المشي في الموقع.
     القيود المتتالية للصنف نفسه خطوةٌ واحدة؛ والصنف المعدود في موضعين بينهما أصنافٌ أخرى = خطوتان.
   • المراجعة ملاحظاتٌ فقط: لا تكتب في counts ولا تغيّر أي رقمٍ أو تقرير.
     الكتابة الوحيدة: sessions/{sid}/branchReview/{safeId(code)} و sessions/{sid}/branchReview/__brmeta.
   • تأشير الخطوة يبقى صالحًا ما دامت كميّتها (cq) لم تتغيّر — فبعد الإرجاع للعدّ وإعادة الإقفال
     لا يُراجَع من جديد إلا الجديد أو المتغيّر.
   • لا تكلفة ولا قيم مالية في هذه الشاشة إطلاقًا. */
(function(){
'use strict';
const META='__brmeta';
let X=null;                 // سياق التطبيق
let S=null;                 // حالة الشاشة
let D=null;                 // البيانات المشتقّة

function css(){
  if(document.getElementById('brCss'))return;
  const st=document.createElement('style'); st.id='brCss';
  st.textContent=
  '.br-wrap{display:flex;flex-direction:column;gap:14px;max-width:1100px}'+
  '.br-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px}'+
  '.br-head h2{margin:0;font-size:18px;flex:1;min-width:180px}'+
  '#brMode,#brBack{min-height:44px}'+
  '.br-tabs{display:flex;gap:6px;flex-wrap:wrap}'+
  '.br-tab{border:1px solid var(--border);background:var(--card);color:var(--tsec);font:inherit;font-size:14px;padding:8px 14px;border-radius:10px;cursor:pointer;min-height:44px;display:flex;flex-direction:column;align-items:flex-start;line-height:1.3}'+
  '.br-tab small{font-size:11.5px;color:var(--tmuted)}'+
  '.br-tab.on{border-color:var(--navy700);background:var(--navy100);color:var(--tprimary);font-weight:600}'+
  '.br-prog{display:flex;align-items:center;gap:10px}.br-bar{flex:1;height:8px;background:var(--hair);border-radius:999px;overflow:hidden}.br-bar i{display:block;height:100%;background:var(--success)}'+
  '.br-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
  '.br-q{flex:1 1 240px;height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font:inherit;font-size:15px;background:var(--card);color:var(--tprimary)}'+
  '.br-ch{border:1px solid var(--border);background:var(--card);color:var(--tsec);font:inherit;font-size:13px;padding:0 12px;height:36px;border-radius:999px;cursor:pointer}'+
  '.br-ch.on{border-color:var(--navy700);background:var(--navy100);color:var(--navy700);font-weight:600}'+
  '.br-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--hair);border-radius:12px;background:var(--card)}'+
  '.br-row.ok{background:color-mix(in srgb,var(--success) 7%,var(--card))}.br-row.df{background:color-mix(in srgb,var(--danger) 7%,var(--card))}'+
  '.br-pos{font-weight:700;color:var(--navy700);min-width:36px}'+
  '.br-main{flex:1;min-width:0;cursor:pointer;background:none;border:0;font:inherit;color:inherit;text-align:right;padding:0}'+
  '.br-nm{font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.br-sub{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--tmuted);margin-top:2px}'+
  '.br-qt{display:inline-flex;align-items:center;gap:4px;font-weight:700;font-size:16px;white-space:nowrap}'+
  '.br-bd{display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid transparent;white-space:nowrap}'+
  '.br-b-it{background:#FFF4E5;color:#8A4B00;border-color:#F6D5A8}.br-b-ed{background:#FDECEF;color:#A3203A;border-color:#F5C2CC}.br-b-ru{background:var(--navy100);color:var(--navy700)}'+
  '.br-btn{min-height:44px;min-width:76px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--tsec)}'+
  '.br-btn.k{border-color:#BFE5D1;color:var(--success)}.br-btn.k.on{background:var(--success);border-color:var(--success);color:#fff}'+
  '.br-btn.d{border-color:#F5C2CC;color:var(--danger)}.br-btn.d.on{background:var(--danger);border-color:var(--danger);color:#fff}'+
  '.br-acts{display:flex;gap:6px}'+
  '.br-card{display:flex;flex-direction:column;gap:12px}'+
  '.br-big{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:var(--surface-2);border-radius:14px;font-size:40px;font-weight:700}'+
  '.br-big .sic{width:28px;height:28px}'+
  '.br-occ{border:1px solid #C7D2FE;background:var(--navy100);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.7}'+
  '.br-lnk{background:none;border:0;font:inherit;font-size:13px;color:var(--navy700);cursor:pointer;text-decoration:underline;padding:0;margin-inline-end:12px}'+
  '.br-nums{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:14px}'+
  '.br-ed{display:flex;flex-direction:column;gap:8px}'+
  '.br-in{height:44px;border:1px solid var(--border);border-radius:10px;padding:0 12px;font:inherit;font-size:16px;background:var(--card);color:var(--tprimary)}'+
  '.br-ta{min-height:70px;border:1px solid var(--border);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;resize:vertical;background:var(--card);color:var(--tprimary)}'+
  '.br-nav{display:flex;justify-content:space-between;gap:10px}'+
  '.br-foot{position:sticky;bottom:0;background:var(--page);padding:10px 0;z-index:5}'+
  '.br-send{width:100%;min-height:50px;font-size:16px}'+
  '.br-send[disabled]{opacity:.55;cursor:not-allowed}'+
  '.br-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}'+
  '.br-kpi{border:1px solid var(--hair);border-radius:12px;padding:12px;background:var(--card)}.br-kpi b{display:block;font-size:24px}'+
  '.br-tb{width:100%;border-collapse:collapse;font-size:14px}.br-tb th{text-align:right;font-weight:600;font-size:12.5px;color:var(--tsec);padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap}'+
  '.br-tb td{padding:9px 10px;border-bottom:1px solid var(--hair);vertical-align:top}.br-tb tr.df td{background:color-mix(in srgb,var(--danger) 6%,transparent)}'+
  '@media(max-width:700px){.br-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.br-tb thead{display:none}.br-tb tr{display:block;border-bottom:1px solid var(--border);padding:6px 0}.br-tb td{display:flex;justify-content:space-between;gap:10px;border:0;padding:4px 6px}.br-tb td::before{content:attr(data-l);color:var(--tmuted);font-size:12px}}'+
  '@media(max-width:600px){.br-row{flex-wrap:wrap}.br-acts{width:100%}.br-acts .br-btn{flex:1}}';
  document.head.appendChild(st);
}

/* ───────── البيانات ───────── */
const num=v=>{ const n=Number(v); return isFinite(n)?n:0; };
function hm(ms){ if(!ms)return '—'; try{ return new Date(ms).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return '—'; } }

// يبني مسار كل عدّاد من القيود الحاليّة (بلا أي قراءة إضافية — العدّات في ذاكرة التطبيق أصلًا)
function buildPaths(){
  const counts=X.counts()||{}; const users={};
  Object.keys(counts).forEach(k=>{ const c=counts[k]; if(!c)return; const code=String(c.code!=null?c.code:k);
    (c.entries||[]).forEach(e=>{ if(!e||!num(e.q))return; const u=String(e.by||'?');
      const p=users[u]||(users[u]={uid:u,name:e.byName||'—',list:[]}); if(e.byName)p.name=e.byName;
      p.list.push({code,e}); }); });
  const paths=Object.keys(users).map(u=>{ const p=users[u];
    p.list.sort((a,b)=>(num(a.e.at)-num(b.e.at))||(String(a.e.id)<String(b.e.id)?-1:1));
    const steps=[]; let cur=null;
    p.list.forEach(({code,e})=>{
      if(!cur||cur.code!==code){ cur={uid:u,who:p.name,code,key:u+'_'+String(e.id||e.at),at:num(e.at),q:0,s:0,m:0,n:0,ents:[]}; steps.push(cur); }
      const q=num(e.q), k=X.entrySrc(e); cur.q+=q; if(k==='s'){ cur.s+=q; cur.n+=X.entryN(e); } else if(k==='m')cur.m+=q; cur.ents.push(e); });
    const real=steps.filter(s=>s.q!==0); real.forEach((s,i)=>{ s.pos=i+1; });
    return {uid:u,name:p.name,steps:real}; });
  paths.sort((a,b)=>((a.steps[0]&&a.steps[0].at)||0)-((b.steps[0]&&b.steps[0].at)||0));
  const occ={}; paths.forEach(p=>p.steps.forEach(s=>{ (occ[s.code]=occ[s.code]||[]).push(s); }));
  Object.keys(occ).forEach(c=>occ[c].sort((a,b)=>a.at-b.at));   // «الموضع i من n» بترتيب الوقت عبر كل العدّادين
  const items={}; (X.items()||[]).forEach(it=>{ if(it&&it.code!=null)items[String(it.code)]=it; });
  return {paths,occ,items,counts};
}
function itemOf(code){ return D.items[code]||{code,name:'(صنف غير موجود في القائمة)',book:0}; }
function totalOf(code){ const c=D.counts[code]; return c?num(c.qty):0; }
function markOf(s){ const m=(S.marks[s.code]||{})[s.key]; return (m&&num(m.cq)===s.q)?m:null; }   // تأشيرٌ قديم لكميةٍ تغيّرت ⇒ غير صالح
function allSteps(){ return D.paths.reduce((a,p)=>a.concat(p.steps),[]); }
function editsOf(code){ return S.edits[code]||[]; }
function editText(a){ const nm=String(a.name||''); const i=nm.indexOf('سبب التسوية: '); const why=i>=0?nm.slice(i+13):'';
  return (a.type==='reset'?'صُفِّر الصنف بعد العدّ':'حُذف '+X.fmt(a.qty)+' بعد العدّ')+(why?' — السبب: '+why:'')+(a.byName?' ('+a.byName+')':''); }

async function loadStore(){
  const marks={}; let meta=null;
  const qs=await X.getDocs(X.collection(X.db,'sessions',X.sid,'branchReview'));
  qs.forEach(d=>{ const x=d.data()||{}; if(d.id===META)meta=x; else if(x.code!=null)marks[String(x.code)]=x.m||{}; });
  const edits={};
  try{ const aq=await X.getDocs(X.query(X.collection(X.db,'sessions',X.sid,'activity'),X.where('type','in',['remove','reset'])));
    aq.forEach(d=>{ const a=d.data()||{}; if(a.code==null)return; (edits[String(a.code)]=edits[String(a.code)]||[]).push(a); }); }
  catch(err){ X.toastErr('تعذّر تحميل سجلّ التعديلات بعد العدّ — شارة «عُدِّل» قد لا تظهر: '+X.errAr(err.code||err.message)); }
  return {marks,meta,edits};
}
function metaFresh(m){ return !!(m&&m.submitted===true&&X.tsMs(m.closedAt)===X.tsMs((X.sess()||{}).closedAt)); }

/* ───────── أدوات العرض ───────── */
const E=s=>X.esc(s);
function qtyHtml(s){ const parts=[]; if(s.s)parts.push('<span class="br-qt">'+X.srcIc('s')+X.fmt(s.s)+'</span>'); if(s.m)parts.push('<span class="br-qt">'+X.srcIc('m')+X.fmt(s.m)+'</span>');
  const u=s.q-s.s-s.m; if(u)parts.push('<span class="br-qt">'+X.fmt(u)+'</span>'); return parts.join(' + ')||'<span class="br-qt">'+X.fmt(s.q)+'</span>'; }
function badges(s){ const it=itemOf(s.code), o=D.occ[s.code]||[], b=[];
  if(o.length>1)b.push('<span class="br-bd br-b-ru">الموضع '+(o.indexOf(s)+1)+' من '+o.length+' — الإجمالي '+E(X.fmt(totalOf(s.code)))+'</span>');
  if(s.n>1)b.push('<span class="br-bd br-b-ru">تتابع <bdi>×'+s.n+'</bdi></span>');
  if(it.manual)b.push('<span class="br-bd br-b-it">صنف أُضيف يدويًّا — ليس في الدفتر</span>');
  if(editsOf(s.code).length)b.push('<span class="br-bd br-b-ed">عُدِّل بعد العدّ</span>');
  return b.join(''); }
const FILTERS=[['all','الكل'],['m','يدوي'],['ed','معدَّل'],['add','أصناف مضافة'],['todo','لم يُراجَع']];
function passF(s,f){ return f==='m'?s.m>0:f==='ed'?editsOf(s.code).length>0:f==='add'?!!itemOf(s.code).manual:f==='todo'?!markOf(s):true; }
function passQ(s,q){ if(!q)return true; const it=itemOf(s.code); return (String(it.name||'').toLowerCase().indexOf(q)>=0)||String(s.code).toLowerCase().indexOf(q)>=0||String(it.barcode||'').toLowerCase().indexOf(q)>=0; }
function curPath(){ return D.paths.find(p=>p.uid===S.u)||D.paths[0]; }

/* ───────── شاشة المراجِع (الفرع) ───────── */
function renderReview(){
  const c=document.getElementById('appContent'); if(!c)return;
  const sess=X.sess()||{}; const all=allSteps(); const done=all.filter(markOf).length; const left=all.length-done;
  if(!D.paths.length){ c.innerHTML='<div class="card br-wrap"><div class="br-head"><button class="btn ghost sm" id="brBack">→ رجوع</button><h2>مراجعة الفرع</h2></div><p class="muted">لا عدّات في هذه الجلسة — لا شيء للمراجعة.</p></div>'; bindBack(); return; }
  const p=curPath(); if(!p)return; S.u=p.uid; if(S.i>=p.steps.length)S.i=Math.max(0,p.steps.length-1);
  const tabs=D.paths.map(x=>'<button type="button" class="br-tab'+(x.uid===p.uid?' on':'')+'" data-u="'+E(x.uid)+'">'+E(x.name)+'<small>'+x.steps.length+' خطوة · رُوجع '+x.steps.filter(markOf).length+'</small></button>').join('');
  const stale=S.meta&&S.meta.submitted&&!metaFresh(S.meta);
  let h='<div class="br-wrap"><div class="card" style="margin:0"><div class="br-head"><button class="btn ghost sm" id="brBack">→ رجوع</button><h2>مراجعة الفرع — '+E(sess.name||'')+'</h2>'+
    '<button type="button" class="btn ghost sm" id="brMode">'+(S.mode==='card'?'☰ القائمة':'▢ البطاقة')+'</button></div>'+
    '<div class="muted" style="margin-top:4px">'+E(sess.location||'')+' • الترتيب = ترتيب العدّ الفعلي لكل عدّاد. المراجعة ملاحظاتٌ فقط ولا تغيّر أي كمية.</div>'+
    (metaFresh(S.meta)?'<div class="status show ok" style="margin-top:10px">✓ أُرسلت المراجعة'+(S.meta.byName?' — '+E(S.meta.byName):'')+'. يمكنك التعديل ثم إعادة الإرسال.</div>':'')+
    (stale?'<div class="status show info" style="margin-top:10px">أُعيد الإقفال بعد آخر إرسال — راجِع الخطوات الجديدة أو المتغيّرة ثم أرسل من جديد.</div>':'')+
    '<div class="br-tabs" style="margin-top:12px">'+tabs+'</div>'+
    '<div class="br-prog" style="margin-top:10px"><div class="br-bar"><i style="width:'+(all.length?Math.round(done*100/all.length):0)+'%"></i></div><span class="muted">رُوجع '+done+' من '+all.length+'</span></div></div>';
  h+=(S.mode==='card'?cardHtml(p):listHtml(p));
  h+='<div class="br-foot"><button type="button" class="btn br-send" id="brSend"'+(left>0?' disabled':'')+'>'+(left>0?'إرسال المراجعة (بقي '+left+')':(metaFresh(S.meta)?'إعادة إرسال المراجعة':'إرسال المراجعة'))+'</button></div></div>';
  c.innerHTML=h;
  bindBack();
  c.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{ S.u=b.getAttribute('data-u'); S.i=0; S.ed=null; renderReview(); });
  document.getElementById('brMode').onclick=()=>{ S.mode=S.mode==='card'?'list':'card'; S.ed=null; renderReview(); };
  document.getElementById('brSend').onclick=submit;
  if(S.mode==='card')bindCard(p); else bindList(p);
}
function listHtml(p){
  const q=S.q.trim().toLowerCase(); const rows=p.steps.filter(s=>passF(s,S.f)&&passQ(s,q));
  const chips=FILTERS.map(([id,l])=>'<button type="button" class="br-ch'+(S.f===id?' on':'')+'" data-f="'+id+'">'+l+' · '+p.steps.filter(s=>passF(s,id)).length+'</button>').join('');
  let h='<div class="card" style="margin:0"><div class="br-tools"><input class="br-q" id="brQ" type="search" placeholder="ابحث بالاسم أو الرمز أو امسح الباركود" value="'+E(S.q)+'" autocomplete="off">'+chips+'</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">';
  h+=rows.map(s=>{ const m=markOf(s), it=itemOf(s.code);
    return '<div class="br-row'+(m?(m.v==='ok'?' ok':' df'):'')+'"><span class="br-pos">#'+s.pos+'</span><button type="button" class="br-main" data-open="'+s.pos+'"><span class="br-nm">'+E(it.name||s.code)+'</span><span class="br-sub">'+hm(s.at)+' · '+E(s.code)+badges(s)+(m&&m.nt?' · 📝':'')+'</span></button>'+qtyHtml(s)+
      '<span class="br-acts"><button type="button" class="br-btn k'+(m&&m.v==='ok'?' on':'')+'" data-ok="'+s.pos+'">مطابق</button><button type="button" class="br-btn d'+(m&&m.v==='diff'?' on':'')+'" data-df="'+s.pos+'">مختلف</button></span></div>'; }).join('')||'<p class="muted" style="text-align:center;padding:18px">لا نتائج في مسار هذا العدّاد.</p>';
  return h+'</div></div>';
}
function bindList(p){
  const qi=document.getElementById('brQ'); if(qi){ qi.oninput=()=>{ S.q=qi.value; const pos=qi.selectionStart; renderReview(); const n=document.getElementById('brQ'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} } };
    qi.onkeydown=(ev)=>{ if(ev.key!=='Enter')return; const q=S.q.trim().toLowerCase(); const hit=p.steps.filter(s=>passQ(s,q)); if(hit.length===1){ S.i=p.steps.indexOf(hit[0]); S.mode='card'; renderReview(); } }; }
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ S.f=b.getAttribute('data-f'); renderReview(); });
  const at=pos=>p.steps[Number(pos)-1];
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ S.i=Number(b.getAttribute('data-open'))-1; S.mode='card'; S.ed=null; renderReview(); });
  document.querySelectorAll('[data-ok]').forEach(b=>b.onclick=()=>{ const s=at(b.getAttribute('data-ok')); const m=markOf(s); save(s,'ok',s.q,m?m.nt:''); });
  document.querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>{ S.i=Number(b.getAttribute('data-df'))-1; S.mode='card'; S.ed='diff'; renderReview(); });
}
function cardHtml(p){
  const s=p.steps[S.i]; const it=itemOf(s.code), m=markOf(s), o=D.occ[s.code]||[], tot=totalOf(s.code), book=num(it.book), d=tot-book;
  const ed=S.ed||(m&&m.v==='diff'?'diff':(m&&m.nt?'note':null));
  let h='<div class="card br-card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center"><span class="muted">عُدّ الساعة '+hm(s.at)+' · '+E(p.name)+'</span><span style="font-size:24px;font-weight:700;color:var(--navy500)">#'+s.pos+' / '+p.steps.length+'</span></div>'+
    '<div><div style="font-size:20px;font-weight:700;line-height:1.35">'+E(it.name||s.code)+'</div><div class="muted">'+E(s.code)+(it.unit?' · '+E(it.unit):'')+'</div></div>'+
    '<div class="br-big">'+qtyHtml(s)+'</div>';
  if(o.length>1){ h+='<div class="br-occ"><b>هذا الصنف عُدّ في '+o.length+' مواضع:</b> '+o.map(x=>'<bdi>#'+x.pos+'</bdi>'+(x.uid!==s.uid?' ('+E(x.who)+')':'')+' ← '+E(X.fmt(x.q))).join('، ')+' — الإجمالي '+E(X.fmt(tot))+'. راجِع كمية <b>هذا الموضع فقط</b>.<div style="margin-top:4px">'+
    o.filter(x=>x!==s).sort((a,b)=>(a.uid===s.uid?0:1)-(b.uid===s.uid?0:1)).map(x=>'<button type="button" class="br-lnk" data-jump="'+E(x.uid)+'|'+x.pos+'">اذهب إلى #'+x.pos+(x.uid!==s.uid?' ('+E(x.who)+')':'')+'</button>').join('')+'</div></div>'; }
  h+='<div class="br-nums"><span>الدفتر <b>'+E(X.fmt(book))+'</b></span><span>إجمالي المعدود <b>'+E(X.fmt(tot))+'</b></span><span style="color:'+(d===0?'var(--success)':'var(--danger)')+'">الفرق <b><bdi dir="ltr">'+(d>0?'+':'')+E(X.fmt(d))+'</bdi></b></span></div>';
  const bd=badges(s); if(bd)h+='<div style="display:flex;flex-wrap:wrap;gap:6px">'+bd+'</div>';
  editsOf(s.code).forEach(a=>{ h+='<div class="muted" style="color:var(--danger)">• '+E(editText(a))+'</div>'; });
  h+='<div class="br-acts"><button type="button" class="br-btn k'+(m&&m.v==='ok'?' on':'')+'" id="brOk" style="flex:1;min-height:54px;font-size:17px">مطابق ✓</button><button type="button" class="br-btn d'+((ed==='diff')?' on':'')+'" id="brDf" style="flex:1;min-height:54px;font-size:17px">مختلف</button></div>';
  if(ed==='diff'||ed==='note'){
    h+='<div class="br-ed">'+(ed==='diff'?'<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:600;color:var(--danger)">الكمية الفعلية في هذا الموضع<input class="br-in" id="brAct" inputmode="decimal" style="width:110px;text-align:center" value="'+E(m&&m.v==='diff'?m.a:'')+'" placeholder="'+E(X.fmt(s.q))+'"></label>':'')+
      '<textarea class="br-ta" id="brNote" maxlength="500" placeholder="ملاحظة الفرع (يراها المدير)">'+E(m?m.nt||'':'')+'</textarea>'+
      '<button type="button" class="btn" id="brSave" style="min-height:44px">حفظ'+(ed==='diff'?' «مختلف»':' الملاحظة')+'</button></div>';
  } else h+='<button type="button" class="br-lnk" id="brAddNote" style="align-self:flex-start">+ إضافة ملاحظة</button>';
  h+='</div><div class="br-nav"><button type="button" class="btn ghost" id="brPrev"'+(S.i<=0?' disabled':'')+'>→ السابق</button><button type="button" class="btn ghost" id="brNext"'+(S.i>=p.steps.length-1?' disabled':'')+'>التالي ←</button></div>';
  return h;
}
function bindCard(p){
  const s=p.steps[S.i]; const m=markOf(s);
  const go=i=>{ S.i=Math.max(0,Math.min(p.steps.length-1,i)); S.ed=null; renderReview(); window.scrollTo(0,0); };
  document.getElementById('brPrev').onclick=()=>go(S.i-1);
  document.getElementById('brNext').onclick=()=>go(S.i+1);
  document.getElementById('brOk').onclick=async()=>{ const ok=await save(s,'ok',s.q,m?m.nt||'':''); if(ok&&S.i<p.steps.length-1)go(S.i+1); };
  document.getElementById('brDf').onclick=()=>{ S.ed='diff'; renderReview(); const a=document.getElementById('brAct'); if(a)a.focus(); };
  const an=document.getElementById('brAddNote'); if(an)an.onclick=()=>{ S.ed='note'; renderReview(); const t=document.getElementById('brNote'); if(t)t.focus(); };
  const sv=document.getElementById('brSave'); if(sv)sv.onclick=async()=>{
    const note=String((document.getElementById('brNote')||{}).value||'').trim().slice(0,500);
    const ai=document.getElementById('brAct');
    if(ai){ const a=X.numv(ai.value); if(a==null||a<0){ X.toastErr('أدخل الكمية الفعلية في هذا الموضع (رقم صفر أو أكبر).'); ai.focus(); return; }
      if(await save(s,'diff',a,note)){ S.ed=null; renderReview(); } }
    else if(await save(s,m?m.v:'ok',m?num(m.a):s.q,note)){ S.ed=null; renderReview(); } };
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{ const [u,pos]=b.getAttribute('data-jump').split('|'); S.u=u; go(Number(pos)-1); });
}
function bindBack(){ const b=document.getElementById('brBack'); if(b)b.onclick=()=>{ S=null; X.back(); }; }

async function save(s,v,a,note){
  const ref=X.doc(X.db,'sessions',X.sid,'branchReview',X.safeId(s.code));
  const mk={v:v,a:num(a),nt:String(note||'').slice(0,500),cq:s.q,at:Date.now()};
  const m={}; m[s.key]=mk;
  try{ await X.setDoc(ref,{code:String(s.code),m:m,by:X.uid,byName:(X.me&&X.me.name)||'',at:X.serverTimestamp()},{merge:true});
    S.marks[s.code]=Object.assign({},S.marks[s.code]||{},m); renderReview(); return true; }
  catch(err){ X.toastErr('تعذّر حفظ مراجعة «'+(itemOf(s.code).name||s.code)+'»: '+X.errAr(err.code||err.message)+' — لم يُحفظ هذا التأشير، أعد المحاولة.'); return false; }
}
async function submit(){
  const all=allSteps(); const left=all.filter(s=>!markOf(s)).length;
  if(left>0){ X.toastErr('بقي '+left+' خطوة لم تُراجَع — أكمل المراجعة أولًا.'); return; }
  const ms=all.map(markOf); const diff=ms.filter(m=>m.v==='diff').length, notes=ms.filter(m=>m.nt).length;
  if(!(await X.confirmDialog({title:'إرسال مراجعة الفرع',message:'مطابق: '+(all.length-diff)+' • مختلف: '+diff+' • ملاحظات: '+notes+'\nستظهر المراجعة للمدير، ولا تتغيّر أي كمية معدودة.',confirmLabel:'إرسال'})))return;
  const sess=X.sess()||{};
  const meta={submitted:true,by:X.uid,byName:(X.me&&X.me.name)||'',at:X.serverTimestamp(),closedAt:sess.closedAt==null?null:sess.closedAt,steps:all.length,ok:all.length-diff,diff:diff,notes:notes};
  try{ await X.setDoc(X.doc(X.db,'sessions',X.sid,'branchReview',META),meta);
    S.meta=Object.assign({},meta,{at:null}); X.toastOk('أُرسلت مراجعة الفرع ✓ — بانتظار المدير'); renderReview(); }
  catch(err){ X.toastErr('تعذّر إرسال المراجعة: '+X.errAr(err.code||err.message)+' — لم تُرسَل، أعد المحاولة.'); }
}

/* ───────── شاشة المدير: ملاحظات الفرع ───────── */
function renderNotes(){
  const c=document.getElementById('appContent'); if(!c)return; const sess=X.sess()||{};
  const all=allSteps(); const rows=all.map(s=>({s,m:markOf(s)}));
  const marked=rows.filter(r=>r.m), diff=marked.filter(r=>r.m.v==='diff'), noted=marked.filter(r=>r.m.nt);
  const f=S.nf||'diff'; const show=f==='diff'?diff:f==='note'?noted:rows;
  const meta=S.meta; const fresh=metaFresh(meta);
  const st=fresh?'<div class="status show ok">✓ أرسلها '+E(meta.byName||'مسؤول الفرع')+(meta.at?' • '+E(X.fmtDT(meta.at)):'')+'</div>'
    :(meta&&meta.submitted?'<div class="status show info">أُرسلت مراجعة سابقة قبل إعادة الإقفال الأخيرة — بانتظار إرسالٍ جديد من الفرع.</div>'
      :'<div class="status show info">لم يرسل الفرع مراجعته بعد — زر «تمت المراجعة» يبقى موقوفًا حتى الإرسال.</div>');
  const kp=[['خطوات رُوجعت',marked.length+' / '+all.length,''],['مطابق',marked.length-diff.length,'color:var(--success)'],['مختلف',diff.length,'color:var(--danger)'],['ملاحظات الفرع',noted.length,'']];
  let h='<div class="br-wrap"><div class="card" style="margin:0"><div class="br-head"><button class="btn ghost sm" id="brBack">→ رجوع</button><h2>ملاحظات مراجعة الفرع — '+E(sess.name||'')+'</h2></div>'+
    '<div style="margin-top:8px">'+st+'</div><div class="br-kpis" style="margin-top:12px">'+kp.map(k=>'<div class="br-kpi"><span class="muted">'+k[0]+'</span><b style="'+k[2]+'">'+E(k[1])+'</b></div>').join('')+'</div>'+
    '<div class="br-tools" style="margin-top:12px">'+[['diff','المختلف فقط'],['note','فيها ملاحظة'],['all','الكل']].map(([id,l])=>'<button type="button" class="br-ch'+(f===id?' on':'')+'" data-nf="'+id+'">'+l+'</button>').join('')+'</div></div>'+
    '<div class="card" style="margin:0;overflow:auto"><table class="br-tb"><thead><tr><th>الخطوة</th><th>العدّاد</th><th>الصنف</th><th>الدفتر</th><th>المعدود</th><th>الفعلي حسب الفرع</th><th>ملاحظة الفرع</th></tr></thead><tbody>'+
    (show.map(({s,m})=>{ const it=itemOf(s.code), o=D.occ[s.code]||[];
      return '<tr'+(m&&m.v==='diff'?' class="df"':'')+'><td data-l="الخطوة" style="font-weight:700;color:var(--navy700)">#'+s.pos+'</td><td data-l="العدّاد">'+E(s.who)+'</td><td data-l="الصنف"><div><b>'+E(it.name||s.code)+'</b><div class="muted">'+E(s.code)+(o.length>1?' · الموضع '+(o.indexOf(s)+1)+' من '+o.length:'')+(it.manual?' · مضاف يدويًّا':'')+(editsOf(s.code).length?' · عُدِّل بعد العدّ':'')+'</div></div></td>'+
        '<td data-l="الدفتر">'+E(X.fmt(num(it.book)))+'</td><td data-l="المعدود">'+qtyHtml(s)+'</td><td data-l="الفعلي حسب الفرع" style="font-weight:700;color:'+(!m?'var(--tmuted)':m.v==='diff'?'var(--danger)':'var(--success)')+'">'+(m?E(X.fmt(m.v==='diff'?m.a:s.q)):'لم يُراجَع')+'</td><td data-l="ملاحظة الفرع">'+(m&&m.nt?E(m.nt):'—')+'</td></tr>'; }).join('')||'<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">لا شيء هنا.</td></tr>')+
    '</tbody></table></div><p class="muted">المراجعة ملاحظاتٌ فقط ولا تغيّر أي كمية. إن لزم التصحيح فبإرجاع الجلسة للعدّ أو بالتسوية المعتادة مع سببها.</p></div>';
  c.innerHTML=h; bindBack();
  c.querySelectorAll('[data-nf]').forEach(b=>b.onclick=()=>{ S.nf=b.getAttribute('data-nf'); renderNotes(); });
}

/* ───────── نقطة الدخول ───────── */
async function open(ctx){
  X=ctx; css();
  const c=document.getElementById('appContent'); if(c)c.innerHTML='<div class="card"><p class="muted">جارٍ تحميل مراجعة الفرع…</p></div>';
  let tries=0; while(!X.got()&&tries<60){ await new Promise(r=>setTimeout(r,300)); tries++; if(X.sid!==X.curSid())return; }
  if(!X.got()){ if(c)c.innerHTML='<div class="card"><button class="btn ghost sm" id="brBack">→ رجوع</button><p class="status show err" style="margin-top:12px">تعذّر تحميل عدّات الجلسة — لا يمكن بدء المراجعة دون العدّات كاملة. تحقّق من الاتصال ثم أعد المحاولة.</p></div>'; S={}; bindBack(); return; }
  let store; try{ store=await loadStore(); }
  catch(err){ if(c)c.innerHTML='<div class="card"><button class="btn ghost sm" id="brBack">→ رجوع</button><p class="status show err" style="margin-top:12px">تعذّر تحميل المراجعة: '+X.esc(X.errAr(err.code||err.message))+'</p></div>'; S={}; bindBack(); return; }
  if(X.sid!==X.curSid())return;
  D=buildPaths();
  S={u:(D.paths[0]||{}).uid,i:0,q:'',f:'all',ed:null,nf:'diff',mode:(window.innerWidth>=1024?'list':'card'),marks:store.marks,meta:store.meta,edits:store.edits};
  window.scrollTo(0,0);
  if(X.mode==='notes')renderNotes(); else renderReview();
}
window.IOMPBR={open:open,_paths:()=>D&&D.paths,_state:()=>S};
})();
