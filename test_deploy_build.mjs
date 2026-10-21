// اختبار بناء النشر المضغوط المسافات (build_deploy.js) — طلب المالك 2026-10-21
// د١ البناء ينجح ويثبت تطابق شجرة الصياغة · د٢ ما خارج وحدة السكربت حرفًا بحرف
// د٣ ملفّ النشر تحت السقف وأصغر من المختبَر · د٤ لا إعادة تسمية: كل المعرّفات العامّة باقية
// د٥ تشغيل فعليّ: الملفّان يقلعان في المتصفّح بلا خطأ ويرسمان شاشة الدخول نفسها
import { readFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});

const dir=mkdtempSync(path.join(tmpdir(),'iomp-deploy-'));
const OUT=path.join(dir,'index.html');
let log='', built=true;
try{ log=execSync('node build_deploy.js',{env:{...process.env,OUT_HTML:OUT},stdio:'pipe'}).toString(); }catch(e){ built=false; log=String(e.stderr||e.stdout||e); }
ok('د١ البناء ينجح', built, log.slice(0,400));
ok('د١ إثبات تطابق شجرة الصياغة مطبوع', log.includes('شجرة الصياغة متطابقة تمامًا'), log.slice(0,200));

const SRC=readFileSync('index.html','utf8'); const DEP=built?readFileSync(OUT,'utf8'):'';
const OPEN='<script type="module">';
const parts=s=>{ const i=s.indexOf(OPEN), j=s.lastIndexOf('</script>'); return {head:s.slice(0,i+OPEN.length), body:s.slice(i+OPEN.length,j), tail:s.slice(j)}; };
const a=parts(SRC), b=built?parts(DEP):{};
ok('د٢ رأس الملفّ (HTML/CSS) مطابق حرفًا بحرف', built && a.head===b.head);
ok('د٢ ذيل الملفّ مطابق حرفًا بحرف', built && a.tail===b.tail);

const gz=p=>Number(execSync('gzip -c < "'+p+'" | wc -c').toString().trim());
const gDep=built?gz(OUT):1e9, gSrc=gz('index.html');
ok('د٣ ملفّ النشر تحت السقف 200,000 مضغوطًا', gDep<200000, 'gz='+gDep);
ok('د٣ ملفّ النشر أصغر من المختبَر', gDep<gSrc, gDep+' vs '+gSrc);

// د٤: كل دالّة/ثابت معرَّف في المستوى الأعلى ما زال بالاسم نفسه (لا mangle)
const decl=s=>new Set([...s.matchAll(/(?:^|[;\n{}])\s*(?:async\s+)?(?:function\s*\*?\s*|(?:const|let|var|class)\s+)([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
const da=decl(a.body), db=built?decl(b.body):new Set();
const lost=[...da].filter(x=>!db.has(x));
ok('د٤ لا إعادة تسمية: كل الأسماء المعرّفة باقية', built && da.size>500 && lost.length===0, 'n='+da.size+' lost='+lost.slice(0,8).join(','));
ok('د٤ أسماء حرجة باقية (addEntry/scanCommit/offlineFlush/computeVariance)', ['addEntry','scanCommit','offlineFlush','computeVariance','oqLocked'].every(n=>db.has(n)));

// د٥: تشغيل فعليّ — Firebase بديل محايد (لا مستخدم مسجّل) ⇒ شاشة الدخول
const names=[...SRC.matchAll(/import\s*\{([^}]*)\}\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+\/(firebase-[a-z]+)\.js"/g)].map(m=>({mod:m[2],names:m[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]).filter(Boolean)}));
const stubFor=mod=>{ const e=(names.find(n=>n.mod===mod)||{names:[]}).names;
  return e.map(n=>n==='onAuthStateChanged'?`export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb(null),0);return()=>{};};`
    :`export const ${n}=(...x)=>new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:(()=>{}),apply:()=>undefined});`).join('\n'); };
const browser=await chromium.launch({executablePath:process.env.CHROME_EXE});
async function boot(file){
  const page=await browser.newPage({viewport:{width:1280,height:900}}); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.route(/gstatic\.com\/firebasejs\//,r=>{ const m=r.request().url().match(/(firebase-[a-z]+)\.js/); r.fulfill({status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:stubFor(m&&m[1])}); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,body:''}));
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await page.waitForTimeout(1500);
  const html=await page.evaluate(()=>{ const c=document.body.cloneNode(true); c.querySelectorAll('script').forEach(x=>x.remove()); return c.innerHTML; }).then(h=>h.replace(/\d{1,2}:\d{2}(:\d{2})?/g,'T'));
  const txt=await page.evaluate(()=>document.body.innerText);
  await page.close(); return {errs,html,txt};
}
const r1=await boot('index.html'); const r2=built?await boot(OUT):{errs:['not built'],html:'',txt:''};
ok('د٥ الملفّ المختبَر يقلع بلا خطأ', r1.errs.length===0, r1.errs.join(' | ').slice(0,300));
ok('د٥ ملفّ النشر يقلع بلا خطأ', r2.errs.length===0, r2.errs.join(' | ').slice(0,300));
ok('د٥ شاشة مرسومة فعلًا (ليست فارغة)', r2.txt.trim().length>10, r2.txt.slice(0,120));
ok('د٥ الشاشة نفسها حرفًا بحرف في الملفّين', r1.html===r2.html && r1.html.length>200, r1.html.length+' vs '+r2.html.length);
await browser.close();

// د٦: المقارِن نفسه يكشف أيّ تغيير حقيقيّ ولا يتسامح إلّا في المتكافئ صياغيًّا
import { createRequire } from 'node:module';
const { ast }=createRequire(import.meta.url)('./build_deploy.js');
const same=(x,y)=>ast(x)===ast(y);
ok('د٦ يكشف تغيير رقم/نصّ/معرّف/عامل', !same('a={x:1}','a={x:2}') && !same('x="أ"','x="ب"') && !same('f(a)','f(b)') && !same('a+b','a-b') && !same('a=`x${b}`','a=`y${b}`'));
ok('د٦ يتسامح في {a}≡{a:a} و30≡"30" والمسافات فقط', same('({a})','({a:a})') && same('({30:1})','({"30":1})') && same('if(a){b()}','if (a) {\n  b();\n}'));
ok('د٦ يكشف تغييرات terser الخطرة (توجيه "use\\x20strict"، نصّ القالب الخام، <!--)', !same('"use\\x20strict";a()','"use strict";a()') && !same('a=`\\u0041`','a=`A`') && !same('x=a<!--b\n','x=a;\n'));
ok('د٦ لا يتسامح في __proto__ ولا 1e3≠"1e3"', !same('({__proto__})','({__proto__:__proto__})') && !same('({1e3:1})','({"1e3":1})'));

let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
