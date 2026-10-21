/* بناء ملفّ النشر المضغوط المسافات — (طلب المالك 2026-10-21: «ضغط المسافات عند البناء»)
   المدخل : index.html  (نسخة التعليقات المحذوفة — هي التي تمرّ عليها كل الاختبارات)
   المخرج : _site/index.html (أو OUT_HTML) — نفس الشيفرة بلا مسافات/أسطر زائدة.

   ما الذي يُغيَّر؟ المسافات والأسطر داخل وحدة السكربت فقط.
     - لا إعادة تسمية لأيّ معرّف (mangle:false)، ولا «تحسين» ولا حذف شيفرة (compress:false).
     - النصوص والقوالب النصّية والتعابير النمطيّة لا تُمسّ.
     - ما خارج وحدة السكربت (HTML وCSS والسكربتات الأخرى) يُنسخ حرفًا بحرف.

   كيف نثبت أنّ السلوك لم يتغيّر؟ نحلّل الملفّين بـ acorn ونقارن شجرتَي الصياغة (AST)
   بعد إسقاط المواضع فقط. تطابق الشجرتين = البرنامج نفسه تمامًا؛ وأيّ فرقٍ يُفشل البناء
   ويُفشل النشر (لا يُنشر شيءٌ لم يثبت تطابقه). */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { minify } = require('terser');

const SRC = process.env.SRC_HTML || 'index.html';
const OUT = process.env.OUT_HTML || path.join('_site', 'index.html');
const LIMIT = 200000;

const fail = (m) => { console.error('✗ ' + m); process.exit(1); };

/* شجرة الصياغة بلا مواضع: نُسقط start/end/loc/range/raw لأنها تتغيّر بتغيّر المسافات وحدها،
   ونُبقي كل ما عداها (الأنواع، الأسماء، القيم، العوامل، ترتيب العناصر). */
const DROP = new Set(['start', 'end', 'loc', 'range', 'raw']);
function norm(node) {
  if (Array.isArray(node)) return node.map(norm);
  if (node && typeof node === 'object') {
    if (node instanceof RegExp) return { re: String(node) };
    const o = {};
    for (const k of Object.keys(node).sort()) {
      if (DROP.has(k)) continue;
      /* {a} و{a:a} البرنامج نفسه (اختصار صياغيّ فقط) — عدا __proto__ فمعناهما مختلف */
      if (k === 'shorthand' && node.type === 'Property' && !node.computed && node.key && node.key.type === 'Identifier'
          && node.key.name !== '__proto__' && node.value && node.value.type === 'Identifier' && node.value.name === node.key.name) continue;
      let v = node[k];
      /* مفتاح خاصيّة غير محسوب: 30 و"30" المفتاح نفسه (المفتاح يُحوَّل نصًّا دائمًا) */
      if (k === 'key' && !node.computed && v && v.type === 'Literal' && typeof v.value === 'number') v = { type: 'Literal', value: String(v.value) };
      if (k === 'value' && node.type === 'Literal' && typeof v === 'bigint') { o[k] = 'bigint:' + v; continue; }
      if (k === 'value' && node.type === 'TemplateElement') { o[k] = { cooked: v.cooked, raw: v.raw }; continue; }
      o[k] = norm(v);
    }
    return o;
  }
  return node;
}
const ast = (code) => JSON.stringify(norm(acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' })));

module.exports = { ast, norm };
if (require.main === module) (async () => {
  const html = fs.readFileSync(SRC, 'utf8');
  const OPEN = '<script type="module">';
  const i = html.indexOf(OPEN), j = html.lastIndexOf('</script>');
  if (i < 0 || j <= i) fail('لم أعثر على وحدة السكربت في ' + SRC);
  const head = html.slice(0, i + OPEN.length), body = html.slice(i + OPEN.length, j), tail = html.slice(j);
  if (html.indexOf(OPEN, i + 1) >= 0) fail('أكثر من وحدة سكربت — البناء لا يعرف أيّها يضغط');

  const r = await minify(body, {
    module: true,
    ecma: 2020,
    compress: false,
    mangle: false,
    format: { comments: false, beautify: false, ascii_only: false, keep_quoted_props: true, quote_style: 3 /* أبقِ علامة الاقتباس الأصلية */ },
  });
  if (r.error) fail('terser: ' + r.error);
  const code = r.code;

  /* شبكة الأمان: تطابق شجرتَي الصياغة */
  const a = ast(body), b = ast(code);
  if (a !== b) {
    let k = 0; while (k < a.length && a[k] === b[k]) k++;
    fail('شجرة الصياغة اختلفت بعد الضغط عند ' + k + ':\n  قبل: ' + a.slice(k - 120, k + 120) + '\n  بعد: ' + b.slice(k - 120, k + 120));
  }
  /* ولا يجوز أن يظهر «</script» داخل الشيفرة فيقطع الوسم */
  if (/<\/script/i.test(code)) fail('الناتج يحوي «</script» داخل الشيفرة');

  const out = head + code + tail;
  fs.mkdirSync(path.dirname(OUT) || '.', { recursive: true });
  fs.writeFileSync(OUT, out);

  /* المقياس الرسميّ في وثيقة المشروع: «gzip -c ملف | wc -c» (المستوى الافتراضيّ، من المجرى القياسيّ) */
  const gz = (p) => Number(require('child_process').execSync('gzip -c < "' + p + '" | wc -c').toString().trim());
  const gIn = gz(SRC), gOut = gz(OUT);
  console.log('الملفّ المختبَر : ' + Buffer.byteLength(html) + ' بايت · مضغوطًا ' + gIn);
  console.log('ملفّ النشر     : ' + Buffer.byteLength(out) + ' بايت · مضغوطًا ' + gOut + '  (السقف ' + LIMIT + ')');
  console.log('الوفر          : ' + (gIn - gOut) + ' بايت مضغوطًا');
  console.log('التحقّق        : شجرة الصياغة متطابقة تمامًا قبل الضغط وبعده ✓');
  if (gOut > LIMIT) fail('ملفّ النشر تجاوز السقف ' + LIMIT + ' بايت مضغوطًا (' + gOut + ')');
})().catch((e) => fail(e && e.stack || e));
