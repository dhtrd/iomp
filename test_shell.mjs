// اختبارات الهيكل + المظهر + لوحة المعلومات + البحث الشامل ⌘K (الدفعات ١–٦)
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import path from 'node:path';
execSync('node build_harness.js', { cwd: process.cwd(), stdio: 'inherit' });
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const HARNESS = 'file://' + path.resolve('harness.html');
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const OWNER = { uid:'u_owner', email:'a2@dhtrd.com', name:'المالك', role:'مدير', active:true };
const CT = { uid:'u_ct', email:'ct@dhtrd.com', name:'عدّاد ١', role:'عدّاد', active:true };
const SESS = [
  { id:'sA', name:'جرد فرع جدة', status:'reviewed', itemCount:388, location:'فرع جدة' },
  { id:'sB', name:'جرد فرع الرياض', status:'review', itemCount:512, location:'فرع الرياض' },
  { id:'sC', name:'جرد مستودع الأثاث', status:'open', started:true, assignedCounters:['u_ct'], itemCount:446, location:'مستودع الأثاث' },
];
const results=[]; const ok=(n,c,d='')=>results.push({n,pass:!!c,d});
const browser=await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
const ctx=await browser.newContext({ viewport:{width:1100,height:900} });
async function load(page,sc){ await page.goto(HARNESS+'?s='+encodeURIComponent(b64(sc))); await page.waitForFunction('window.__ready===true',{timeout:8000}); await page.waitForTimeout(300); }

// H1–H4 — الهيكل واللوحة والوضع واللكنة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:SESS});
  const r=await page.evaluate(()=>({side:!!document.querySelector('.side'),top:!!document.querySelector('.topbar'),
    homeOn:!!document.querySelector('#appNav [data-tab="home"].on'),title:document.getElementById('pageTitle').textContent,
    kpis:document.querySelectorAll('#dashKpis .tile').length,acts:document.querySelectorAll('#actionCenter .acrow').length}));
  ok('H1 القائمة الجانبية والترويسة موجودتان', r.side&&r.top);
  ok('H1 لوحة المعلومات هي الافتراض (تبويب نشط + عنوان)', r.homeOn&&r.title==='لوحة المعلومات', r.title);
  ok('H1 مؤشّرات الحالات الأربعة', r.kpis===4, String(r.kpis));
  ok('H1 مركز «بانتظار إجرائك» فيه بنود (اعتماد+مراجعة)', r.acts===2, String(r.acts));
  await page.click('#menuToggle'); await page.waitForTimeout(300);
  const nav1=await page.evaluate(()=>document.getElementById('appView').getAttribute('data-nav'));
  await page.click('#menuToggle'); await page.waitForTimeout(200);
  const nav2=await page.evaluate(()=>document.getElementById('appView').getAttribute('data-nav'));
  ok('H2 زرّ القائمة يطوي ثم يوسّع', nav1==='collapsed'&&nav2==='expanded', nav1+'→'+nav2);
  await page.click('#themeToggle'); await page.waitForTimeout(250);
  const th=await page.evaluate(()=>({t:document.documentElement.getAttribute('data-theme'),ls:(JSON.parse(localStorage.getItem('iomp-appearance')||'{}').mode)}));
  ok('H3 المبدّل يفعّل الوضع الداكن ويحفظه', th.t==='dark'&&th.ls==='dark', JSON.stringify(th));
  await page.click('#apBtn'); await page.waitForTimeout(150);
  await page.click('#apop [data-apacc="sky"]'); await page.waitForTimeout(200);
  const acc=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--navy700').trim());
  ok('H4 تغيير اللكنة يعيد تلوين النظام', acc==='#38BDF8'||acc==='#0EA5E9', acc);
  await page.close(); }

// H5 — فعل مركز الإجراءات يفتح الجلسة
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:SESS});
  await page.evaluate(()=>{ const b=document.querySelector('#actionCenter [data-dopen="sA"]'); if(b)b.click(); }); await page.waitForTimeout(450);
  ok('H5 زرّ «اعتماد» في اللوحة يفتح الجلسة', await page.evaluate(()=>window.__contentHtml().includes('جرد فرع جدة')));
  await page.close(); }

// K1 — ⌘K: فتحٌ وبحثٌ حيّ وفتح النتيجة بـ Enter
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER,CT],sessions:SESS});
  await page.keyboard.press('Control+k'); await page.waitForTimeout(350);
  const open1=await page.evaluate(()=>document.getElementById('ckPanel').classList.contains('open'));
  ok('K1 Ctrl+K يفتح لوحة البحث', open1);
  await page.type('#ckInput','الرياض'); await page.waitForTimeout(250);
  const res=await page.evaluate(()=>[...document.querySelectorAll('.ck-row .ck-t b')].map(x=>x.textContent));
  ok('K1 البحث يرشّح النتائج («الرياض»)', res.length>=1&&res.every(t=>t.includes('الرياض')), JSON.stringify(res));
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  const opened=await page.evaluate(()=>window.__contentHtml().includes('جرد فرع الرياض'));
  const closed=await page.evaluate(()=>!document.getElementById('ckPanel').classList.contains('open'));
  ok('K1 Enter يفتح النتيجة ويغلق اللوحة', opened&&closed);
  await page.close(); }

// K2 — النطاق: العدّاد يجد جلسته المكلَّف بها فقط، وبلا نتائج مستخدمين
{ const page=await ctx.newPage(); await load(page,{user:{uid:'u_ct',email:'ct@dhtrd.com'},profile:CT,users:[OWNER,CT],sessions:SESS});
  await page.keyboard.press('Control+k'); await page.waitForTimeout(400);
  await page.type('#ckInput','جرد'); await page.waitForTimeout(250);
  const res=await page.evaluate(()=>[...document.querySelectorAll('.ck-row .ck-t b')].map(x=>x.textContent));
  ok('K2 العدّاد يجد المكلَّف بها فقط (النطاق مفروض)', res.some(t=>t.includes('الأثاث'))&&!res.some(t=>t.includes('جدة'))&&!res.some(t=>t.includes('الرياض')), JSON.stringify(res));
  const groups=await page.evaluate(()=>[...document.querySelectorAll('.ck-g')].map(g=>g.textContent));
  ok('K2 لا مجموعة «مستخدمون» بلا صلاحية إدارتهم', !groups.some(t=>t.includes('المستخدمون')), JSON.stringify(groups));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  ok('K2 Esc يغلق اللوحة', await page.evaluate(()=>!document.getElementById('ckPanel').classList.contains('open')));
  await page.close(); }

// K3 — أوامر التنقّل السريع: «الصلاحيات» تفتح لوحتها
{ const page=await ctx.newPage(); await load(page,{profile:OWNER,users:[OWNER],sessions:[]});
  await page.keyboard.press('Control+k'); await page.waitForTimeout(350);
  await page.type('#ckInput','الصلاحيات'); await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); await page.waitForTimeout(450);
  ok('K3 أمر التنقّل يفتح «الأدوار والصلاحيات»', await page.evaluate(()=>window.__contentHtml().includes('صلاحيات الأدوار')));
  await page.close(); }

await browser.close();
let pass=0, fail=0;
for (const r of results){ console.log(`${r.pass?'✓':'✗'} ${r.n}${r.pass?'':'  << '+r.d}`); r.pass?pass++:fail++; }
console.log(`\nRECON ${pass}/${pass+fail} passed`);
process.exit(fail?1:0);
