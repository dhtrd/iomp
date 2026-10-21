/* مراجعة الفرع للجرد قبل الاعتماد — IOMP | شركة الضبيبي التجارية
   وحدة مستقلّة تُحمَّل عند الطلب فقط (brLoad في index.source.html) فلا تدخل في حجم index.html.
   لا تملك أي وصول خاص: كل ما تحتاجه يُمرَّر عبر ctx من التطبيق (نفس دوال Firestore المُعترَضة لعدّاد الحصّة).

   المبادئ (ورقة الاتفاق — قرارات المالك 2026-10-21):
   • المسار لكل عدّاد = قيوده مرتّبة بوقت الإضافة (entries[].at) — أي ترتيب المشي في الموقع.
     القيود المتتالية للصنف نفسه خطوةٌ واحدة؛ والصنف المعدود في موضعين بينهما أصنافٌ أخرى = خطوتان.
   • المراجعة ملاحظاتٌ فقط: لا تكتب في counts ولا تغيّر أي رقمٍ أو تقرير.
     الكتابة الوحيدة: sessions/{sid}/branchReview/p_<uid العدّاد> (تأشيرات مساره) و __brmeta (الإرسال).
   • الحصّة: التأشيرات تُجمَّع وتُحفظ دفعةً (كل ٢٠ تأشيرًا أو بعد ٦ ثوانٍ أو عند الإرسال/الخروج)
     في مستندٍ واحد لكل عدّاد ⇒ عشرات الكتابات للجرد كله لا ألفًا ونصف، وفتح الشاشة = قراءة مستندٍ لكل عدّاد.
     غير المحفوظ ظاهرٌ دائمًا في الترويسة، والفشل يُعلَن ولا يُبتلع.
   • تأشير الخطوة يبقى صالحًا ما دامت كميّتها (cq) لم تتغيّر — فبعد الإرجاع للعدّ وإعادة الإقفال
     لا يُراجَع من جديد إلا الجديد أو المتغيّر.
   • لا تكلفة ولا قيم مالية في هذه الشاشة إطلاقًا. */
(function(){
'use strict';
const META='__brmeta', FLUSH_N=20, FLUSH_MS=6000;
let X=null;                 // سياق التطبيق
let S=null;                 // حالة الشاشة
let D=null;                 // البيانات المشتقّة (تُعاد بناؤها حين تتغيّر العدّات/الأصناف — قد تصل من الخادم بعد الكاش)

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
  '.br-prog{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.br-bar{flex:1;min-width:120px;height:8px;background:var(--hair);border-radius:999px;overflow:hidden}.br-bar i{display:block;height:100%;background:var(--success)}'+
  '.br-pend{font-size:12.5px;font-weight:600;color:var(--warn)}.br-pend.err{color:var(--danger)}'+
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
  '.br-lnk{background:none;border:0;font:inherit;font-size:13px;color:var(--navy700);cursor:pointer;text-decoration:underline;padding:0;margin-inline-end:12px;min-height:32px}'+
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
    p.list.sort((a,b)=>(num(a.e.at)-num(b.e.at))||(String(a.e.id)<String(b.e.id)?-1:(String(a.e.id)>String(b.e.id)?1:0)));
    const steps=[]; let cur=null;
    p.list.forEach(({code,e})=>{
      if(!cur||cur.code!==code){ cur={uid:u,who:p.name,code,key:u+'_'+String(e.id||e.at),at:num(e.at),q:0,s:0,m:0,n:0}; steps.push(cur); }
      const q=num(e.q), k=X.entrySrc(e); cur.q+=q; if(k==='s'){ cur.s+=q; cur.n+=X.entryN(e); } else if(k==='m')cur.m+=q; });
    const real=steps.filter(s=>s.q!==0); real.forEach((s,i)=>{ s.pos=i+1; });
    return {uid:u,name:p.name,steps:real}; });
  paths.sort((a,b)=>((a.steps[0]&&a.steps[0].at)||0)-((b.steps[0]&&b.steps[0].at)||0));
  const occ={}; paths.forEach(p=>p.steps.forEach(s=>{ (occ[s.code]=occ[s.code]||[]).push(s); }));
  Object.keys(occ).forEach(c=>occ[c].sort((a,b)=>a.at-b.at));   // «الموضع i من n» بترتيب الوقت عبر كل العدّادين
  const items={}; (X.items()||[]).forEach(it=>{ if(it&&it.code!=null)items[String(it.code)]=it; });
  return {paths,occ,items,counts,sig:dataSig()};
}
function dataSig(){ return [X.counts(),X.items()]; }
function sigSame(a,b){ return !!(a&&b&&a[0]===b[0]&&a[1]===b[1]); }
function rebuild(){ if(!D||!sigSame(D.sig,dataSig()))D=buildPaths(); }
function itemOf(code){ return D.items[code]||{code,name:'(صنف غير موجود في القائمة)',book:0}; }
function totalOf(code){ const c=D.counts[code]; return c?num(c.qty):0; }
function markOf(s){ const m=S.marks[s.key]; return (m&&num(m.cq)===s.q)?m:null; }   // تأشيرٌ قديم لكميةٍ تغيّرت ⇒ غير صالح
function allSteps(){ return D.paths.reduce((a,p)=>a.concat(p.steps),[]); }
function editsOf(code){ return S.edits[code]||[]; }
function editText(a){ const nm=String(a.name||''); const i=nm.indexOf('سبب التسوية: '); const why=i>=0?nm.slice(i+13):'';
  return (a.type==='reset'?'صُفِّر الصنف بعد العدّ':'حُذف '+X.fmt(a.qty)+' بعد العدّ')+(why?' — السبب: '+why:'')+(a.byName?' ('+a.byName+')':''); }

async function loadStore(){
  const marks={}; let meta=null;
  const qs=await X.getDocs(X.collection(X.db,'sessions',X.sid,'branchReview'));
  qs.forEach(d=>{ const x=d.data()||{}; if(d.id===META){ meta=x; return; }
    if(d.id.indexOf('p_')===0&&x.m&&typeof x.m==='object')Object.keys(x.m).forEach(k=>{ marks[k]=x.m[k]; }); });
  const edits={};
  try{ const aq=await X.getDocs(X.query(X.collection(X.db,'sessions',X.sid,'activity'),X.where('type','in',['remove','reset'])));
    aq.forEach(d=>{ const a=d.data()||{}; if(a.code==null)return; (edits[String(a.code)]=edits[String(a.code)]||[]).push(a); }); }
  catch(err){ X.toastErr('تعذّر تحميل سجلّ التعديلات بعد العدّ — شارة «عُدِّل» قد لا تظهر: '+X.errAr(err.code||err.message)); }
  return {marks,meta,edits};
}
function metaFresh(m){ return !!(m&&m.submitted===true&&X.tsMs(m.closedAt)===X.tsMs((X.sess()||{}).closedAt)); }
function tally(){ const ms=allSteps().map(markOf); const diff=ms.filter(m=>m&&m.v==='diff').length;
  return {steps:ms.length, left:ms.filter(m=>!m).length, ok:ms.filter(m=>m&&m.v==='ok').length, diff, notes:ms.filter(m=>m&&m.nt).length}; }

/* ───────── الحفظ المجمَّع ───────── */
function pendN(st){ st=st||S; return st?Object.keys(st.pend).reduce((a,u)=>a+Object.keys(st.pend[u]).length,0):0; }
function setMark(s,v,a,note){
  const mk={c:String(s.code),v:v,a:num(a),nt:String(note||'').slice(0,200),cq:s.q,at:Date.now()};
  S.marks[s.key]=mk; (S.pend[s.uid]=S.pend[s.uid]||{})[s.key]=mk; S.dirtyMeta=true;
  if(pendN()>=FLUSH_N)flush(); else { clearTimeout(S.ft); S.ft=setTimeout(()=>flush(),FLUSH_MS); }
}
// كل حفظٍ مربوطٌ بحالته (st) وسياقه (st.x) ساعة بدئه — لا يكتب في جلسةٍ أخرى إن فُتحت مراجعةٌ غيرها أثناءه
function flush(st){
  st=st||S; if(!st)return Promise.resolve(true); clearTimeout(st.ft);
  if(st.flushing)return st.flushing.then(()=>flush(st));
  const x=st.x;
  const run=async()=>{
    let bad=null;
    for(const u of Object.keys(st.pend)){ const part=Object.assign({},st.pend[u]); const keys=Object.keys(part); if(!keys.length)continue;
      try{ await x.setDoc(x.doc(x.db,'sessions',x.sid,'branchReview','p_'+u),{u:u,m:part,by:x.uid,byName:(x.me&&x.me.name)||'',at:x.serverTimestamp()},{merge:true});
        keys.forEach(k=>{ if(st.pend[u]&&st.pend[u][k]===part[k])delete st.pend[u][k]; }); }
      catch(err){ bad=err; } }
    if(!bad&&st.dirtyMeta&&st===S&&metaFresh(st.meta)){ // تعديلٌ بعد الإرسال ⇒ يُحدَّث ملخّص الإرسال نفسه بأرقامه الجديدة
      const t=tally(); if(t.left===0){ try{ await writeMeta(st,t); }catch(err){ bad=err; } } }
    if(bad){
      const sst=((x.sess()||{}).status), gone=bad.code==='permission-denied'||(x.sid===x.curSid()&&sst&&sst!=='review');   // خرجت الجلسة من «قيد المراجعة» ⇒ لا حلقة إعادة محاولةٍ بلا نهاية
      if(gone){ x.toastErr('لم تُحفظ '+pendN(st)+' تأشيرات: الجلسة لم تعد «قيد المراجعة» (أو رُفض الحفظ) — لا تُعاد المحاولة.'); stop(st); return false; }
      st.flushErr=true; x.toastErr('تعذّر حفظ '+pendN(st)+' تأشيرًا: '+x.errAr(bad.code||bad.message)+' — ستبقى ظاهرةً «غير محفوظة» وتُعاد المحاولة تلقائيًّا.'); clearTimeout(st.ft); st.ft=setTimeout(()=>flush(st),FLUSH_MS*3); }
    else { st.flushErr=false; if(!pendN(st))st.dirtyMeta=false; }
    if(st===S)updPend(); return !bad;
  };
  st.flushing=run().finally(()=>{ st.flushing=null; }); return st.flushing;
}
async function writeMeta(st,t){ const x=st.x; const sess=x.sess()||{};
  const meta={submitted:true,by:x.uid,byName:(x.me&&x.me.name)||'',at:x.serverTimestamp(),closedAt:sess.closedAt==null?null:sess.closedAt,steps:t.steps,ok:t.ok,diff:t.diff,notes:t.notes};
  await x.setDoc(x.doc(x.db,'sessions',x.sid,'branchReview',META),meta); st.meta=Object.assign({},meta,{at:null}); }
function updPend(){ const el=document.getElementById('brPend'); if(!el||!S)return; const n=pendN();
  el.className='br-pend'+(S.flushErr?' err':''); el.textContent=n?(S.flushErr?'⚠ غير محفوظ: '+n+' — تُعاد المحاولة':'⏳ لم يُحفظ بعد: '+n):''; }
async function leave(){
  if(pendN()&&!(await flush())){ if(!(await X.confirmDialog({title:'تأشيرات غير محفوظة',message:'تعذّر حفظ '+pendN()+' تأشيرًا. إن خرجت الآن ستضيع. هل تخرج دونها؟',confirmLabel:'اخرج دون حفظ',danger:true})))return; }
  stop(); X.back(); }
function stop(st){ st=st||S; if(!st)return; clearTimeout(st.ft); clearInterval(st.poll); try{ if(st.unsrv)st.unsrv(); }catch(e){}
  document.removeEventListener('visibilitychange',st.vis); window.removeEventListener('beforeunload',st.bu); st.pend={}; if(S===st)S=null; }
const srvOk=()=>!!(S&&S.srvOk);

/* ───────── أدوات العرض ───────── */
const E=s=>X.esc(s);
const Q=s=>X.arNorm(String(s==null?'':s));
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
function passQ(s,q){ if(!q)return true; const it=itemOf(s.code); const c=String(s.code), bc=String(it.barcode||''), q0=q.replace(/^0+(?=\d)/,'');
  return Q(it.name).indexOf(q)>=0||Q(c).indexOf(q)>=0||Q(bc).indexOf(q)>=0||(q0!==q&&(c===q0||bc===q0)); }   // كالماسح: يقبل الأصفار البادئة
function curPath(){ return D.paths.find(p=>p.uid===S.u)||D.paths[0]; }
function onScreen(){ return !!(S&&document.getElementById(S.mode==='notes'?'brNotesRoot':'brRoot')); }

/* ───────── شاشة المراجِع (الفرع) ───────── */
function renderReview(){
  const c=document.getElementById('appContent'); if(!c||!S)return; rebuild();
  const sess=X.sess()||{}; const t=tally();
  const p=curPath(); if(p){ S.u=p.uid; if(S.i>=p.steps.length)S.i=Math.max(0,p.steps.length-1); }
  const tabs=D.paths.map(x=>'<button type="button" class="br-tab'+(x.uid===S.u?' on':'')+'" data-u="'+E(x.uid)+'">'+E(x.name)+'<small>'+x.steps.length+' خطوة · رُوجع '+x.steps.filter(markOf).length+'</small></button>').join('');
  const stale=S.meta&&S.meta.submitted&&!metaFresh(S.meta);
  let h='<div class="br-wrap" id="brRoot"><div class="card" style="margin:0"><div class="br-head"><button class="btn ghost sm" id="brBack">→ رجوع</button><h2>مراجعة الفرع — '+E(sess.name||'')+'</h2>'+
    (p?'<button type="button" class="btn ghost sm" id="brMode">'+(S.view==='card'?'☰ القائمة':'▢ البطاقة')+'</button>':'')+'</div>'+
    '<div class="muted" style="margin-top:4px">'+E(sess.location||'')+' • الترتيب = ترتيب العدّ الفعلي لكل عدّاد. المراجعة ملاحظاتٌ فقط ولا تغيّر أي كمية.</div>'+
    (!srvOk()?'<div class="status show info" style="margin-top:10px">⏳ العدّات معروضة من نسخة الجهاز — بانتظار تأكيدها من الخادم قبل الإرسال.</div>':'')+
    (metaFresh(S.meta)?'<div class="status show ok" style="margin-top:10px">✓ أُرسلت المراجعة'+(S.meta.byName?' — '+E(S.meta.byName):'')+'. أي تعديلٍ بعدها يُحدِّث الإرسال تلقائيًّا.</div>':'')+
    (stale?'<div class="status show info" style="margin-top:10px">أُعيد الإقفال بعد آخر إرسال — راجِع الخطوات الجديدة أو المتغيّرة ثم أرسل من جديد.</div>':'')+
    (p?'<div class="br-tabs" style="margin-top:12px">'+tabs+'</div>':'')+
    '<div class="br-prog" style="margin-top:10px"><div class="br-bar"><i style="width:'+(t.steps?Math.round((t.steps-t.left)*100/t.steps):100)+'%"></i></div><span class="muted">رُوجع '+(t.steps-t.left)+' من '+t.steps+'</span><span id="brPend"></span></div></div>';
  if(!p)h+='<div class="card" style="margin:0"><p class="muted">لا عدّات في هذه الجلسة — لا خطوات للمراجعة. أرسل المراجعة لتأكيد ذلك.</p></div>';
  else h+=(S.view==='card'?cardHtml(p):listHtml(p));
  const label=t.left>0?'إرسال المراجعة (بقي '+t.left+')':(metaFresh(S.meta)?'إعادة إرسال المراجعة':'إرسال المراجعة');
  h+='<div class="br-foot"><button type="button" class="btn br-send" id="brSend"'+(t.left>0?' disabled':'')+'>'+label+'</button></div></div>';
  c.innerHTML=h; updPend();
  document.getElementById('brBack').onclick=leave;
  c.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{ S.u=b.getAttribute('data-u'); S.i=0; S.ed=null; renderReview(); });
  const md=document.getElementById('brMode'); if(md)md.onclick=()=>{ S.view=S.view==='card'?'list':'card'; S.ed=null; renderReview(); };
  document.getElementById('brSend').onclick=submit;
  if(p){ if(S.view==='card')bindCard(p); else bindList(p); }
}
function rowsHtml(p){ const q=Q(S.q.trim()); const rows=p.steps.filter(s=>passF(s,S.f)&&passQ(s,q));
  return rows.map(s=>{ const m=markOf(s), it=itemOf(s.code);
    return '<div class="br-row'+(m?(m.v==='ok'?' ok':' df'):'')+'"><span class="br-pos">#'+s.pos+'</span><button type="button" class="br-main" data-open="'+s.pos+'"><span class="br-nm">'+E(it.name||s.code)+'</span><span class="br-sub">'+hm(s.at)+' · '+E(s.code)+badges(s)+(m&&m.nt?' · 📝':'')+'</span></button>'+qtyHtml(s)+
      '<span class="br-acts"><button type="button" class="br-btn k'+(m&&m.v==='ok'?' on':'')+'" data-ok="'+s.pos+'">مطابق</button><button type="button" class="br-btn d'+(m&&m.v==='diff'?' on':'')+'" data-df="'+s.pos+'">مختلف</button></span></div>'; }).join('')
    ||'<p class="muted" style="text-align:center;padding:18px">لا نتائج في مسار هذا العدّاد.</p>'; }
function listHtml(p){
  const chips=FILTERS.map(([id,l])=>'<button type="button" class="br-ch'+(S.f===id?' on':'')+'" data-f="'+id+'">'+l+' · '+p.steps.filter(s=>passF(s,id)).length+'</button>').join('');
  return '<div class="card" style="margin:0"><div class="br-tools"><input class="br-q" id="brQ" type="search" placeholder="ابحث بالاسم أو الرمز أو امسح الباركود" value="'+E(S.q)+'" autocomplete="off">'+chips+'</div><div id="brRows" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'+rowsHtml(p)+'</div></div>';
}
function bindRows(p){
  const at=pos=>p.steps[Number(pos)-1];
  document.querySelectorAll('#brRows [data-open]').forEach(b=>b.onclick=()=>{ S.i=Number(b.getAttribute('data-open'))-1; S.view='card'; S.ed=null; renderReview(); });
  document.querySelectorAll('#brRows [data-ok]').forEach(b=>b.onclick=()=>{ const s=at(b.getAttribute('data-ok')); const m=markOf(s); setMark(s,'ok',s.q,m?m.nt:''); renderReview(); });
  document.querySelectorAll('#brRows [data-df]').forEach(b=>b.onclick=()=>{ S.i=Number(b.getAttribute('data-df'))-1; S.view='card'; S.ed='diff'; renderReview(); });
}
function bindList(p){
  const qi=document.getElementById('brQ');
  if(qi){ qi.oninput=()=>{ S.q=qi.value; const r=document.getElementById('brRows'); if(r){ r.innerHTML=rowsHtml(p); bindRows(p); } };   // القائمة وحدها — خانة البحث لا يُعاد بناؤها (لوحات المفاتيح العربية/التنبّؤ)
    qi.onkeydown=(ev)=>{ if(ev.key!=='Enter')return; const q=Q(S.q.trim()); const hit=p.steps.filter(s=>passQ(s,q)); if(hit.length===1){ S.i=p.steps.indexOf(hit[0]); S.view='card'; renderReview(); } }; }
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ S.f=b.getAttribute('data-f'); renderReview(); });
  bindRows(p);
}
function cardHtml(p){
  const s=p.steps[S.i]; const it=itemOf(s.code), m=markOf(s), o=D.occ[s.code]||[], tot=totalOf(s.code), book=num(it.book), d=tot-book;
  const ed=S.ed||(m&&m.v==='diff'?'diff':(m&&m.nt?'note':null));
  let h='<div class="card br-card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center"><span class="muted">عُدّ الساعة '+hm(s.at)+' · '+E(p.name)+'</span><span style="font-size:24px;font-weight:700;color:var(--navy500)">#'+s.pos+' / '+p.steps.length+'</span></div>'+
    '<div><div style="font-size:20px;font-weight:700;line-height:1.35">'+E(it.name||s.code)+'</div><div class="muted">'+E(s.code)+(it.unit?' · '+E(it.unit):'')+'</div></div>'+
    '<div class="br-big">'+qtyHtml(s)+'</div>';
  if(o.length>1){ h+='<div class="br-occ"><b>هذا الصنف عُدّ في '+o.length+' مواضع:</b> '+o.map(x=>'<bdi>#'+x.pos+'</bdi>'+(x.uid!==s.uid?' ('+E(x.who)+')':'')+' ← '+E(X.fmt(x.q))).join('، ')+' — الإجمالي '+E(X.fmt(tot))+'. راجِع كمية <b>هذا الموضع فقط</b>.<div style="margin-top:4px">'+
    o.filter(x=>x!==s).sort((a,b)=>(a.uid===s.uid?0:1)-(b.uid===s.uid?0:1)).map(x=>'<button type="button" class="br-lnk" data-jump="'+E(x.key)+'">اذهب إلى #'+x.pos+(x.uid!==s.uid?' ('+E(x.who)+')':'')+'</button>').join('')+'</div></div>'; }
  h+='<div class="br-nums"><span>الدفتر <b>'+E(X.fmt(book))+'</b></span><span>إجمالي المعدود <b>'+E(X.fmt(tot))+'</b></span><span style="color:'+(d===0?'var(--success)':'var(--danger)')+'">الفرق <b><bdi dir="ltr">'+(d>0?'+':'')+E(X.fmt(d))+'</bdi></b></span></div>';
  const bd=badges(s); if(bd)h+='<div style="display:flex;flex-wrap:wrap;gap:6px">'+bd+'</div>';
  editsOf(s.code).forEach(a=>{ h+='<div class="muted" style="color:var(--danger)">• '+E(editText(a))+'</div>'; });
  h+='<div class="br-acts"><button type="button" class="br-btn k'+(m&&m.v==='ok'?' on':'')+'" id="brOk" style="flex:1;min-height:54px;font-size:17px">مطابق ✓</button><button type="button" class="br-btn d'+((ed==='diff')?' on':'')+'" id="brDf" style="flex:1;min-height:54px;font-size:17px">مختلف</button></div>';
  if(ed==='diff'||ed==='note'){
    h+='<div class="br-ed">'+(ed==='diff'?'<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:600;color:var(--danger)">الكمية الفعلية في هذا الموضع<input class="br-in" id="brAct" inputmode="decimal" style="width:110px;text-align:center" value="'+E(m&&m.v==='diff'?m.a:'')+'" placeholder="'+E(X.fmt(s.q))+'"></label>':'')+
      '<textarea class="br-ta" id="brNote" maxlength="200" placeholder="ملاحظة الفرع (يراها المدير)">'+E(m?m.nt||'':'')+'</textarea>'+
      '<button type="button" class="btn" id="brSave" style="min-height:44px">حفظ'+(ed==='diff'?' «مختلف»':' الملاحظة')+'</button></div>';
  } else if(m) h+='<button type="button" class="br-lnk" id="brAddNote" style="align-self:flex-start">+ إضافة ملاحظة</button>';   // الملاحظة بعد التأشير فقط — فلا يُسجَّل «مطابق» ضمنيًّا
  h+='</div><div class="br-nav"><button type="button" class="btn ghost" id="brPrev"'+(S.i<=0?' disabled':'')+'>→ السابق</button><button type="button" class="btn ghost" id="brNext"'+(S.i>=p.steps.length-1?' disabled':'')+'>التالي ←</button></div>';
  return h;
}
function bindCard(p){
  const s=p.steps[S.i]; const m=markOf(s);
  const go=i=>{ S.i=Math.max(0,Math.min(p.steps.length-1,i)); S.ed=null; renderReview(); window.scrollTo(0,0); };
  document.getElementById('brPrev').onclick=()=>go(S.i-1);
  document.getElementById('brNext').onclick=()=>go(S.i+1);
  document.getElementById('brOk').onclick=()=>{ setMark(s,'ok',s.q,m?m.nt||'':''); if(S.i<p.steps.length-1)go(S.i+1); else renderReview(); };
  document.getElementById('brDf').onclick=()=>{ S.ed='diff'; renderReview(); const a=document.getElementById('brAct'); if(a)a.focus(); };
  const an=document.getElementById('brAddNote'); if(an)an.onclick=()=>{ S.ed='note'; renderReview(); const t=document.getElementById('brNote'); if(t)t.focus(); };
  const sv=document.getElementById('brSave'); if(sv)sv.onclick=()=>{
    const note=String((document.getElementById('brNote')||{}).value||'').trim().slice(0,200);
    const ai=document.getElementById('brAct');
    if(ai){ const a=X.numv(ai.value); if(a==null||a<0){ X.toastErr('أدخل الكمية الفعلية في هذا الموضع (رقم صفر أو أكبر).'); ai.focus(); return; } setMark(s,'diff',a,note); }
    else if(m) setMark(s,m.v,num(m.a),note);
    S.ed=null; renderReview(); };
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{ const k=b.getAttribute('data-jump');   // الانتقال للموضع الآخر — حتى في مسار عدّادٍ آخر
    for(const q of D.paths){ const i=q.steps.findIndex(x=>x.key===k); if(i>=0){ S.u=q.uid; S.i=i; S.ed=null; renderReview(); window.scrollTo(0,0); return; } } });
}

async function submit(){
  const st=S; if(!st)return; const t=tally();
  if(t.left>0){ X.toastErr('بقي '+t.left+' خطوة لم تُراجَع — أكمل المراجعة أولًا.'); return; }
  if(!srvOk()){ X.toastErr('العدّات لم تُؤكَّد من الخادم بعد (الجهاز يعرض نسخته المحفوظة) — تحقّق من الاتصال ثم أعد المحاولة.'); return; }
  if(!(await X.confirmDialog({title:'إرسال مراجعة الفرع',message:'مطابق: '+t.ok+' • مختلف: '+t.diff+' • ملاحظات: '+t.notes+' — ستظهر المراجعة للمدير، ولا تتغيّر أي كمية معدودة.',confirmLabel:'إرسال'})))return;
  if(S!==st)return;
  if(!(await flush(st))){ if(S===st)X.toastErr('لم تُرسَل المراجعة: توجد تأشيرات لم تُحفظ بعد — أعد المحاولة.'); return; }
  if(S!==st)return;                                   // غادر المستخدم أو فتح مراجعةً أخرى أثناء الحفظ ⇒ لا إرسال باسم غيرها
  try{ await writeMeta(st,tally()); if(!pendN(st))st.dirtyMeta=false; st.x.toastOk('أُرسلت مراجعة الفرع ✓ — بانتظار المدير'); if(S===st)renderReview(); }
  catch(err){ st.x.toastErr('تعذّر إرسال المراجعة: '+st.x.errAr(err.code||err.message)+' — لم تُرسَل، أعد المحاولة.'); }
}

/* ───────── شاشة المدير: ملاحظات الفرع ───────── */
function renderNotes(){
  const c=document.getElementById('appContent'); if(!c||!S)return; rebuild(); const sess=X.sess()||{};
  const rows=allSteps().map(s=>({s,m:markOf(s)}));
  const marked=rows.filter(r=>r.m), diff=marked.filter(r=>r.m.v==='diff'), noted=marked.filter(r=>r.m.nt);
  const f=S.nf||'diff'; const show=f==='diff'?diff:f==='note'?noted:rows;
  const meta=S.meta; const fresh=metaFresh(meta);
  const st=fresh?'<div class="status show ok">✓ أرسلها '+E(meta.byName||'مسؤول الفرع')+(meta.at?' • '+E(X.fmtDT(X.tsMs(meta.at))):'')+'</div>'
    :(meta&&meta.submitted?'<div class="status show info">أُرسلت مراجعة سابقة قبل إعادة الإقفال الأخيرة — بانتظار إرسالٍ جديد من الفرع.</div>'
      :'<div class="status show info">لم يرسل الفرع مراجعته بعد — «تمت المراجعة» تبقى موقوفة حتى الإرسال.</div>');
  const kp=[['خطوات رُوجعت',marked.length+' / '+rows.length,''],['مطابق',marked.length-diff.length,'color:var(--success)'],['مختلف',diff.length,'color:var(--danger)'],['ملاحظات الفرع',noted.length,'']];
  let h='<div class="br-wrap" id="brNotesRoot"><div class="card" style="margin:0"><div class="br-head"><button class="btn ghost sm" id="brBack">→ رجوع</button><h2>ملاحظات مراجعة الفرع — '+E(sess.name||'')+'</h2></div>'+
    '<div style="margin-top:8px">'+st+'</div><div class="br-kpis" style="margin-top:12px">'+kp.map(k=>'<div class="br-kpi"><span class="muted">'+k[0]+'</span><b style="'+k[2]+'">'+E(k[1])+'</b></div>').join('')+'</div>'+
    '<div class="br-tools" style="margin-top:12px">'+[['diff','المختلف فقط'],['note','فيها ملاحظة'],['all','الكل']].map(([id,l])=>'<button type="button" class="br-ch'+(f===id?' on':'')+'" data-nf="'+id+'">'+l+'</button>').join('')+'</div></div>'+
    '<div class="card" style="margin:0;overflow:auto"><table class="br-tb"><thead><tr><th>الخطوة</th><th>العدّاد</th><th>الصنف</th><th>الدفتر</th><th>المعدود</th><th>الفعلي حسب الفرع</th><th>ملاحظة الفرع</th></tr></thead><tbody>'+
    (show.map(({s,m})=>{ const it=itemOf(s.code), o=D.occ[s.code]||[];
      return '<tr'+(m&&m.v==='diff'?' class="df"':'')+'><td data-l="الخطوة" style="font-weight:700;color:var(--navy700)">#'+s.pos+'</td><td data-l="العدّاد">'+E(s.who)+'</td><td data-l="الصنف"><div><b>'+E(it.name||s.code)+'</b><div class="muted">'+E(s.code)+(o.length>1?' · الموضع '+(o.indexOf(s)+1)+' من '+o.length:'')+(it.manual?' · مضاف يدويًّا':'')+(editsOf(s.code).length?' · عُدِّل بعد العدّ':'')+'</div></div></td>'+
        '<td data-l="الدفتر">'+E(X.fmt(num(it.book)))+'</td><td data-l="المعدود">'+qtyHtml(s)+'</td><td data-l="الفعلي حسب الفرع" style="font-weight:700;color:'+(!m?'var(--tmuted)':m.v==='diff'?'var(--danger)':'var(--success)')+'">'+(m?E(X.fmt(m.v==='diff'?m.a:s.q)):'لم يُراجَع')+'</td><td data-l="ملاحظة الفرع">'+(m&&m.nt?E(m.nt):'—')+'</td></tr>'; }).join('')||'<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">لا شيء هنا.</td></tr>')+
    '</tbody></table></div><p class="muted">المراجعة ملاحظاتٌ فقط ولا تغيّر أي كمية. إن لزم التصحيح فبإرجاع الجلسة للعدّ أو بالتسوية المعتادة مع سببها.</p></div>';
  c.innerHTML=h;
  document.getElementById('brBack').onclick=()=>{ stop(); X.back(); };
  c.querySelectorAll('[data-nf]').forEach(b=>b.onclick=()=>{ S.nf=b.getAttribute('data-nf'); renderNotes(); });
}
function render(){ if(!S)return; if(S.mode==='notes')renderNotes(); else renderReview(); }

/* ───────── نقطة الدخول ───────── */
async function open(ctx){
  if(S){ const old=S; if(pendN(old)&&!(await flush(old))){ if(!(await ctx.confirmDialog({title:'تأشيرات غير محفوظة',message:'تعذّر حفظ '+pendN(old)+' تأشيرًا من المراجعة السابقة. إن تابعت ستضيع. هل تتابع؟',confirmLabel:'تابع دون حفظ',danger:true})))return; } stop(old); }
  X=ctx; css(); D=null;
  const c=document.getElementById('appContent'); if(!c)return;
  c.innerHTML='<div class="card" id="brLoading"><p class="muted">جارٍ تحميل مراجعة الفرع…</p></div>';
  const still=()=>X.sid===X.curSid()&&!!document.getElementById('brLoading');   // غادر المستخدم الشاشة أثناء التحميل ⇒ لا نرسم فوق غيرها
  const fail=(msg)=>{ c.innerHTML='<div class="card"><button class="btn ghost sm" id="brBack">→ رجوع</button><p class="status show err" style="margin-top:12px">'+X.esc(msg)+'</p></div>'; document.getElementById('brBack').onclick=()=>X.back(); };
  let tries=0; while(!X.got()&&tries<60){ await new Promise(r=>setTimeout(r,300)); tries++; if(!still())return; }
  if(!X.got()){ fail('تعذّر تحميل عدّات الجلسة — لا يمكن بدء المراجعة دون العدّات كاملة. تحقّق من الاتصال ثم أعد المحاولة.'); return; }
  let store; try{ store=await loadStore(); } catch(err){ if(still())fail('تعذّر تحميل المراجعة: '+X.errAr(err.code||err.message)); return; }
  if(!still())return;
  const st=S={x:X,mode:X.mode,u:null,i:0,q:'',f:'all',ed:null,nf:'diff',view:(window.innerWidth>=1024?'list':'card'),marks:store.marks,meta:store.meta,edits:store.edits,pend:{},ft:0,flushing:null,flushErr:false,dirtyMeta:false,srvOk:false};
  rebuild(); S.u=(D.paths[0]||{}).uid||null; S.srvSeen=false;
  // تأكيد الخادم: مستمعٌ على العدّات نفسها بـ includeMetadataChanges (يتشارك هدف المراقبة مع مستمع التطبيق فلا قراءات إضافية)
  // لأن الانتقال «من الكاش ← مؤكَّد من الخادم» دون تغيّر مستند لا يُطلق حدثًا في مستمع التطبيق العادي.
  try{ st.unsrv=X.snapMeta(X.collection(X.db,'sessions',X.sid,'counts'),(qs)=>{ if(!(qs.metadata&&qs.metadata.fromCache))st.srvOk=true; },()=>{}); }catch(e){ st.srvOk=true; }
  // العدّات/الأصناف قد تصل من الخادم بعد نسخة الكاش ⇒ إعادة بناءٍ هادئة حين تتغيّر، دون مقاطعة كتابةٍ جارية
  S.poll=setInterval(()=>{ if(!onScreen()){ if(!pendN())stop(); return; } const ae=document.activeElement; if(S.ed||(ae&&/^br(Note|Act|Q)$/.test(ae.id)))return;   // لا إعادة رسمٍ والمحرّر مفتوح (لا يضيع نصٌّ مكتوب)
    if(!sigSame(D.sig,dataSig())||S.srvSeen!==srvOk()){ S.srvSeen=srvOk(); render(); } },1500);
  S.vis=()=>{ if(document.visibilityState==='hidden'&&pendN())flush(); }; document.addEventListener('visibilitychange',S.vis);
  S.bu=(e)=>{ if(S&&pendN()){ flush(); e.preventDefault(); e.returnValue=''; } }; window.addEventListener('beforeunload',S.bu);
  window.scrollTo(0,0); render();
}
window.IOMPBR={open:open,flush:()=>S?flush():Promise.resolve(true),_paths:()=>D&&D.paths,_state:()=>S};
})();
