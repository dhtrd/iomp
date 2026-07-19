// توليد أيقونات PWA من شعار «الصندوق المُتحقَّق» — لقطات كروميوم بأبعاد مضبوطة
import { chromium } from 'playwright-core';
const EXE = process.env.CHROME_EXE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
// mark: نسبة عرض الشعار من العرض الكلي (maskable أصغر لملاءمة منطقة الأمان الدائرية في أندرويد)
const SPECS = [
  { file:'icon-192.png',          size:192, mark:0.62 },
  { file:'icon-512.png',          size:512, mark:0.62 },
  { file:'icon-maskable-192.png', size:192, mark:0.46 },
  { file:'icon-maskable-512.png', size:512, mark:0.46 },
  { file:'apple-touch-icon.png',  size:180, mark:0.62 }, // iOS يقصّ الزوايا بنفسه — مربع كامل
];
const LOGO = (px)=>`<svg width="${px}" height="${px}" viewBox="0 0 48 48" fill="none" stroke-linejoin="round" stroke-linecap="round">
  <path d="M24 6.5 L39.5 14.5 V31 L24 39.5 L8.5 31 V14.5 Z" stroke="#fff" stroke-width="2.5"/>
  <path d="M8.5 14.5 L24 22.5 L39.5 14.5" stroke="#fff" stroke-width="2.5"/>
  <path d="M24 22.5 V39.5" stroke="#fff" stroke-width="2.5"/>
  <circle cx="35.5" cy="12.5" r="8.5" fill="#C9A227"/>
  <path d="M31.4 12.7 l2.7 2.7 L39.6 10" stroke="#142440" stroke-width="2.6"/></svg>`;
const page_html = (size, mark)=>`<!DOCTYPE html><html><head><style>
  *{margin:0;padding:0} body{width:${size}px;height:${size}px;overflow:hidden;
  background:linear-gradient(145deg,#1F3864,#142440);display:grid;place-items:center}</style></head>
  <body>${LOGO(Math.round(size*mark))}</body></html>`;
const browser = await chromium.launch({ executablePath:EXE, args:['--no-sandbox'] });
for (const s of SPECS) {
  const ctx = await browser.newContext({ viewport:{width:s.size,height:s.size}, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  await page.setContent(page_html(s.size, s.mark));
  await page.waitForTimeout(80);
  await page.screenshot({ path:s.file, clip:{x:0,y:0,width:s.size,height:s.size} });
  await ctx.close();
  console.log('✓', s.file);
}
await browser.close();
