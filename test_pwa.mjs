// اختبارات PWA — البيان والأيقونات وworker والربط في index.html + عدم الانحدار (الإقلاع على file:// بلا تسجيل SW)
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import path from 'node:path';
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});

// ===== P1 — البيان: JSON سليم بالحقول اللازمة للتثبيت (أندرويد/كروم) والعربية RTL =====
{ let m=null; try{ m=JSON.parse(readFileSync('manifest.webmanifest','utf8')); }catch(e){}
  ok('P1 البيان JSON سليم', !!m);
  ok('P1 حقول التثبيت: name/short_name/start_url/display/icons', !!m && !!m.name && !!m.short_name && m.start_url==='./' && m.display==='standalone' && Array.isArray(m.icons), m&&JSON.stringify({s:m.start_url,d:m.display}));
  ok('P1 عربي RTL + ألوان الهوية', !!m && m.dir==='rtl' && m.lang==='ar' && m.theme_color==='#1F3864' && !!m.background_color, m&&(m.dir+'/'+m.lang));
  const sizes=(m&&m.icons||[]).map(i=>i.sizes+':'+(i.purpose||'any'));
  ok('P1 أيقونات 192+512 بنسختي any وmaskable', sizes.includes('192x192:any')&&sizes.includes('512x512:any')&&sizes.includes('192x192:maskable')&&sizes.includes('512x512:maskable'), sizes.join(' '));
  ok('P1 مسارات نسبية (تعمل تحت مسار Pages الفرعي)', !!m && m.icons.every(i=>!i.src.startsWith('/')) && (m.id==='./'||!m.id) && m.scope==='./', '');
}

// ===== P2 — الأيقونات: موجودة PNG بالأبعاد الصحيحة (بما فيها آيفون 180) =====
{ const dim=f=>{ const d=readFileSync(f); if(d.readUInt32BE(0)!==0x89504E47) return 'notpng'; return d.readUInt32BE(16)+'x'+d.readUInt32BE(20); };
  const want={'icon-192.png':'192x192','icon-512.png':'512x512','icon-maskable-192.png':'192x192','icon-maskable-512.png':'512x512','apple-touch-icon.png':'180x180'};
  const bad=Object.keys(want).filter(f=>!existsSync(f)||dim(f)!==want[f]);
  ok('P2 خمس أيقونات PNG بالأبعاد الصحيحة (192/512/maskable/آيفون180)', bad.length===0, 'bad='+bad.join(','));
}

// ===== P3 — index.html: الربط كامل + حارس التسجيل =====
{ const src=readFileSync('index.html','utf8');
  ok('P3 وسم البيان + theme-color (فاتح وداكن)', src.includes('rel="manifest"') && src.includes('name="theme-color"') && src.includes('prefers-color-scheme: dark'));
  ok('P3 وسوم آيفون: apple-touch-icon + capable + العنوان', src.includes('apple-touch-icon') && src.includes('apple-mobile-web-app-capable') && src.includes('apple-mobile-web-app-title'));
  ok('P3 تسجيل SW محروس بـ https/http (لا يجري على file://)', src.includes("serviceWorker' in navigator") && src.includes('^https?:') && src.includes("register('./sw.js')"));
}

// ===== P4 — sw.js: نحو سليم + الاستراتيجية الصحيحة (تمرير Firestore، شبكة-أولًا محليًّا، كاش firebasejs) =====
{ let syntaxOk=true; try{ execSync('node --check sw.js',{stdio:'pipe'}); }catch(e){ syntaxOk=false; }
  const sw=readFileSync('sw.js','utf8');
  ok('P4 sw.js سليم نحويًّا', syntaxOk);
  ok('P4 معالجات install/activate/fetch + تنظيف الكاش القديم', sw.includes("addEventListener('install'")&&sw.includes("addEventListener('activate'")&&sw.includes("addEventListener('fetch'")&&sw.includes('caches.delete'));
  ok('P4 يمرّر غير-GET وغير-أصلنا مباشرة (لا يعترض Firestore)', sw.includes("method !== 'GET'") && sw.includes('url.origin !== self.location.origin'));
  ok('P4 شبكة-أولًا محليًّا مع احتياط الكاش + كاش firebasejs الثابتة', sw.includes('fetch(req)') && sw.includes("caches.match('./index.html')") && sw.includes('/firebasejs/'));
}

// ===== P5 — عدم الانحدار: التطبيق يقلع في الحزمة (file://) والوسوم الجديدة لا تكسر شيئًا =====
{ execSync('node build_harness.js',{stdio:'pipe'});
  const EXE=process.env.CHROME_EXE||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
  const b64=o=>Buffer.from(JSON.stringify(o),'utf8').toString('base64');
  const OWNER={uid:'u_owner',email:'a2@dhtrd.com',name:'المالك',role:'مدير',active:true};
  const browser=await chromium.launch({executablePath:EXE,args:['--no-sandbox']});
  const page=await (await browser.newContext()).newPage();
  let jsErr=null; page.on('pageerror',e=>{ jsErr=jsErr||String(e); });
  await page.goto('file://'+path.resolve('harness.html')+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER]})));
  await page.waitForFunction('window.__ready===true',{timeout:8000});
  const boot=await page.evaluate(()=>({ app:!!document.getElementById('appView'), manifest:!!document.querySelector('link[rel="manifest"]'), sw:!!navigator.serviceWorker? 'api' : 'none' }));
  ok('P5 يقلع على file:// بلا أخطاء JS (حارس SW صامت)', boot.app && !jsErr, jsErr||'');
  await browser.close();
}

let pass=0; for(const r of results){ console.log((r.pass?'✓':'✗')+' '+r.n+(r.d&&!r.pass?('  << '+r.d):'')); if(r.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
