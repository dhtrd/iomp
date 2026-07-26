// Builds harness.html from index.html by replacing Firebase CDN imports with an
// in-memory stub, and exposing introspection hooks. Scenario is passed via ?s=<b64 json>.
const fs = require('fs');
// م٦-٤: يسمح SRC_HTML بقياس نسخة «قبل» (النسخة الاحتياطية) دون لمس index.html
const SRC_HTML = process.env.SRC_HTML || 'index.html';
const OUT_HTML = process.env.OUT_HTML || 'harness.html';
const src = fs.readFileSync(SRC_HTML, 'utf8');

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
    (s.__extras||[]).forEach(x=>{ __store['sessions/'+id+'/extraItems/'+(x.code)]=x; }); // الأصناف اليدوية
    (s.__notes||[]).forEach(n=>{ __store['sessions/'+id+'/itemNotes/'+(n.code)]={code:n.code,notes:n.notes||[]}; }); // ملاحظات العدّ
    (s.__activity||[]).forEach((a,i)=>{ __store['sessions/'+id+'/activity/act_'+String(i).padStart(4,'0')]=__clone(a); });
  });
  (__SC.branches||[]).forEach(b=>{ const id=b.id||('b'+(__uidSeq++)); __store['branches/'+id]=__clone(Object.assign({},b)); }); // ر٨-ب: بذر الفروع (م١٧)
  (__SC.products||[]).forEach(p=>{ const id=p.id||('p'+(__uidSeq++)); __store['products/'+id]=__clone(Object.assign({},p)); delete __store['products/'+id].__history; // ر٩: بذر الكتالوج (م١٥)
    (p.__history||[]).forEach((h,i)=>{ __store['products/'+id+'/history/hist_'+String(i).padStart(4,'0')]=__clone(h); }); });
  (__SC.movements||[]).forEach((mv)=>{ const id=mv.id||('mv'+(__uidSeq++)); __store['movements/'+id]=__clone(mv); }); // ر٩: بذر الحركات لتصنيف ABC/XYZ
  // ط-١٠: بذر الكتالوج الرئيسيّ المقطّع — مستند نسخة واحد + قطع مرقّمة (نمط chunk_0000 نفسه)
  if (__SC.catalogMeta) __store['catalogMeta/version'] = __clone(__SC.catalogMeta);
  (__SC.catalogChunks||[]).forEach((ch,i)=>{ __store['catalogChunks/chunk_'+String(i).padStart(4,'0')] = {items:__clone(ch)}; });
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
const initializeFirestore=(a,o)=>({}), persistentLocalCache=(o)=>({}), persistentMultipleTabManager=()=>({}); // بدائل كاش Firestore الدائم
const __user = __SC.user || {uid:(__SC.profile&&__SC.profile.uid)||'u_owner', email:(__SC.profile&&__SC.profile.email)||'a2@dhtrd.com'};
const __auth = { currentUser: {uid:__user.uid, email:__user.email} };
let __signInFail=false; // م٦-٤: التحكم في نجاح/فشل الدخول لاختبار شاشة الدخول
function onAuthStateChanged(a, cb){ setTimeout(()=>cb(__SC.loggedOut?null:__auth.currentUser), 0); return ()=>{}; }
function signInWithEmailAndPassword(a,e,p){ if(__signInFail) return Promise.reject({code:'auth/invalid-credential'}); return Promise.resolve({user:{uid:__user.uid}}); }
function createUserWithEmailAndPassword(a,e,p){ const uid='u'+(__uidSeq++); return Promise.resolve({user:{uid}}); }
function signOut(){ return Promise.resolve(); }
function updatePassword(){ return Promise.resolve(); }
function sendPasswordResetEmail(){ return Promise.resolve(); }
function serverTimestamp(){ return {__ts:Date.now()}; }
function doc(db, ...segs){ const path=segs.join('/'); return {__doc:true, path, id:segs[segs.length-1]}; }
function collection(db, ...segs){ const path=segs.join('/'); return {__col:true, path}; }
function query(col, ...cs){ return {__query:true, col, cs}; }
function orderBy(f,d){ return {__ob:f,d}; }
function where(f,op,v){ return {__where:f,op,v}; } // إصلاح-٣ (بند ٢ب): دعم where في المحاكي (يُطبَّق فعليًّا في getDocs)
function limit(n){ return {__limit:n}; }
function __refPath(r){ return r.__query? r.col.path : r.path; }
const __failPaths={}; // ط-١٠: محاكاة عطل شبكة على مسارٍ بعينه — لتمييز «تعذّرت القراءة» عن «غير موجود»
window.__failRead=(p,b)=>{ if(b)__failPaths[p]=true; else delete __failPaths[p]; };
function getDoc(ref){ if(__failPaths[ref.path]) return Promise.reject({code:'unavailable',message:'network'}); return Promise.resolve(__docSnap(ref.path)); }
function getDocs(ref){ if(__failPaths[__refPath(ref)]) return Promise.reject({code:'unavailable',message:'network'});
  let docs=__colSnap(__refPath(ref)).docs;
  if(ref&&ref.__query&&Array.isArray(ref.cs)){ ref.cs.forEach(c=>{ if(c&&c.__where){ docs=docs.filter(d=>{ const v=(d.data()||{})[c.__where]; if(c.op==='==')return v===c.v; if(c.op==='in')return Array.isArray(c.v)&&c.v.indexOf(v)>=0; if(c.op==='!=')return v!==c.v; return true; }); } }); }
  return Promise.resolve({forEach:cb=>docs.forEach(cb), docs, size:docs.length, empty:docs.length===0}); }
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

// ط-١٥ (د-٨): index.html صار يُعرّف الأسماء التسعة كأغلفةٍ تعدّ ثمّ تمرّر إلى `_fs*`.
// وتكرار تعريف دالّةٍ في المستوى الأعلى من وحدة ES خطأٌ نحويّ — فالمحاكي يُعاد تسميته
// بالآليّة نفسها تلقائيًّا (لا يدويًّا) كي يستحيل أن يفترق الملفّان مستقبلًا.
const BILL = ['getDoc','getDocs','setDoc','updateDoc','addDoc','deleteDoc','onSnapshot','writeBatch','runTransaction'];
let STUB2 = STUB;
BILL.forEach(n => { STUB2 = STUB2.replace(new RegExp('\\b' + n + '\\b', 'g'), '_fs' + n[0].toUpperCase() + n.slice(1)); });

// Introspection hooks appended at the very end of the module (before </script>).
const HOOKS = `
;window.__can = can; window.__roleCapVal = roleCapVal; window.__canManageSessions = canManageSessions; window.__isOwner = isOwner;
window.__failSignIn = (b)=>{ __signInFail=!!b; }; // م٦-٤: التحكم في فشل الدخول لاختبار الاهتزاز
window.__nav = ()=>{ const n=document.getElementById('appNav'); return {display:n.style.display, html:n.innerHTML}; };
window.__contentHtml = ()=>document.getElementById('appContent').innerHTML;
window.__has = id=>!!document.getElementById(id);
window.__click = id=>{ const e=document.getElementById(id); if(e){e.click();return true;} return false; };
window.__store = __store;
window.__mockSet = (path,data)=>{ __store[path]=__clone(data); __afterWrite(path); }; // كتابةٌ تحاكي setDoc فتُطلق المستمعين
window.__setTab = t=>{ adminTab=t; renderNav(); route(); };
window.__openSession = sid=>openSession(sid);
window.__del = sid=>deleteSession(sid);
window.__editUser = uid=>renderUserEdit(uid);
window.__openReport = sid=>openVarianceReport(sid,'home');
// ر٧: خطاطيف شاشة التقارير الموحّدة (م١٩)
window.__repxReady = ()=>_repxReady;
window.__repxModel = name=>repxModel(name);
window.__repxCsv = name=>repxBuildCsv(name);
window.__repxPrintHtml = name=>{ repxBuildPrint(name); return document.getElementById('repPrintArea').innerHTML; };
window.__repxSessIds = ()=>repxScopedSessions().map(s=>s.id);
window.__repxActive = ()=>repxActive;
// ر٨: خطاطيف دفتر الحركات وهيكل المستودعات (م١٦) — إضافية بجانب __repx*
window.__featuresLedgerOn = ()=>featuresLedgerOn();
window.__ledReady = ()=>_ledReady;
window.__ledMoves = ()=>ledMoves.map(x=>Object.assign({},x));
window.__ledSeed = arr=>{ ledMoves=(arr||[]).map(x=>Object.assign({},x)); _ledReady=true; };
window.__ledLoad = ()=>ledLoad().then(a=>{ ledMoves=a; return a; });
window.__ledFold = moves=>ledFold(moves||ledMoves);
window.__ledBalances = ()=>ledFold(ledMoves);
window.__ledBalance = (loc,sku)=>ledBalance(ledMoves,loc,sku);
window.__ledMove = m=>ledRecordMove(m);
window.__ledValidate = m=>ledValidate(m, ledActiveBins(), ledFold(ledMoves));
window.__ledNextRef = ()=>ledNextRef();
window.__ledKpis = cat=>ledKpis(ledMoves, ledActiveBins(), cat||ledCatalog);
window.__ledSearch = q=>ledSearch(ledMoves,q);
window.__ledBins = ()=>ledActiveBins();
window.__ledTop = n=>ledTopLocations(ledMoves,ledActiveBins(),n);
window.__ledRender = ()=>{ try{ ledRenderAll(); }catch(e){} };
window.__ledSep = ()=>LED_SEP;
// محرّر الهيكل (يتخطّى prompt في الاختبار)
window.__ledSetWhCode = (w,c)=>ledSetWhCode(w,c);
window.__ledAddZone = (w,i,n)=>ledAddZone(w,i,n);
window.__ledAddShelf = (w,z,i,n)=>ledAddShelf(w,z,i,n);
window.__ledAddBin = (w,z,s,i,cap)=>ledAddBin(w,z,s,i,cap);
window.__ledSetCap = (w,z,s,b,cap)=>ledSetCap(w,z,s,b,cap);
window.__ledRemoveBin = (w,z,s,b)=>ledRemoveBin(w,z,s,b);
// ر٨-ب: خطاطيف إدارة الفروع (م١٧) — إضافية بجانب __led*
window.__featuresBranchesOn = ()=>featuresBranchesOn();
window.__brxReady = ()=>_brxReady;
window.__brxLoad = ()=>brxLoad().then(()=>true);
window.__brxIsCentral = ()=>brxIsCentral();
window.__brxModels = ()=>brxAllModels();
window.__brxBranchModel = bid=>{ const b=brxBranches.find(x=>x.id===bid); return b?brxBranchModel(b):null; };
window.__brxVisible = ()=>brxVisibleBranches().map(b=>b.id);
window.__brxBest = ()=>brxBestByAccuracy();
window.__brxStats = ()=>brxStats();
window.__brxActive = bid=>brxBranchActive(bid);
window.__brxSetActive = (bid,a)=>brxSetActive(bid,a);
window.__brxCanCreate = bid=>brxCanCreateInBranch(bid);
window.__brxSessSum = ()=>brxSessSum.map(x=>Object.assign({},x));
// إصلاح-٣ (بند ٢): خطّافات إنشاء/تحرير الفرع + حارس الفرع المعطّل + قائمة المستخدمين
window.__brxCreate = (d)=>brxCreateBranch(d);
window.__brxUpdate = (id,d)=>brxUpdateBranch(id,d);
window.__brxUsers = ()=>brxUsers.map(u=>Object.assign({},u));
window.__locDisabled = (loc)=>locationInDisabledBranch(loc);
window.__createSession = ()=>createSession();
// ر٩: خطاطيف كتالوج المنتجات (م١٥) — إضافية بجانب __brx*
window.__featuresProductCatalogOn = ()=>featuresProductCatalogOn();
window.__pxReady = ()=>_pxReady;
window.__pxLoad = ()=>pxLoad().then(()=>true);
window.__pxProducts = ()=>pxProducts.map(p=>Object.assign({},p));
window.__pxGet = sku=>{ const p=pxFind(sku); return p?Object.assign({},p):null; };
window.__pxCreate = card=>pxCreateCard(card);
window.__pxSave = (sku,patch)=>pxSaveCard(sku,patch);
window.__pxSetStatus = (sku,status)=>pxSetStatus(sku,status);
window.__pxAddVariant = (sku,name)=>pxAddVariant(sku,name);
window.__pxAddAttr = (sku,k,v)=>pxAddAttr(sku,k,v);
window.__pxAddImage = (sku,url)=>pxAddImage(sku,url);
window.__pxMigrate = item=>pxMigrateManualItem(item);
window.__pxHistory = sku=>pxHistoryOf(sku);
window.__pxEligible = ()=>pxNewSessionEligible().map(p=>p.sku);
window.__pxSeedMoves = arr=>{ pxMoves=(arr||[]).map(x=>Object.assign({},x)); };
window.__pxClassify = ()=>pxClassifyAll();
window.__pxCardClass = sku=>pxCardClass(sku);
window.__pxPackToBase = (pack,packs)=>pxPackToBase(pack,packs);
window.__pxBaseToPack = (pack,base)=>pxBaseToPack(pack,base);
window.__pxBarcodeSvg = code=>pxBarcodeSvg(code);
window.__pxQrSvg = sku=>pxQrSvg(sku);
window.__pxPid = sku=>pxPid(sku);
window.__pxRender = ()=>{ try{ pxRenderAll(); }catch(e){} };
// م١٨: خطاطيف مركز الإدارة والإعدادات والنسخ/السلامة وتسوية العدّ
window.__appSettings = ()=>appSettings();
window.__printCfg = ()=>printCfg(); // المحطّة ٢: إعدادات المخرجات المركزية
window.__exportCfg = ()=>exportCfg();
window.__reportCfg = ()=>reportCfg();
window.__acSaveOutput = ()=>acSaveOutput();
window.__docSignatories = ()=>docSignatories(); // المحطّة ٥
window.__docColumns = ()=>docColumns(); // المحطّة ٣
window.__docTemplate = (k)=>docTemplate(k); // المحطّة ٤
window.__docSubst = (t,rk)=>docSubst(t, docVarCtx(rk||'committee', [])); // المحطّة ٤
window.__acSaveDocTpl = ()=>acSaveDocTemplate();
window.__sysDefaults = ()=>sysDefaults(); // المحطّة ٦
window.__acSavePersonalize = ()=>acSavePersonalize();
// مهلة السكون: خطاطيف الاختبار — إظهار التنبيه فورًا دون انتظار المهلة
window.__idleCfg = ()=>idleCfg();
window.__idleLastSet = (ms)=>{ _idleLast=Number(ms)||Date.now(); try{ localStorage.setItem(idleKey(),String(_idleLast)); }catch(e){} };
window.__idleCheck = ()=>idleElapsedCheck();
window.__curNotes = ()=>curNotes; // ملاحظات العدّ الحيّة
window.__countsMap = ()=>curCounts; // الخريطة الكاملة (لا تلمس __curCounts القديم — يعيد المفاتيح فقط)
window.__addEntry = (c,v)=>addEntry(c,v);
window.__pendingAdds = ()=>_pendingAdds;
window.__noteSave = (c)=>noteSave(c);
window.__noteDraftSet = (c,t)=>{ _noteDraft[String(c)]=t; };
window.__snapCacheGet = (sid)=>snapCacheGet(sid);
window.__snapCacheSet = (sid,items)=>snapCacheSet(sid,items);
window.__idleWarnNow = ()=>idleWarn();
window.__idleActive = ()=>!!document.getElementById('idleWarn');
window.__idleReset = ()=>idleReset();
// الهوية والشعار: خطاطيف اختبار الشعار (افتراضي/مخصّص) والترويسة والحفظ والطبع على العلامات
window.__brandingCfg = ()=>brandingCfg();
window.__brandMarkHtml = ()=>brandMarkHtml();
window.__printLogoHtml = ()=>printLogoHtml();
window.__defaultLogoSvg = (s,px)=>defaultLogoSvg(s,px);
window.__applyBrandMarks = ()=>{ try{ applyBrandMarks(); }catch(e){} };
window.__setBrandingLogo = (v)=>{ _brandingLogoData=v; };
window.__acSaveBranding = ()=>acSaveBranding();
window.__acClearLogo = ()=>acClearLogo();
window.__fmtDateTimeAr = (v)=>fmtDateTimeAr(v); // إصلاح خلل «:٦٠»: تنسيق وقت حتمي
// الموقّعون في بداية الجلسة + المحاضر الجديدة + تصدير إكسل
window.__sigRoster = ()=>sigRoster();
window.__setSessSig = (a)=>{ _sessSig=a; };
window.__sessSigCollect = ()=>sessSigCollect();
window.__createSession = ()=>createSession();
window.__handoverReady = ()=>handoverReady();
window.__exportAoa = (reason)=>{ const R=EXPORT_REASONS[reason]; return R&&R.cols?excelSheetFromCols(exportRowsFor(R),finFilterCols(R.cols)):null; }; // م٦-١: كما في مسار الإنتاج
// م٦: خطاطيف القيم المالية وأسباب المخرجات
window.__canSeeFinance = ()=>canSeeFinance();
window.__reasonAllowed = (k)=>reasonAllowed(k);
window.__printReasonsAllowed = ()=>printReasonsAllowed();
window.__exportReasonsAllowed = ()=>exportReasonsAllowed();
window.__finFilterCols = (cols)=>finFilterCols(cols);
window.__detailedAoa = ()=>exportDetailedAoa();
window.__repxTableData = (name)=>repxTableData(name);
window.__repxXlsxAoa = (name)=>repxXlsxAoa(name);
window.__openPrintDialog = ()=>{ try{ openPrintDialog(); }catch(e){} };
window.__openExportDialog = ()=>{ try{ openExportDialog(); }catch(e){} };
window.__disp = (id)=>{ const e=document.getElementById(id); return e?getComputedStyle(e).display:'ABSENT'; };
window.__buildReasonPrint = (k)=>{ buildPrintReport(k); return document.getElementById('repPrintArea').innerHTML; };
window.__repSigList = ()=>repSigList(); // م٦-٣: محرّر أعضاء اللجنة (للفحص)
window.__findByScan = (items,code)=>{ var s=(typeof curItems!=='undefined')?curItems:null; try{ curItems=items||[]; var r=findByScan(code); return r?String(r.code):null; } finally { if(s!==null)curItems=s; } }; // م٦-٣: مطابقة الباركود (للفحص)
window.__lastUnknownScan = ()=>_lastUnknownScan; // م٦-٣: آخر مسحة مجهولة
window.__curItemsArr = ()=>curItems.map(x=>Object.assign({},x)); // م٦-٣: أصناف الجلسة الحالية
window.__addExtraItem = (item)=>{ curExtra=curExtra.concat([Object.assign({},item,{manual:true})]); curItems=curBaseItems.concat(curExtra); if(document.getElementById('clist'))renderCountList(); }; // م٦-٣: محاكاة إضافة صنف يدوي (إظهار فوري)
// م٦-٤: خطاطيف محرك المسح المؤسسي (طابور + لوحة النتيجة + التركيز)
window.__scanCommit = (code,src)=>scanCommit(code,src||'test');
// ط-٩ (م٦-٥): تمرير كائن الحدث نفسه — لإثبات أنّ المنع بهوية الحدث لا بالزمن
window.__scanCommitEvt = (code,evt)=>scanCommit(code,'test',evt);
window.__scanQueueLen = ()=>scanQueue.length;
window.__scanBusy = ()=>!!scanBusy;
window.__scanIdle = ()=>(!scanBusy && scanQueue.length===0 && !caBusy); // م٧: الاعتماد طورٌ غير متزامنٍ خارج scanPump ⇒ لا سكونَ قبل انتهائه
window.__scanPanel = ()=>{ const e=document.getElementById('scanStatus'); if(!e)return null;
  const cells={};
  e.querySelectorAll('.sp-t').forEach(t=>{ const k=t.querySelector('.k'), v=t.querySelector('.v'); if(k&&v)cells[(k.textContent||'').trim()]=(v.textContent||'').trim(); }); // م٨: بلاطات البطاقة الثابتة
  e.querySelectorAll('.sp-c').forEach(c=>{ const k=c.querySelector('.sp-k'), v=c.querySelector('.sp-v'); if(k&&v)cells[(k.textContent||'').trim()]=(v.textContent||'').trim(); }); // توافقٌ قديم
  const nm=e.querySelector('.sp-nm'), bc=e.querySelector('.sp-bc'), inv=e.querySelector('.sp-inv'), scan=e.querySelector('.sp-scanst'), diff=e.querySelector('#spDiff'), note=e.querySelector('.sp-n'), h=e.querySelector('.sp-h');
  return { visible:getComputedStyle(e).display!=='none', cls:e.className||'',
    head:h?(h.textContent||'').trim():'', name:nm?(nm.textContent||'').trim():'', barcode:bc?(bc.textContent||'').trim():'',
    inv:inv?(inv.textContent||'').trim():'', scan:scan?(scan.textContent||'').trim():'',
    diffText:diff?(diff.textContent||'').trim():'', diffCls:(diff&&diff.parentNode)?(diff.parentNode.className||''):'',
    note:note?(note.textContent||'').trim():'', text:(e.textContent||'').trim(),
    cells:cells, cellCount:e.querySelectorAll('.sp-t').length,
    hasCloseBtn:!!e.querySelector('.sp-x'), hasTimer:!!e._t }; };
window.__spCall = (o)=>scanPanel(o);   // م٨: استدعاءٌ مباشرٌ لقياس الأداء (مسبار)
window.__spClose = ()=>spClose();
window.__focusId = ()=>{ const a=document.activeElement; return a?(a.id||a.className||a.tagName):'?'; };
window.__scanConsts = ()=>({ cadence:SCAN_CADENCE_MS, idle:SCAN_IDLE_MS, minLen:SCAN_MIN_LEN, cap:MANUAL_QTY_CAP,
  dedup:(typeof SCAN_DEDUP_MS!=='undefined'?SCAN_DEDUP_MS:0),   // ط-٩: صفر ⇒ لا نافذة زمنية تمنع تكرار المسح المتعمّد
  runReset:(typeof SCAN_RUN_RESET_MS!=='undefined'?SCAN_RUN_RESET_MS:null), late:(typeof SCAN_LATE_MS!=='undefined'?SCAN_LATE_MS:null),
  hiccupMax:(typeof SCAN_HICCUP_MAX!=='undefined'?SCAN_HICCUP_MAX:null), proofGaps:(typeof SCAN_PROOF_GAPS!=='undefined'?SCAN_PROOF_GAPS:null) });
window.__scanIndexStats = ()=>{ const x=scanIndexGet(); return { D:x.D.size, Z:x.Z.size, G:x.G.size, C:x.C.size }; };
window.__setScanMode = (b)=>{ scanMode=!!b; };
window.__countWriteAdd = (sid,code,d,at,eid)=>countWriteAdd(sid,code,d,at,eid); // م٦-٤: حارس التكرار eid
// م٦-٤: قياس مطابقة الباركود في الحالة المستقرة (curItems ثابت أثناء الجلسة الحقيقية)
window.__benchScanWarm = (items,code,reps)=>{ var s=curItems; try{ curItems=items||[]; findByScan(code);
  var t0=performance.now(); for(var k=0;k<reps;k++) findByScan(code); return (performance.now()-t0)/reps; } finally { curItems=s; } };
// م٦-٤: أسوأ حالة — تغيّر مرجع curItems قبل كل مطابقة (إعادة بناء الفهرس في نسخة «بعد»)
window.__benchScanCold = (items,code,reps)=>{ var s=curItems; try{ var t0=performance.now();
  for(var k=0;k<reps;k++){ curItems=(items||[]).slice(); findByScan(code); } return (performance.now()-t0)/reps; } finally { curItems=s; } };
window.__hasScanQueue = ()=>{ try{ return typeof scanQueue!=='undefined' && !!scanQueue; }catch(e){ return false; } };
window.__reasonAvail = (p)=>{ reasonAvailability(p); }; // م٦-٣: تفعيل/تعطيل أزرار الأسباب (للفحص)
window.__setReportDate = (v)=>setReportDate(v); // م٦-٣: ضبط تاريخ الجرد (للفحص)
window.__docVarCtx = (k)=>docVarCtx(k, (typeof repRows!=='undefined'?repRows:[])); // م٦-٣: متغيّرات الصيغة (للفحص)
window.__acBuildBackup = ()=>acBuildBackup();
window.__acChecksum = (s)=>acChecksum(s); // إصلاح-٥ (بند ١١): بناء بصمة صحيحة في الاختبار
window.__safeId = (c)=>safeId(c); // إصلاح-٥ (بند ٨)
window.__repxCsvEsc = (v)=>repxCsvEsc(v); // إصلاح-٥ (بند ١٠)
window.__acIntegrity2 = ()=>acRunIntegrity(); // إصلاح-٥ (بند ١٨)
window.__acRestore = j=>acRestoreBackup(j);
window.__acIntegrity = ()=>acRunIntegrity();
window.__acLoadActivity = ()=>acLoadActivity(100);
window.__deriveNotifs = ()=>deriveNotifs(_notifCache);
window.__deriveNotifsList = (list)=>deriveNotifs(list); // إصلاح-٥ (بند ٧)
window.__resetItem = code=>resetItem(code);
window.__removeEntry = (code,i)=>removeEntry(code,i);
window.__addEntry = (code,v)=>addEntry(code,v);
window.__curCounts = ()=>Object.keys(curCounts||{});
// ر١٠ (م٢٤): خطاطيف العدّ دون اتصال — تُمرَّر تجربة الطابور/المزامنة عبر بديل localStorage (IndexedDB محجوب على file://)
window.__featuresOfflineOn = ()=>featuresOfflineOn();
window.__offline = {
  setOnline:(b)=>{ _forcedOnline = (b===null? null : !!b); offlineUpdateChip(); return (b? (featuresOfflineOn()? offlineFlush(false) : Promise.resolve()) : Promise.resolve()); },
  isOnline:()=>netOnline(),
  queue:()=>offlineQueueGet(),
  len:()=>offlineQueueGet().then(q=>q.length),
  flush:()=>offlineFlush(true),
  deviceId:()=>offlineDeviceId(),
  enqueue:(op)=>offlineEnqueueAndReflect(op),
  syncStatus:()=>offlineGetSyncStatus(),
  setSyncStatus:(s)=>offlineSetSyncStatus(s),
  failNext:(b)=>{ _offlineForceFail = !!b; },
  rejectNext:(b)=>{ _offlineForceReject = !!b; }, // إصلاح-٢ (بند ٣أ): محاكاة رفض صلاحية/قاعدة
  rejected:()=>offlineStore.get(OFFLINE_REJECTED_KEY),
  clearRejected:()=>offlineStore.set(OFFLINE_REJECTED_KEY,[]),
  setOnlineNoFlush:(b)=>{ _forcedOnline=(b===null?null:!!b); offlineUpdateChip(); }, // إصلاح-٢ (بند ٣ب): اتصال بلا مزامنة تلقائية — لاختبار السباق
  backend:()=>offlineStore.backend(),
  refreshLen:()=>offlineRefreshLen()
};
window.__ppShown = ()=>{ const o=document.getElementById('ppOverlay'); return !!(o && o.style.display==='flex'); };
// ر١١: خطاطيف النسخ الاحتياطي إلى Dropbox — إضافية بجانب __offline (كل HTTP يمرّ عبر dbxFetch الذي تعترضه window.__dbxMock)
window.__featuresDropboxOn = ()=>featuresDropboxOn();
window.__dbxTick = ()=>dbxAutoTick(true); // force: يتخطّى كابح المحاولة فقط — الشروط والاستحقاق كما هي
window.__dbxAuthUrl = ()=>dbxAuthStart(); // يعيد الرابط الذي سيُنتقَل إليه (null بلا App Key)
window.__dbx = {
  connected:()=>dbxConnected(),
  stored:()=>dbxStored(),
  token:()=>dbxAccessToken(),
  backup:()=>dbxRunBackup('manual'),
  buildFull:()=>dbxBuildFullBackup(),
  list:()=>dbxListBackups(),
  restore:(p)=>dbxRestoreConfig(p),
  status:()=>dbxGetStatus(),
  account:()=>dbxAccount(),
  disconnect:()=>dbxDisconnect(),
  handleRedirect:()=>dbxHandleRedirect()
};
window.__syncStrip = ()=>{ try{ syncStripRefresh(); return true; }catch(e){ return false; } };
// إصلاح-٤: خطاطيف ملخّص الجلسة والكفاءة (بند ٤ + بند ٦)
window.__featuresSessionSummaryOn = ()=>featuresSessionSummaryOn();
window.__computeSessionSummary = (items,counts)=>computeSessionSummary(items,counts);
window.__sessWriteSummary = (sid,items,counts)=>sessWriteSummary(sid,items,counts);
window.__notifEnrichVariance = (list)=>notifEnrichVariance(list);
window.__sessVariancePct = (items,counts)=>sessVariancePct(items,counts);
window.__ledLoadCatalog = ()=>ledLoadCatalog();
window.__ledCatalog = ()=>Object.assign({},ledCatalog);
window.__ledSetCatalog = (c)=>{ ledCatalog=c||{}; };
// ط-١٠: خطاطيف الكتالوج الرئيسيّ — سلّم القراءات، الفهرس O(1)، المرآة المحليّة
window.__cat = {
  ensure:(o)=>catalogEnsure(o),
  find:(c)=>{ const it=catalogFind(c); return it?Object.assign({},it):null; },
  count:()=>catalogCount(),
  loaded:()=>catalogIsLoaded(),
  reads:()=>catalogReadsUsed(),
  ver:()=>catalogVer,
  seed:(items,ver)=>catalogSetItems(items,ver),
  clear:()=>catalogClear(),
  mirrorGet:()=>catalogMirrorGet(),
  mirrorSet:(items,ver)=>catalogMirrorSet(items,ver),
  chunkSize:()=>CATALOG_CH,
  cacheKey:()=>CATALOG_CACHE_KEY,
  indexed:()=>!!catalogIndex,
  // إثبات O(1): متوسط زمن مطابقةٍ واحدة بالميلي ثانية بعد تسخين الفهرس
  bench:(codes,reps)=>{ catalogFind(codes[0]); const n=codes.length, r=reps||1;
    const t0=performance.now(); for(let k=0;k<r;k++){ for(let i=0;i<n;i++) catalogFind(codes[i]); }
    return (performance.now()-t0)/(r*n); }
};
// ط-١١/ط-١٢: خطاطيف الاستيراد والتقرير — المنطق الصافي بلا واجهة
window.__cimp = {
  key:(v)=>catKey(v),
  itemKey:(it)=>catItemKey(it),
  opt:(k)=>catOpt(k),
  on:()=>featuresMasterCatalogOn(),
  fin:()=>canSeeFinance(),
  setOpt:(o)=>{ permConfig=permConfig||{}; permConfig.catalog=Object.assign({},permConfig.catalog||{},o||{}); },
  clrOpt:()=>{ if(permConfig)permConfig.catalog=undefined; },
  setFeat:(v)=>{ permConfig=permConfig||{}; permConfig.features=Object.assign({},permConfig.features||{},{masterCatalog:v}); },
  // خرائط الأعمدة الافتراضيّة لملفّ القالب: باركود/اسم/فئة/تكلفة/وحدة/دفتريّ
  IDX:{code:0,name:1,category:2,cost:3,unit:4,book:5},
  plan:async(rows,idx,fname)=>{ const P=await catBuildPlan(rows,idx||{code:0,name:1,category:2,cost:3,unit:4,book:5},fname||'f.csv');
    return P&&JSON.parse(JSON.stringify(P)); },
  planTimed:async(rows,idx)=>{ let worst=0,last=performance.now();
    const P=await catBuildPlan(rows,idx||{code:0,name:1,category:2,cost:3,unit:4,book:5},'big.csv',()=>{ const n=performance.now(); if(n-last>worst)worst=n-last; last=n; });
    const n=performance.now(); if(n-last>worst)worst=n-last;
    return {ok:!!P,worst:worst,rowsRead:P?P.rowsRead:0,neu:P?P.neu.length:0,upd:P?P.upd.length:0}; },
  abort:(v)=>{ _catAbort=!!v; },
  n:(P,k)=>catN(P,k),
  sec:(P,s,fin)=>catSec(P,s,fin),
  merge:(P,dn,du)=>{ const m=catMergeOut(P,dn,du); return {out:m.out,dirty:m.dirty,del:m.del,n:m.out.length}; },
  write:async(P,dn,du)=>{ const m=catMergeOut(P,dn,du); return await catWriteOut(m); },
  report:(P,dn,du,tot)=>catReportDoc(P,dn,du,tot),
  saved:(d)=>catSavedToPlan(d),
  render:(P,m)=>catRenderPlan(P,m),
  aoa:(P)=>catAoa(P),
  prev:()=>!!_catPrev,
  nav:()=>{ renderNav(); return $('appNav').innerHTML; },
  // الحارس: مسار رفع الجلسة يبقى كما كان بعد إعادة استعمال حوار المواءمة
  mapLbl:()=>{ pending={headers:['a','b'],rows:[['1','x']],sid:'s1'};
    showMapping({code:0,name:1,barcode:-1,category:-1,unit:-1,book:-1,cost:-1});
    const t=$('mapConfirm').textContent; $('mapModal').style.display='none'; pending=null; return t; },
  shared:()=>(typeof readSheet==='function')&&(typeof handleFile==='function'),
  // ح-١: تجربة مسار رفع اللقطة مباشرةً — يرجع {err, open, wrote} لإثبات رفض الملفّ المكرّر بلا كتابة
  mapTry:(rows,idx)=>{ pending={headers:['c','n','co'],rows:rows,sid:'simp'};
    showMapping(idx||{code:0,name:1,barcode:-1,category:-1,unit:-1,book:-1,cost:2});
    { const ms=$('mapStatus'); if(ms)ms.textContent=''; }   // امسح أي حالةٍ سابقة كي يعكس err هذا الرفع وحده
    try{ $('mapConfirm').onclick(); }catch(e){}
    const err=($('mapStatus')&&$('mapStatus').textContent)||''; const open=$('mapModal').style.display!=='none';
    const wrote=Object.keys(window.__store).some(k=>k.indexOf('sessions/simp/snapshot/')===0);
    $('mapModal').style.display='none'; pending=null; return {err:err,open:open,wrote:wrote}; }
};
window.__numv = (v)=>numv(v);   // ح-٢: فحص تطبيع الأرقام مباشرةً
// ط-١٣: خطاطيف الموافقة على صنف الكتالوج أثناء المسح — التدفّقان ٤ و٥
window.__hist14 = {
  D:HISTD,
  opt:(k)=>histOpt(k),
  n:(e)=>entryN(e),
  ops:(l)=>entriesOps(l),
  probe:()=>RUN_PROBE,
  ptr:()=>(_runPtr?Object.assign({},_runPtr):null),
  reset:()=>runReset(),
  brk:(c)=>runBreak(c),
  idx:(entries,run)=>runIndex(entries,run),
  canMerge:(c)=>{ const r=runCanMerge(c); return r?Object.assign({},r):null; },
  advance:(c,run,eid,ri)=>Object.assign({},runAdvance(c,run,eid,ri)),
  // نافذة حذف التتابع
  delAsk:(n)=>runDelAsk(n),
  delShown:()=>{ const o=document.getElementById('rdOverlay'); return !!(o&&o.style.display==='flex'); },
  delText:()=>{ const o=document.getElementById('rdOverlay'); return o?(o.textContent||'').trim():''; },
  delOne:()=>{ const b=document.getElementById('rdOne'); if(b)b.click(); return !!b; },
  delAll:()=>{ const b=document.getElementById('rdAll'); if(b)b.click(); return !!b; },
  delCancel:()=>{ const b=document.getElementById('rdCancel'); if(b)b.click(); return !!b; },
  // مخزن سطر الحركة المؤجَّل
  actRun:()=>(_actRun?Object.assign({},_actRun):null),
  actFlush:()=>actFlush(),
  actAdd:(c,n,q)=>actAdd(c,n,q),
  // منافذ الكتابة والقراءة المباشرة
  writeAdd:(sid,code,d,at,eid,run)=>countWriteAdd(sid,code,d,at,eid,run),
  writeDec:(sid,code,eid)=>countWriteDec(sid,code,eid),
  dec:(code,eid)=>decEntry(code,eid),
  add:(c,v,o)=>addEntry(c,v,o),
  rm:(c,i)=>removeEntry(c,i),
  rsItem:(c)=>resetItem(c),
  delBtn:(code,i)=>{ const b=document.querySelector('[data-delc="'+code+'"][data-deli="'+i+'"]'); if(!b)return null;
    const r={n:b.getAttribute('data-deln'),e:b.getAttribute('data-dele')}; b.click(); return r; },
  pend:()=>JSON.parse(JSON.stringify(_pendingAdds)),
  counts:()=>JSON.parse(JSON.stringify(curCounts)),
  clistHtml:()=>{ const el=document.getElementById('clist'); return el?el.innerHTML:''; },
  actHtml:()=>{ const el=document.getElementById('actlog'); return el?el.innerHTML:''; },
  renderAct:(rows)=>{ const el=document.getElementById('actlog'); if(!el)return ''; const qs={forEach:(f)=>rows.forEach(r=>f({data:()=>r}))}; renderActivity(qs); return el.innerHTML; },
  agg:(entries)=>repAgg(entries),
  who:(w)=>whoDetail(w,false),
  /* قياس الأداء — القياس الحقيقيّ: تتابعٌ متّصل من الصفر. السجلّ لا ينمو أصلًا مع ط-١٤،
     فزمن المسحة رقم ٥٠٠٠ = زمن المسحة رقم ١٠. هذا هو ما يراه العدّاد فعلًا. */
  benchRun:async (sid,code,n)=>{ const path='sessions/'+sid+'/counts/'+code;
    const uid=(auth.currentUser&&auth.currentUser.uid)||'u1';
    window.__mockSet(path,{code:code,qty:0,entries:[]});
    const eid0='r0'; await countWriteAdd(sid,code,1,Date.now(),eid0,null);
    let r={code:String(code),eid:eid0,ri:0,by:uid,seq:1}; const t=[];
    for(let k=0;k<n;k++){ const t0=performance.now();
      const ri=await countWriteAdd(sid,code,1,Date.now(),'r'+(k+1),r);
      t.push(performance.now()-t0);
      r={code:r.code,eid:r.eid,ri:(ri>=0?ri:r.ri),by:r.by,seq:r.seq+1}; }
    const avg=(a)=>a.reduce((x,y)=>x+y,0)/(a.length||1);
    const d=window.__store[path];
    return {first:avg(t.slice(0,100)),last:avg(t.slice(-100)),max:Math.max.apply(null,t),
            rows:d.entries.length,qty:d.qty,n:entryN(d.entries[0])}; },
  /* أسوأ حالة: مستندٌ قديمٌ ضخم (٥٠٠٠ سطر قبل ط-١٤). مقارنة الدمج بالإلحاق تُثبت
     أنّ ط-١٤ ليس أبطأ ممّا يستبدله — وكلفة نسخ المستند كانت قائمةً قبله أصلًا. */
  benchBig:async (sid,code,n,runs,mode)=>{ const path='sessions/'+sid+'/counts/'+code;
    const uid=(auth.currentUser&&auth.currentUser.uid)||'u1';
    const ents=[]; for(let i=0;i<n;i++)ents.push({id:'seed-'+i,q:1,by:'u-seed',byName:'بذرة',at:1});
    const eid0='run-head'; ents.push({id:eid0,q:1,by:uid,byName:'أنا',at:2});
    window.__mockSet(path,{code:code,qty:n+1,entries:ents});
    let r={code:String(code),eid:eid0,ri:ents.length-1,by:uid,seq:1};
    const t0=performance.now();
    for(let k=0;k<runs;k++){ const use=(mode==='append')?null:r;
      const ri=await countWriteAdd(sid,code,1,Date.now(),'e-'+k,use);
      if(use)r={code:r.code,eid:r.eid,ri:(ri>=0?ri:r.ri),by:r.by,seq:r.seq+1}; }
    const ms=performance.now()-t0; const d=window.__store[path];
    return {ms:ms,per:ms/runs,rows:d.entries.length,qty:d.qty}; },
  doc:(sid,code)=>{ const d=window.__store['sessions/'+sid+'/counts/'+code]; return d?JSON.parse(JSON.stringify(d)):null; },
  acts:(sid)=>{ const out=[]; for(const k in window.__store){ if(k.indexOf('sessions/'+sid+'/activity/')===0)out.push(window.__store[k]); } return JSON.parse(JSON.stringify(out)); },
  actCount:(sid)=>{ let c=0; for(const k in window.__store){ if(k.indexOf('sessions/'+sid+'/activity/')===0)c++; } return c; },
};
window.__cat13 = {
  on:()=>ca13On(),
  warm:()=>ca13Warm(),
  findScan:(c)=>{ const it=catalogFindScan(c); return it?Object.assign({},it):null; },
  item:(cat,code)=>ca13Item(cat,code),
  try:(job)=>ca13Try(job),
  insert:(cat,code)=>ca13Insert(cat,code),
  // مجموعة المرفوضين — لإثبات «لا تتكرّر النافذة»
  declined:()=>(_ca13Declined?Array.from(_ca13Declined):[]),
  clrDeclined:()=>{ _ca13Declined=null; },
  // السقف اليوميّ المحلّيّ
  capKey:()=>ca13CapKey(),
  capUsed:()=>ca13CapUsed(),
  capBump:()=>ca13CapBump(),
  capClr:()=>{ try{ for(let i=localStorage.length-1;i>=0;i--){ const x=localStorage.key(i); if(x&&x.indexOf('iomp-cadd-')===0)localStorage.removeItem(x); } }catch(e){} },
  capSet:(n)=>{ try{ localStorage.setItem(ca13CapKey(),String(n)); }catch(e){} },
  // نافذة الموافقة — الفحص والضغط برمجيًّا
  askShown:()=>{ const o=document.getElementById('caOverlay'); return !!(o&&o.style.display==='flex'); },
  askText:()=>{ const o=document.getElementById('caOverlay'); return o?(o.textContent||'').trim():''; },
  askCells:()=>{ const o=document.getElementById('caOverlay'); if(!o)return {};
    const m={}; o.querySelectorAll('.tile').forEach(t=>{ const k=t.querySelector('.k'), v=t.querySelector('.v'); if(k&&v)m[(k.textContent||'').trim()]=(v.textContent||'').trim(); }); return m; },
  askWarn:()=>{ const e=document.getElementById('caWarn'); return e?(e.textContent||'').trim():''; },
  yes:()=>{ const b=document.getElementById('caYes'); if(b)b.click(); return !!b; },
  no:()=>{ const b=document.getElementById('caNo'); if(b)b.click(); return !!b; },
  key:(k)=>{ document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true})); },
  setBuf:(v)=>{ const s=document.getElementById('csearch'); if(s)s._scBuf=v; return !!s; },
  // م٧: النافذة لم تعد تُرجع وعدًا — لا خطّاف «ask» بعد اليوم؛ الفحص عبر __ca7
  // سجلّ الباركودات المجهولة — محلّيٌّ بالكامل
  unkKey:()=>UNK_KEY,
  unkGet:()=>unkGet(),
  unkLog:(c,sid)=>unkLog(c,sid),
  unkClr:()=>offlineStore.set(UNK_KEY,[]),
  unkOpen:()=>unkOpen(),
  govHtml:()=>{ const e=document.getElementById('govBody')||document.getElementById('govModal'); return e?e.innerHTML:''; },
  // حالة الجلسة — لإثبات الإدراج والظهور الفوريّ
  extra:()=>curExtra.map(x=>Object.assign({},x)),
  codes:()=>curItems.map(x=>String(x.code)),
  sid:()=>curSid,
  setBlind:(b)=>{ if(curSess)curSess.blind=!!b; },
  clistHas:(c)=>{ const e=document.getElementById('clist'); return !!(e&&e.innerHTML.indexOf(String(c))>=0); },
  clistHtml:()=>{ const e=document.getElementById('clist'); return e?e.innerHTML:''; }
};
/* م٧ — المعاينة الحيّة: خطاطيفُ دفتر المعلَّق واللوحة. لا تُغيّر سلوكًا ولا يستدعيها التطبيق. */
window.__ca7 = {
  size:()=>caSize(),                                   // كم صنفًا معلَّقًا
  focus:()=>caFocus,                                   // أيّ صنفٍ معروضٌ الآن
  busy:()=>!!caBusy,
  codes:()=>(caPending?Array.from(caPending.keys()):[]),   // ترتيب الإدراج = ترتيب الدور
  qty:(c)=>{ const e=caPending?caPending.get(c||caFocus):null; return e?e.jobs.length:0; },
  total:()=>{ let n=0; if(caPending)caPending.forEach(e=>{ n+=e.jobs.length; }); return n; },
  eids:(c)=>{ const e=caPending?caPending.get(c||caFocus):null; return e?e.jobs.map(j=>j.eid):[]; },
  seqs:(c)=>{ const e=caPending?caPending.get(c||caFocus):null; return e?e.jobs.map(j=>j.seq):[]; },
  approve:()=>caApprove(),                             // نفس ما يفعله الزرّ — لا مسارَ ثانٍ
  decline:()=>caDecline(),
  pick:(c)=>{ const b=document.querySelector('#caTray [data-cac="'+String(c).replace(/"/g,'\\"')+'"]'); if(b)b.click(); return !!b; },
  reset:()=>caReset(),
  flush:()=>{ caFlush(); },                            // إجبار الرسم المؤجَّل — لفحص المحتوى دون انتظار المؤقّت
  pend:()=>!!_caRPend,                                 // هل الرسم مؤجَّلٌ فعلًا (إثبات «الرسم خارج المسار الحرج»)
  shown:()=>_caShown,                                  // آخر صنفٍ رُسم رسمًا كاملًا
  trayHtml:()=>{ const e=document.getElementById('caTray'); return e?e.innerHTML:''; },
  trayCodes:()=>Array.from(document.querySelectorAll('#caTray [data-cac]')).map(b=>b.getAttribute('data-cac')),
  badge:()=>{ const e=document.getElementById('caBadge'); return e?(e.textContent||'').trim():''; },
  yesLabel:()=>{ const b=document.getElementById('caYes'); return b?(b.textContent||'').trim():''; },
  noLabel:()=>{ const b=document.getElementById('caNo'); return b?(b.textContent||'').trim():''; },
  closeX:()=>{ const b=document.getElementById('caX'); if(b)b.click(); return !!b; },
  max:()=>CA_MAX_PENDING,
  enterMs:()=>CA_ENTER_MS,
  switchAt:()=>_caSwitchAt,
  ageSwitch:(ms)=>{ _caSwitchAt=Date.now()-Number(ms||0); }   // تقديم لحظة التبديل — لفحص حارس Enter بلا انتظارٍ حقيقيّ
};
/* ط-١٥ (د-٨): نداءٌ مباشرٌ للأغلفة التسعة نفسها التي يستعملها التطبيق — لا نسخةٌ منها.
   الغرض إثباتُ أنّ كلَّ اسمٍ قابلٍ للفوترة يمرّ من العدّاد، بلا الاعتماد على تدفّقٍ يخفي الفرق. */
window.__probe9 = {
  getDoc:(p)=>getDoc({path:p}),
  getDocs:(p)=>getDocs({path:p}),
  setDoc:(p,d)=>setDoc({path:p},d),
  updateDoc:(p,d)=>updateDoc({path:p},d),
  addDoc:(p,d)=>addDoc({path:p},d),
  deleteDoc:(p)=>deleteDoc({path:p}),
  batch3:()=>{ const b=writeBatch(db); b.set({path:'t/a'},{x:1}); b.update({path:'t/a'},{x:2}); b.delete({path:'t/a'}); return b.commit(); },
  txn:()=>runTransaction(db,async(tx)=>{ await tx.get({path:'t/a'}); tx.set({path:'t/a'},{x:9}); }),
  listen:(p)=>new Promise(res=>{ const u=onSnapshot({path:p},()=>{ try{u();}catch(e){} res(true); },()=>res(false)); })
};
window.__setPermCfg = (o)=>{ permConfig=Object.assign({},permConfig||{},o||{}); };
/* ط-١٥ (د-٧ · د-٨ · د-٩ · د-١١): نوافذُ فحصٍ للاختبار فقط — لا تُغيّر سلوكًا ولا تُستدعى من التطبيق. */
window.__quota = {
  D: QUOTAD,
  opt: (k)=>quotaOpt(k),
  state: ()=>Object.assign({}, quotaState()),
  pct: ()=>quotaPct(),
  bump: (k,n)=>qBump(k,n),
  mB: (nr)=>mBump(nr),
  m: (d)=>quotaMAvg(d||7),
  hist: (d)=>quotaHistory(d||7),
  day: (t)=>quotaDay(t),
  key: ()=>QUOTA_KEY,
  save: ()=>quotaSave(true),
  storage: (ss)=>storageEstimate(ss),
  reset: ()=>{ const st=quotaState(); st.r=0; st.w=0; st.warn=0; st.scans=0; st.runs=0; quotaSave(true); return Object.assign({},st); },
  clr: ()=>{ try{ for(let i=localStorage.length-1;i>=0;i--){ const x=localStorage.key(i); if(x&&x.indexOf(QUOTA_KEY)===0)localStorage.removeItem(x); } }catch(e){} }
};
window.__act = {
  attached: ()=>!!actUnsub,
  attach: (sid)=>actAttach(sid===undefined?curSid:sid),
  detach: ()=>{ if(actUnsub){ actUnsub(); actUnsub=null; } },
  lastQs: ()=>!!_actLastQs,
  dirty: ()=>_actDirty
};
/* ط-١٦ (المهمّة ٨٢): خطاطيف لوحة الإعدادات — قراءةٌ وفحصٌ فقط، ولا تُستدعى من التطبيق. */
window.__sets = {
  spec: ()=>SETSPEC.map(s=>({g:s.g,title:s.title,save:s.save,status:s.status,keys:s.fields.map(f=>f.k),
                             types:s.fields.map(f=>f.t),ids:s.fields.map(f=>'set_'+f.k.replace(/[^a-zA-Z0-9]/g,'_'))})),
  keys: (g)=>{ const s=SETSPEC.find(x=>x.g===g); return s?s.fields.map(f=>f.k):[]; },
  id: (k)=>'set_'+k.replace(/[^a-zA-Z0-9]/g,'_'),
  val: (g,k)=>setsVal(g,k),
  collect: (g)=>setsCollect(g),
  save: (g)=>{ const s=SETSPEC.find(x=>x.g===g); return setsSave(g,s.status,'ok'); },
  reset: (g)=>{ const s=SETSPEC.find(x=>x.g===g); return setsReset(g,s.status); },
  defaults: (g)=>(g==='catalog'?CATD:(g==='history'?HISTD:QUOTAD)),
  storageCalc: ()=>setsStorageCalc(),
  storageOut: ()=>{ const e=document.getElementById('setsStorageOut'); return e?(e.textContent||'').trim():null; },
  gaugesHtml: ()=>setsGauges(),
  wire: ()=>setsWire()
};
window.__ready = true;
`;

let out = withoutImports.replace(/<script type="module">/, '<script type="module">' + STUB2);
// insert hooks before the final </script> of the module (last </script> in file)
const lastClose = out.lastIndexOf('</script>');
out = out.slice(0, lastClose) + HOOKS + out.slice(lastClose);

fs.writeFileSync(OUT_HTML, out);
console.log(OUT_HTML + ' written', out.length, 'bytes', '(src=' + SRC_HTML + ')');
