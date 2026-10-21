// أداة المحاكاة الكاملة (sim_quota_full.mjs): يبني sim_harness.html من harness.html باستبدال خادم الذاكرة المحلّي
// لكل صفحة بخادمٍ واحدٍ مشترك في Node (عبر window.__srvCall) — فلكلّ جهازٍ «كاش» محلّي فقط (__store)
// والحقيقة في الخادم المشترك، بمعاملاتٍ تفاؤليّة كمعاملات Firestore. لا يمسّ index.html ولا harness.html.
// الاستخدام: node sim_build_harness.mjs harness.html sim_harness.html
import fs from 'node:fs';
const [,, IN, OUT] = process.argv;
let h = fs.readFileSync(IN, 'utf8');
const NAMES = ['GetDoc','GetDocs','SetDoc','UpdateDoc','AddDoc','DeleteDoc','OnSnapshot','WriteBatch','RunTransaction'];
for (const n of NAMES) {
  const re = new RegExp('function _fs' + n + '\\(');
  if (!re.test(h)) { console.error('missing _fs' + n); process.exit(2); }
  h = h.replace(re, 'function _fs' + n + 'L(');
}
const marker = '__seed();\n/* ===== end stub ===== */';
if (!h.includes(marker)) { console.error('marker not found'); process.exit(2); }
const REMOTE = `__seed();
for (const k in __store) delete __store[k];           // الجهاز يبدأ بكاشٍ فارغ؛ الحقيقة في الخادم المشترك
if (window.__cacheSeed) Object.assign(__store, window.__cacheSeed); // «تحديث الصفحة»: كاش Firestore الدائم يبقى كما في الإنتاج
async function __S(op,a){ const r=await window.__srvCall(op,a); if(r&&r.err) throw r.err; return r; }
function __cSet(p,d){ if(d==null) delete __store[p]; else __store[p]=d; }
function __cCol(cp,docs){ const pre=cp+'/'; for(const k in __store){ if(k.indexOf(pre)===0&&k.slice(pre.length).indexOf('/')<0) delete __store[k]; } docs.forEach(x=>__cSet(x.p,x.d)); }
function _fsGetDoc(ref){ if(__failPaths[ref.path]) return Promise.reject({code:'unavailable',message:'network'}); return __S('get',{p:ref.path}).then(r=>{ __cSet(ref.path,r.d); return __docSnap(ref.path); }); }
function _fsGetDocs(ref){ const cp=__refPath(ref); return __S('list',{p:cp}).then(r=>{ __cCol(cp,r.docs); return _fsGetDocsL(ref); }); }
function _fsSetDoc(ref,data,opts){ return __S('set',{p:ref.path,d:__clone(data),m:!!(opts&&opts.merge)}).then(r=>{ __cSet(ref.path,r.d); }); }
function _fsUpdateDoc(ref,data){ return __S('update',{p:ref.path,d:__clone(data)}).then(r=>{ __cSet(ref.path,r.d); }); }
function _fsAddDoc(col,data){ return __S('add',{p:col.path,d:__clone(data)}).then(r=>{ __cSet(r.path,r.d); return {id:r.id,path:r.path}; }); }
function _fsDeleteDoc(ref){ return __S('delete',{p:ref.path}).then(()=>{ __cSet(ref.path,null); }); }
function _fsWriteBatch(db){ const ops=[]; return { set:(r,d,o)=>{ops.push({t:'set',p:r.path,d:__clone(d),m:!!(o&&o.merge)});}, update:(r,d)=>{ops.push({t:'update',p:r.path,d:__clone(d)});}, delete:r=>{ops.push({t:'delete',p:r.path});},
  commit:()=>__S('commit',{reads:{},writes:ops}).then(r=>{ (r.docs||[]).forEach(x=>__cSet(x.p,x.d)); }) }; }
async function _fsRunTransaction(db,fn){ __txN++;
  for(let attempt=0;attempt<5;attempt++){ const reads={}, writes=[];
    const tx={ get:async ref=>{ if(__failPaths[ref.path]) throw {code:'unavailable',message:'network'}; const r=await __S('get',{p:ref.path}); reads[ref.path]=r.v; __cSet(ref.path,r.d); return __docSnap(ref.path); },
      set:(ref,d,o)=>{ writes.push({t:'set',p:ref.path,d:__clone(d),m:!!(o&&o.merge)}); return tx; },
      update:(ref,d)=>{ writes.push({t:'update',p:ref.path,d:__clone(d)}); return tx; },
      delete:ref=>{ writes.push({t:'delete',p:ref.path}); return tx; } };
    const res=await fn(tx);
    const c=await window.__srvCall('commit',{reads,writes}); if(c&&c.err) throw c.err;
    if(c.conflict) continue;
    (c.docs||[]).forEach(x=>__cSet(x.p,x.d)); return res; }
  throw {code:'aborted',message:'too much contention'}; }
let __lid=0;
function _fsOnSnapshot(ref,cb,errCb){ const isDoc=!!ref.__doc; const path=__refPath(ref); const kind=isDoc?'doc':'col'; const l={kind,path,cb,err:errCb,id:++__lid}; __listeners.push(l);
  window.__srvCall('sub',{k:kind,p:path,id:l.id}).then(r=>{
    if(r&&r.err){ const i=__listeners.indexOf(l); if(i>=0)__listeners.splice(i,1); setTimeout(()=>{ try{ if(!__noCache)cb(isDoc?__docSnap(path):__colSnap(path)); }catch(e){} if(errCb)errCb(r.err); },0); return; }
    if(isDoc) __cSet(path,r.d); else __cCol(path,r.docs);
    if(__listeners.indexOf(l)>=0){ try{ cb(isDoc?__docSnap(path):__colSnap(path)); }catch(e){ if(errCb)errCb(e); } } });
  return ()=>{ const i=__listeners.indexOf(l); if(i>=0)__listeners.splice(i,1); window.__srvCall('unsub',{id:l.id}); }; }
window.__push=(list)=>{ list.forEach(x=>{ __cSet(x.p,x.d); __afterWrite(x.p); }); };
window.__kill=(ids)=>{ for(let i=__listeners.length-1;i>=0;i--){ const l=__listeners[i]; if(!ids||ids.indexOf(l.id)>=0){ __listeners.splice(i,1); try{ if(l.err)l.err(__QERR()); }catch(e){} } } };
/* ===== end stub ===== */`;
h = h.replace(marker, REMOTE);
fs.writeFileSync(OUT, h);
console.log('sim harness written', h.length);
