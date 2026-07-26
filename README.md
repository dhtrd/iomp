# نظام إدارة الجرد متعدد المستخدمين (IOMP) — شركة الضبيبي التجارية

تطبيق ويب بملف واحد (`index.html`) على Firebase (خطة Spark المجانية) — عربي RTL أولًا.

## التشغيل والاختبار
```bash
npm install
npx playwright-core install chromium
export CHROME_EXE=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
npm test        # ١٬٣٩١ اختبارًا للتطبيق الحي (٥٤ ملفًا)
```
اختبارات قواعد الأمان (تحتاج Java):
```bash
npm i @firebase/rules-unit-testing firebase firebase-tools
npx firebase emulators:exec --only firestore --project demo-iomp "node firestore-rules.test.mjs"
```

## البنية
- `index.html` — **نسخة النشر** من التطبيق كاملًا (بلا إطار عمل) — مجرَّدة من التعليقات
- `index.source.html` — **المصدر الموثَّق**: يُعدَّل هنا أوّلًا، ثمّ يُولَّد `index.html`
- `build_release.js` — مولِّد نسخة النشر (محلِّل acorn — يحذف التعليقات فقط، ويُبرهن التطابق)
- `firestore.rules` — قواعد الأمان (الفرض الخادمي للصلاحيات)
- `test_*.mjs` + `build_harness.js` — حزمة الاختبار (Playwright + محاكاة Firebase)
- `prototypes/` — نماذج مراحل التصميم م١١–م٢٥ باختباراتها (٢٨٢ اختبارًا إضافيًّا)
- `docs/` — وثائق المراحل والأدلة الثمانية ومعايير النظام

## دورة التعديل
```bash
# ١) عدّل index.source.html (فيه التعليقات)
node build_release.js        # ٢) يولّد index.html ويتحقّق من تطابق الشيفرة حرفًا بحرف
node build_harness.js        # ٣) يبني harness.html
node run_all_tests.mjs       # ٤) يجب أن يُنهي بـ TOTAL: 1391/1391 — ALL GREEN ✓
```
لتشغيل الحزمة على ملفٍّ آخر: `SRC_HTML=index.source.html node run_all_tests.mjs`

## CI/CD
كل دفع إلى `main`: اختبارات التطبيق (١٬٣٩١) + اختبارات القواعد بالمحاكي ← وعند الخضرة: نشر تلقائي إلى GitHub Pages.

## أدوات القياس (لا اختبارات — لا تعدّل شيئًا)
```bash
SRC_HTML=index.html BA_TAG=after node measure_ba.mjs   # قياس أداء المسح (قبل/بعد)
node measure_rules_ceiling.mjs firestore.rules         # سقف تعابير القواعد
node measure_catalog.mjs                               # قياس طبقة الكتالوج
```
