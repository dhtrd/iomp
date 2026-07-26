/* بناء نسخة النشر — ط-١٦ (المهمّة ٨٣)
   يُنتج ملفَّين من مصدرٍ واحد:
     index.source.html  = المصدر الموثَّق بتعليقاته كاملةً (للتطوير والصيانة).
     index.html         = نسخة النشر، منها التعليقات فقط لا غير.

   لماذا لا أستعمل مصغِّرًا (minifier)؟ لأنّ المصغِّر يعيد تسمية المعرّفات ويحذف ما
   يظنّه ميتًا، وبين يديّ تطبيقٌ يعتمد على أسماء دوالّ عالميّةٍ ومعرّفات DOM نصّيّة،
   والتكليف يقول: «حافظ على المنطق والمعرّفات ١٠٠٪». فالحذف هنا مقصورٌ على التعليقات.

   ولماذا محلِّل نحويّ (acorn) لا تعبيرٌ نمطيّ؟ لأنّ التعبير النمطيّ لا يفرّق بين
   تعليقٍ حقيقيّ وبين «//» داخل نصٍّ أو داخل قالبٍ نصّيّ أو داخل تعبيرٍ نمطيّ،
   وفي هذا الملفّ مئاتُ النصوص العربيّة والمسارات. فالمحلّل يعطي مواضع التعليقات
   بيقينٍ نحويّ، ولا يُحذف إلّا ما شهد أنّه تعليق. */
const fs = require('fs');
const acorn = require('acorn');

const SRC = process.env.SRC_HTML || 'index.source.html';
const OUT = process.env.OUT_HTML || 'index.html';

const html = fs.readFileSync(SRC, 'utf8');
const OPEN = '<script type="module">';
const i = html.indexOf(OPEN);
const j = html.lastIndexOf('</script>');
if (i < 0 || j < 0 || j <= i) { console.error('لم أعثر على وحدة السكربت'); process.exit(1); }
const head = html.slice(0, i + OPEN.length);
const body = html.slice(i + OPEN.length, j);
const tail = html.slice(j);

/* اجمع مواضع التعليقات من المحلّل نفسه، ثمّ احذفها من الآخر إلى الأوّل
   كي لا تنزاح المواضع أثناء الحذف. */
const comments = [];
acorn.parse(body, { ecmaVersion: 'latest', sourceType: 'module', onComment: comments, locations: false });
comments.sort((a, b) => b.start - a.start);

let out = body, removed = 0;
for (const c of comments) {
  /* السطرُ الذي لا يحمل إلّا تعليقًا يُحذف بسطره كاملًا؛ والتعليقُ في آخر سطرِ شيفرةٍ
     يُحذف وحده ويبقى السطر. وهذا يمنع تراكم أسطرٍ فارغةٍ بلا داعٍ. */
  let s = c.start, e = c.end;
  const lineStart = out.lastIndexOf('\n', s - 1) + 1;
  const before = out.slice(lineStart, s);
  if (/^[ \t]*$/.test(before)) {
    s = lineStart;
    const nl = out.indexOf('\n', e);
    if (nl >= 0) e = nl + 1;
  } else {
    while (s > lineStart && (out[s - 1] === ' ' || out[s - 1] === '\t')) s--;
  }
  out = out.slice(0, s) + out.slice(e);
  removed++;
}

/* شبكة أمانٍ أولى: النصّ الناتج لا بدّ أن يُحلَّل نحويًّا بنجاح. */
acorn.parse(out, { ecmaVersion: 'latest', sourceType: 'module' });

/* شبكة أمانٍ ثانية: تجريدُ التعليقات من الاثنين يجب أن يُنتج النصّ نفسه حرفًا بحرف
   — أيْ أنّ ما حُذف تعليقٌ لا غير، ولم تُمَسّ شيفرةٌ واحدة. */
const strip = (src) => {
  const cc = [];
  acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', onComment: cc });
  cc.sort((a, b) => b.start - a.start);
  let t = src;
  for (const c of cc) t = t.slice(0, c.start) + t.slice(c.end);
  return t.replace(/\s+/g, ' ').trim();
};
const a = strip(body), b = strip(out);
if (a !== b) {
  let k = 0; while (k < a.length && a[k] === b[k]) k++;
  console.error('اختلاف بعد التجريد عند الموضع ' + k + ':\n  المصدر: ' + a.slice(k - 60, k + 60) + '\n  الناتج: ' + b.slice(k - 60, k + 60));
  process.exit(1);
}

fs.writeFileSync(OUT, head + out + tail);
/* القياس بالبايت لا بالمحارف — الحرف العربيّ محرفٌ واحدٌ وبايتان في UTF-8،
   والضغط بأداة gzip الرسميّة هي المرجع المعتمد في وثيقة الميزانيّة.
   والضغط بالمجرى القياسيّ (`< path`) لا بوسيطِ اسمٍ، لأنّ gzip يخزّن اسم الملفّ
   في ترويسته حين يُعطى اسمًا — فيتغيّر الرقم بتغيّر الاسم وحده. القياس هنا
   يخصّ المحتوى لا التسمية. */
const gz = (p) => Number(require('child_process').execSync('gzip -9 -c < "' + p + '" | wc -c').toString().trim());
const rawS = fs.statSync(SRC).size, rawO = fs.statSync(OUT).size, gzS = gz(SRC), gzO = gz(OUT);
const kb = (n) => (n / 1024).toFixed(1) + ' ك.ب';
console.log('تعليقاتٌ حُذفت: ' + removed);
console.log('المصدر : ' + rawS + ' بايت (' + kb(rawS) + ')  مضغوطًا ' + gzS + ' (' + kb(gzS) + ')');
console.log('النشر  : ' + rawO + ' بايت (' + kb(rawO) + ')  مضغوطًا ' + gzO + ' (' + kb(gzO) + ')');
console.log('الوفر  : ' + (rawS - rawO) + ' بايت خامًا · ' + (gzS - gzO) + ' بايت مضغوطًا (' + (100 * (gzS - gzO) / gzS).toFixed(1) + '٪)');
console.log('التحقّق : الشيفرة متطابقةٌ حرفًا بحرف بعد تجريد الطرفين ✓');
