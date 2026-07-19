// اختبار تنسيق الوقت الحتمي fmtDateTimeAr — يمنع خلل «:٦٠» (تقريب الدقائق في بعض المتصفّحات) في الإشعارات والسجلّات.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext();
const page=await ctx.newPage();
await page.goto(HARNESS+'?s='+encodeURIComponent(b64({profile:OWNER,users:[OWNER]})));
await page.waitForFunction('window.__ready===true',{timeout:8000});

// نبني التواريخ داخل المتصفّح (نفس المنطقة الزمنية) لتفادي اختلاف TZ
const r=await page.evaluate(()=>{
  const f=window.__fmtDateTimeAr; const mk=(h,m,s)=>new Date(2026,6,18,h,m,s,0).getTime();
  return { s0159_30:f(mk(1,59,30)), s0159_59:f(mk(1,59,59)), s2359_45:f(mk(23,59,45)),
    s0000:f(mk(0,0,0)), s1200:f(mk(12,0,0)), s1305:f(mk(13,5,0)), s1154:f(mk(11,54,0)),
    bad:f(NaN), bad2:f(undefined) };
});
ok('جذر الخلل: ٠١:٥٩:٣٠ لا يُظهر «٦٠» ⇒ ٥٩ ص', r.s0159_30.indexOf('٦٠')<0 && /:٥٩ ص$/.test(r.s0159_30), r.s0159_30);
ok('٠١:٥٩:٥٩ ⇒ ٥٩ ص لا ٦٠', r.s0159_59.indexOf('٦٠')<0 && /٠١:٥٩ ص$/.test(r.s0159_59), r.s0159_59);
ok('٢٣:٥٩:٤٥ ⇒ ١١:٥٩ م (١٢ ساعة، لا حمل خاطئ)', /١١:٥٩ م$/.test(r.s2359_45), r.s2359_45);
ok('منتصف الليل ٠٠:٠٠ ⇒ ١٢:٠٠ ص', /١٢:٠٠ ص$/.test(r.s0000), r.s0000);
ok('الظهر ١٢:٠٠ ⇒ ١٢:٠٠ م', /١٢:٠٠ م$/.test(r.s1200), r.s1200);
ok('١٣:٠٥ ⇒ ٠١:٠٥ م', /٠١:٠٥ م$/.test(r.s1305), r.s1305);
ok('١١:٥٤ ص يظلّ صحيحًا (لا انحدار)', /١١:٥٤ ص$/.test(r.s1154), r.s1154);
ok('اليوم/الشهر بأرقام عربية (يبدأ بـ ١٨/٠٧)', r.s1154.indexOf('١٨/٠٧')===0, r.s1154);
ok('قيمة غير صالحة ⇒ نصّ فارغ', r.bad==='' && r.bad2==='', JSON.stringify([r.bad,r.bad2]));

await browser.close();
let pass=0; for(const x of results){ console.log((x.pass?'✓':'✗')+' '+x.n+(x.d&&!x.pass?('  << '+x.d):'')); if(x.pass)pass++; }
console.log(`\nRECON ${pass}/${results.length} ${pass===results.length?'passed':'FAILED'}`);
process.exit(pass===results.length?0:1);
