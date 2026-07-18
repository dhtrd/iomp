// Builds harness.html from index.html by replacing Firebase CDN imports with an
// in-memory stub, and exposing introspection hooks. Scenario is passed via ?s=<b64 json>.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

// Strip the three `import ... from "https://www.gstatic.com/firebasejs/..."` statements.
const importRe = /import\s*\{[\s\S]*?\}\s*\r?\n?\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+";/g;
const withoutImports = src.replace(importRe, '');
if (withoutImports === src) { console.error('ERR: imports not matched'); process.exit(2); }

const STUB = `
/* ===== in-memory Firebase stub (test harness) ===== */
const __params = new URLSearchParams(location.search);
let __SC = {};
try { __SC = JSON.parse(decodeURIComponent(escape(atob(__params.get('s')||'')))||'{}'); } catch(e){ __SC={}; }
window.__SC = __SC;
const __store = {};            // path -> data | null
const __listeners = [];        // {kind:'doc'|'col', path, cb}
let __uidSeq = 1;
function __clone(x){ return x==null?x:JSON.parse(JSON.stringify(x)); }
function __seed(){
  const p = __SC.profile || {uid:(__SC.user&&__SC.user.uid)||'u_owner', email:(__SC.user&&__SC.user.email)||'a2@dhtrd.com', name:'المالك', role:'مدير', active:true, mustChangePassword:false};
  __store['users/'+p.uid] = __clone(p);
  (__SC.users||[]).forEach(u=>{ __store['users/'+u.uid] = __clone(u); });
  if (__SC.config) __store['config/permissions'] = __clone(__SC.config);
  (__SC.sessions||[]).forEach(s=>{ const id=s.id||('s'+(__uidSeq++)); __store['sessions/'+id]=__clone(Object.assign({},s)); delete __store['sessions/'+id].__chunks;
    (s.__chunks||[]).forEach((ch,i)=>{ __store['sessions/'+id+'/snapshot/chunk_'+String(i).padStart(4,'0')]={items:ch}; });
    (s.__counts||[]).forEach(cn=>{ __store['sessions/'+id+'/counts/'+(cn.code)]=cn; });
  });
}
function __fireDoc(path){ __listeners.filter(l=>l.kind==='doc'&&l.path===path).forEach(l=>{ try{ l.cb(__docSnap(path)); }catch(e){} }); }
function __fireCol(path){ // path is a written doc path; fire col listeners whose col is its direct parent
  const parent = path.slice(0, path.lastIndexOf('/'));
  __listeners.filter(l=>l.kind==='col'&&l.path===parent).forEach(l=>{ try{ l.cb(__colSnap(l.path)); }catch(e){} });
}
function __afterWrite(path){ __fireDoc(path); __fireCol(path); }
function __docSnap(path){ const d=__store[path]; const id=path.slice(path.lastIndexOf('/')+1); return {exists:()=>d!=null, data:()=>__clone(d), id}; }
function __colDocs(path){ const out=[]; const pre=path+'/'; for(const k in __store){ if(k.indexOf(pre)===0 && k.slice(pre.length).indexOf('/')<0 && __store[k]!=null){ out.push(__docSnap(k)); } } return out; }
function __colSnap(path){ const docs=__colDocs(path); return {forEach:cb=>docs.forEach(cb), docs, size:docs.length, empty:docs.length===0}; }

// --- API surface ---
const initializeApp=()=>({}), deleteApp=()=>Promise.resolve();
const getFirestore=()=>({}), getAuth=()=>__auth;
const __user = __SC.user || {uid:(__SC.profile&&__SC.profile.uid)||'u_owner', email:(__SC.profile&&__SC.profile.email)||'a2@dhtrd.com'};
const __auth = { currentUser: {uid:__user.uid, email:__user.email} };
function onAuthStateChanged(a, cb){ setTimeout(()=>cb(__auth.currentUser), 0); return ()=>{}; }
function signInWithEmailAndPassword(a,e,p){ return Promise.resolve({user:{uid:__user.uid}}); }
function createUserWithEmailAndPassword(a,e,p){ const uid='u'+(__uidSeq++); return Promise.resolve({user:{uid}}); }
function signOut(){ return Promise.resolve(); }
function updatePassword(){ return Promise.resolve(); }
function sendPasswordResetEmail(){ return Promise.resolve(); }
function serverTimestamp(){ return {__ts:Date.now()}; }
function doc(db, ...segs){ const path=segs.join('/'); return {__doc:true, path, id:segs[segs.length-1]}; }
function collection(db, ...segs){ const path=segs.join('/'); return {__col:true, path}; }
function query(col, ...cs){ return {__query:true, col, cs}; }
function orderBy(f,d){ return {__ob:f,d}; }
function limit(n){ return {__limit:n}; }
function __refPath(r){ return r.__query? r.col.path : r.path; }
function getDoc(ref){ return Promise.resolve(__docSnap(ref.path)); }
function getDocs(ref){ return Promise.resolve(__colSnap(__refPath(ref))); }
function __deepMerge(t,s){ for(const k in s){ const v=s[k]; if(v&&typeof v==='object'&&!Array.isArray(v)&&!v.__ts){ if(!t[k]||typeof t[k]!=='object')t[k]={}; __deepMerge(t[k],v);} else t[k]=v; } return t; }
function setDoc(ref, data, opts){ const path=ref.path; if(opts&&opts.merge){ const cur=__store[path]||{}; __store[path]=__deepMerge(__clone(cur), __clone(data)); } else { __store[path]=__clone(data); } __afterWrite(path); return Promise.resolve(); }
function updateDoc(ref, data){ const path=ref.path; if(__store[path]==null) return Promise.reject({code:'not-found'}); const cur=__store[path];
  for(const key in data){ const val=data[key]; if(key.indexOf('.')>=0){ const parts=key.split('.'); let o=cur; for(let i=0;i<parts.length-1;i++){ if(!o[parts[i]]||typeof o[parts[i]]!=='object')o[parts[i]]={}; o=o[parts[i]]; } o[parts[parts.length-1]]=__clone(val); } else { cur[key]=__clone(val); } }
  __afterWrite(path); return Promise.resolve(); }
function addDoc(colRef, data){ const id='d'+(__uidSeq++); const path=colRef.path+'/'+id; __store[path]=__clone(data); __afterWrite(path); return Promise.resolve({id, path}); }
function deleteDoc(ref){ const path=ref.path; __store[path]=null; delete __store[path]; __afterWrite(path); return Promise.resolve(); }
function onSnapshot(ref, cb, errCb){ const isDoc=!!ref.__doc; const path=__refPath(ref); const kind=isDoc?'doc':'col'; const l={kind,path,cb}; __listeners.push(l);
  setTimeout(()=>{ try{ cb(isDoc?__docSnap(path):__colSnap(path)); }catch(e){ if(errCb)errCb(e); } },0);
  return ()=>{ const i=__listeners.indexOf(l); if(i>=0)__listeners.splice(i,1); }; }
function runTransaction(db, fn){ const tx={ get:ref=>Promise.resolve(__docSnap(ref.path)), set:(ref,data)=>{__store[ref.path]=__clone(data);__afterWrite(ref.path);}, update:(ref,data)=>updateDoc(ref,data), delete:ref=>deleteDoc(ref) }; return Promise.resolve(fn(tx)); }
function writeBatch(db){ const ops=[]; return { set:(r,d,o)=>ops.push(()=>setDoc(r,d,o)), update:(r,d)=>ops.push(()=>updateDoc(r,d)), delete:r=>ops.push(()=>deleteDoc(r)), commit:async()=>{ for(const op of ops) await op(); } }; }
__seed();
/* ===== end stub ===== */
`;

// Introspection hooks appended at the very end of the module (before </script>).
const HOOKS = `
;window.__can = can; window.__roleCapVal = roleCapVal; window.__canManageSessions = canManageSessions; window.__isOwner = isOwner;
window.__nav = ()=>{ const n=document.getElementById('appNav'); return {display:n.style.display, html:n.innerHTML}; };
window.__contentHtml = ()=>document.getElementById('appContent').innerHTML;
window.__has = id=>!!document.getElementById(id);
window.__click = id=>{ const e=document.getElementById(id); if(e){e.click();return true;} return false; };
window.__store = __store;
window.__setTab = t=>{ adminTab=t; renderNav(); route(); };
window.__openSession = sid=>openSession(sid);
window.__del = sid=>deleteSession(sid);
window.__editUser = uid=>renderUserEdit(uid);
window.__openReport = sid=>openVarianceReport(sid,'home');
window.__ready = true;
`;

let out = withoutImports.replace(/<script type="module">/, '<script type="module">' + STUB);
// insert hooks before the final </script> of the module (last </script> in file)
const lastClose = out.lastIndexOf('</script>');
out = out.slice(0, lastClose) + HOOKS + out.slice(lastClose);

fs.writeFileSync('harness.html', out);
console.log('harness.html written', out.length, 'bytes');
