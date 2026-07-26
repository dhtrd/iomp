#!/usr/bin/env node
/**
 * measure_rules_ceiling.mjs — قياس سقف التعابير في firestore.rules
 *
 * الحدود الرسميّة (مُحقَّقة من التوثيق الحيّ — يوليو ٢٠٢٦):
 *   • أقصى عدد تعابير تُقيَّم لكل طلب ............ 1000
 *   • أقصى get()/exists()/getAfter() لكل طلب .... 10 (مستند واحد أو استعلام) · 20 (دفعة/معاملة)
 *   • أقصى حجم نصّ القواعد ...................... 256 KB
 *   • أقصى حجم القواعد المُترجَمة ................ 250 KB
 *   • أقصى عمق نداء دالة ........................ 20
 *
 * المنهج: لغة القواعد تدمج الدوال نصيًّا، فنُوسّع كل نداءِ دالةٍ مُعرَّفة (مع إبدال
 * الوسائط) ثم نُحلّل التعبير بمُعرِبٍ حقيقيّ ونحسب كلفتين:
 *   A) الحدّ الأعلى الخام   — كل عقدة تُحسب، حتى فرعا الشرط الثلاثيّ معًا (غير واقعيّ، مرجعٌ فقط)
 *   B) أسوأ حالٍ واقعيّ     — الشرط الثلاثيّ يُقيّم فرعًا واحدًا فقط (شرط + الأثقل من الفرعين)،
 *                            و && و || يُقيَّمان كاملَين (وهو تحديدًا حال الرفض = الحال الأسوأ)
 * الرقم (B) هو الذي يُقارَن بالسقف 1000، لأن فرعَي الشرط الثلاثيّ لا يُقيَّمان معًا أبدًا.
 */
import { readFileSync } from 'node:fs';

const SRC = process.argv[2] || 'firestore.rules';
const raw = readFileSync(SRC, 'utf8');

const LIMIT_EXPR = 1000, LIMIT_GET_SINGLE = 10, LIMIT_GET_BATCH = 20;
const LIMIT_TEXT = 256 * 1024, LIMIT_COMPILED = 250 * 1024, MAX_DEPTH = 20;

/* ═══════════ 1. تجريد التعليقات مع حفظ السلاسل ═══════════ */
function stripComments(s) {
  let out = '', i = 0, inStr = null;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += (n ?? ''); i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === "'" || c === '"') { inStr = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { out += (s[i] === '\n' ? '\n' : ' '); i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}
const src = stripComments(raw);
const lineAt = (idx) => { let n = 1; for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n++; return n; };

/* ═══════════ 2. استخراج الدوال ═══════════ */
const FUNCS = new Map();
{
  const re = /function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{\s*return\s+([\s\S]*?);\s*\}/g;
  for (let m; (m = re.exec(src));) {
    FUNCS.set(m[1], {
      name: m[1],
      params: m[2].split(',').map(s => s.trim()).filter(Boolean),
      body: m[3].replace(/\s+/g, ' ').trim(),
    });
  }
}

/* ═══════════ 3. أدوات نصّية ═══════════ */
function splitTop(s, sep = ',') {
  const out = []; let d = 0, cur = '', inStr = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { cur += c; if (c === '\\') { cur += s[++i] ?? ''; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"') { inStr = c; cur += c; continue; }
    if ('(['.includes(c) || c === '{') d++;
    if (')]'.includes(c) || c === '}') d--;
    if (c === sep && d === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function matchParen(s, open) {
  let d = 0, inStr = null;
  const oc = s[open], cc = oc === '(' ? ')' : oc === '[' ? ']' : '}';
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === oc) d++; else if (c === cc) { d--; if (!d) return i; }
  }
  return -1;
}

/* ═══════════ 4. توسيع الدوال نصيًّا ═══════════ */
function findUserCall(expr) {
  const re = /(^|[^.\w$])([A-Za-z_]\w*)\s*\(/g;
  for (let m; (m = re.exec(expr));) {
    if (!FUNCS.has(m[2])) continue;
    const open = m.index + m[0].length - 1;
    const close = matchParen(expr, open);
    if (close < 0) continue;
    return { name: m[2], start: m.index + m[1].length, open, close, argsSrc: expr.slice(open + 1, close) };
  }
  return null;
}
function substitute(body, params, args) {
  if (!params.length) return body;
  let out = '', i = 0, inStr = null;
  while (i < body.length) {
    const c = body[i];
    if (inStr) { out += c; if (c === '\\') out += body[++i] ?? ''; if (c === inStr) inStr = null; i++; continue; }
    if (c === "'" || c === '"') { inStr = c; out += c; i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < body.length && /[\w$]/.test(body[j])) j++;
      const word = body.slice(i, j);
      const pi = params.indexOf(word);
      out += (pi >= 0 && out.trimEnd().slice(-1) !== '.') ? '(' + (args[pi] ?? 'null') + ')' : word;
      i = j; continue;
    }
    out += c; i++;
  }
  return out;
}
function inline(expr, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('عمق نداء الدوال تجاوز ' + MAX_DEPTH);
  let cur = expr, guard = 0;
  for (;;) {
    const call = findUserCall(cur);
    if (!call) return cur;
    if (++guard > 100000) throw new Error('حارس التوسيع');
    const f = FUNCS.get(call.name);
    const args = splitTop(call.argsSrc);
    const body = inline(substitute(f.body, f.params, args), depth + 1);
    cur = cur.slice(0, call.start) + '(' + body + ')' + cur.slice(call.close + 1);
  }
}

/* ═══════════ 5. مُعرِب تعابير حقيقيّ ═══════════ */
function tokenize(s) {
  const T = []; let i = 0;
  const P3 = ['==='], P2 = ['&&', '||', '==', '!=', '<=', '>='];
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === c) break; j++; }
      T.push({ t: 'str', v: s.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (/\d/.test(c)) { let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++; T.push({ t: 'num', v: s.slice(i, j) }); i = j; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < s.length && /[\w$]/.test(s[j])) j++; T.push({ t: 'id', v: s.slice(i, j) }); i = j; continue; }
    const two = s.slice(i, i + 2);
    if (P2.includes(two)) { T.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()[]{},.?:!<>+-*/%'.includes(c)) { T.push({ t: 'op', v: c }); i++; continue; }
    i++;
  }
  return T;
}

/* عقدة الكلفة: {raw, real} — raw = كل الفروع، real = الشرط الثلاثيّ فرعٌ واحد */
function parseCost(tokens) {
  let p = 0;
  const peek = () => tokens[p], eat = (v) => { if (tokens[p] && tokens[p].v === v) { p++; return true; } return false; };
  const add = (a, b) => ({ raw: a.raw + b.raw, real: a.real + b.real, get: a.get.concat(b.get) });
  const one = (g = []) => ({ raw: 1, real: 1, get: g });

  function ternary() {
    let c = or();
    if (peek() && peek().v === '?') {
      p++;
      const a = ternary();
      eat(':');
      const b = ternary();
      c = {
        raw: c.raw + 1 + a.raw + b.raw,
        real: c.real + 1 + Math.max(a.real, b.real),
        get: c.get.concat(a.get, b.get),          // للوصول: نحتفظ بالاتحاد (متحفّظ)
      };
    }
    return c;
  }
  function or()  { let l = and(); while (peek() && peek().v === '||') { p++; l = add(add(l, one()), and()); } return l; }
  function and() { let l = un();  while (peek() && peek().v === '&&') { p++; l = add(add(l, one()), un());  } return l; }
  function un()  { if (peek() && peek().v === '!') { p++; return add(one(), un()); } return cmp(); }
  function cmp() {
    let l = addsub();
    while (peek() && ['==', '!=', '<=', '>=', '<', '>'].includes(peek().v) ||
           (peek() && peek().t === 'id' && peek().v === 'in')) { p++; l = add(add(l, one()), addsub()); }
    return l;
  }
  function addsub() { let l = mul(); while (peek() && ['+', '-'].includes(peek().v)) { p++; l = add(add(l, one()), mul()); } return l; }
  function mul()    { let l = post(); while (peek() && ['*', '/', '%'].includes(peek().v)) { p++; l = add(add(l, one()), post()); } return l; }

  function post() {
    let l = prim();
    for (;;) {
      if (peek() && peek().v === '.') {
        p++;
        const name = peek() && peek().t === 'id' ? peek().v : ''; if (peek()) p++;
        if (peek() && peek().v === '(') { p++; const a = args(); l = add(add(l, one()), a); }
        else l = add(l, one());
        void name;
      } else if (peek() && peek().v === '[') { p++; const idx = ternary(); eat(']'); l = add(add(l, one()), idx); }
      else if (peek() && peek().v === '(') { p++; const a = args(); l = add(add(l, one()), a); }
      else break;
    }
    return l;
  }
  function args() {
    let acc = { raw: 0, real: 0, get: [] };
    if (peek() && peek().v === ')') { p++; return acc; }
    for (;;) { acc = add(acc, ternary()); if (eat(',')) continue; eat(')'); break; }
    return acc;
  }
  function prim() {
    const t = peek();
    if (!t) return { raw: 0, real: 0, get: [] };
    if (t.v === '(') { p++; const e = ternary(); eat(')'); return e; }
    if (t.v === '[') { p++; let acc = one(); if (peek() && peek().v === ']') { p++; return acc; }
      for (;;) { acc = add(acc, ternary()); if (eat(',')) continue; eat(']'); break; } return acc; }
    if (t.v === '{') { p++; let acc = one(); if (peek() && peek().v === '}') { p++; return acc; }
      for (;;) { acc = add(acc, ternary()); if (eat(':')) { acc = add(acc, ternary()); } if (eat(',')) continue; eat('}'); break; } return acc; }
    if (t.t === 'str' || t.t === 'num') { p++; return one(); }
    if (t.t === 'id') {
      p++;
      if (['get', 'exists', 'getAfter'].includes(t.v) && peek() && peek().v === '(') return one([t.v]);
      return one();
    }
    p++; return one();
  }
  const r = ternary();
  r.leftover = tokens.length - p;
  r.tokens = tokens.length;
  if (r.leftover > 0) r.nextTok = tokens.slice(p, p + 6).map(t => t.v).join(' ');
  return r;
}

/* ═══ تطبيع مسارات المستندات ═══
   `get(/databases/$(db)/documents/users/$(uid()))` ليس تعبيرًا صالحًا نحويًّا،
   فالشرطة المائلة تُفهم قسمةً ويختلّ المُعرِب. نُحوّل وسيط المسار إلى نداءٍ صوريّ
   `PATH(<كل تعبير داخل $()>)` — فيبقى المسار عقدةً واحدة وتبقى التعابير المُقحَمة محسوبة. */
function normalizePaths(expr) {
  const re = /\b(get|exists|getAfter)\s*\(/g;
  let out = expr, guard = 0;
  for (;;) {
    if (++guard > 100000) throw new Error('حارس تطبيع المسارات');
    re.lastIndex = 0;
    let hit = null;
    for (let m; (m = re.exec(out));) {
      const open = m.index + m[0].length - 1;
      const close = matchParen(out, open);
      if (close < 0) continue;
      const arg = out.slice(open + 1, close);
      if (!arg.trim().startsWith('/')) continue;
      hit = { open, close, arg }; break;
    }
    if (!hit) return out;
    const inner = [];
    for (let i = 0; i < hit.arg.length; i++) {
      if (hit.arg[i] === '$' && hit.arg[i + 1] === '(') {
        const e = matchParen(hit.arg, i + 1);
        if (e > 0) { inner.push(hit.arg.slice(i + 2, e)); i = e; }
      }
    }
    out = out.slice(0, hit.open + 1) + 'PATH(' + inner.join(', ') + ')' + out.slice(hit.close);
  }
}

/* عدّ نداءات الوصول للمستندات (بمساراتها) */
function docAccess(expr) {
  const calls = [];
  const re = /\b(get|exists|getAfter)\s*\(/g;
  for (let m; (m = re.exec(expr));) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(expr, open);
    if (close < 0) continue;
    const arg = expr.slice(open + 1, close).replace(/\s+/g, '');
    if (arg.startsWith('/databases')) calls.push(arg);
  }
  return { total: calls.length, distinct: [...new Set(calls)] };
}

/* ═══════════ 6. استخراج allow مع مسار match صحيح ═══════════ */
function extractAllows(text) {
  const out = [], stack = [];
  let i = 0, inStr = null;
  while (i < text.length) {
    const c = text[i];
    if (inStr) { if (c === '\\') { i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
    if (c === "'" || c === '"') { inStr = c; i++; continue; }
    if (text.startsWith('match', i) && /\s/.test(text[i + 5] || '') && !/[\w$]/.test(text[i - 1] || ' ')) {
      let j = i + 5; while (j < text.length && /\s/.test(text[j])) j++;
      let k = j; while (k < text.length && !/\s/.test(text[k])) k++;
      const path = text.slice(j, k);
      let b = k; while (b < text.length && text[b] !== '{') b++;
      stack.push({ kind: 'match', path });
      i = b + 1; continue;
    }
    if (text.startsWith('allow', i) && /\s/.test(text[i + 5] || '') && !/[\w$]/.test(text[i - 1] || ' ')) {
      const semi = text.indexOf(';', i);
      const mm = /^allow\s+([\w\s,]+?)\s*:\s*if\s+([\s\S]*)$/.exec(text.slice(i, semi));
      if (mm) out.push({
        line: lineAt(i),
        methods: mm[1].split(',').map(s => s.trim()).filter(Boolean),
        path: stack.filter(s => s.kind === 'match').map(s => s.path).join('') || '/',
        expr: mm[2].replace(/\s+/g, ' ').trim(),
      });
      i = (semi < 0 ? text.length : semi + 1); continue;
    }
    if (c === '{') { stack.push({ kind: 'block' }); i++; continue; }
    if (c === '}') { stack.pop(); i++; continue; }
    i++;
  }
  return out;
}

/* ═══════════ 7. التنفيذ ═══════════ */
const allows = extractAllows(src);
const rows = [];
for (const a of allows) {
  if (/^(false|true)$/.test(a.expr)) { rows.push({ ...a, raw: 1, real: 1, get: { total: 0, distinct: [] }, note: 'ثابت' }); continue; }
  let flat, err = null;
  try { flat = inline(a.expr); } catch (e) { err = e.message; flat = a.expr; }
  const ga = docAccess(flat);
  const cost = parseCost(tokenize(normalizePaths(flat)));
  if (cost.leftover > 0) err = (err ? err + ' | ' : '') + 'بقايا رموز: ' + cost.leftover + ' عند «' + cost.nextTok + '»';
  rows.push({ ...a, raw: cost.raw, real: cost.real, get: ga, leftover: cost.leftover, toks: cost.tokens, err });
}
rows.sort((x, y) => y.real - x.real);

const textBytes = Buffer.byteLength(raw, 'utf8');
const worst = rows[0];
const worstGet = rows.slice().sort((a, b) => b.get.distinct.length - a.get.distinct.length)[0];
const over = rows.filter(r => r.real > LIMIT_EXPR);
const warn = rows.filter(r => r.real > LIMIT_EXPR * 0.7 && r.real <= LIMIT_EXPR);

const pad = (s, n) => String(s).padStart(n);
console.log('════════ قياس سقف قواعد Firestore ════════');
console.log('الملف: ' + SRC + '   ·   ' + new Date().toISOString().slice(0, 10));
console.log('حجم النصّ: ' + textBytes.toLocaleString('en-US') + ' / ' + LIMIT_TEXT.toLocaleString('en-US') +
            ' بايت  (' + (textBytes / LIMIT_TEXT * 100).toFixed(1) + '٪)  — متبقٍّ ' + (LIMIT_TEXT - textBytes).toLocaleString('en-US'));
console.log('دوالّ: ' + FUNCS.size + '  ·  قواعد allow: ' + allows.length);
console.log('');
console.log('  سطر | واقعيّ | ٪1000 | خام  | get | مميّز | المسار : الطرق');
console.log('  ----+--------+-------+------+-----+-------+---------------');
for (const r of rows.slice(0, 18)) {
  const flag = r.real > LIMIT_EXPR ? ' ⛔' : r.real > 700 ? ' ⚠' : '';
  console.log('  ' + pad(r.line, 3) + ' | ' + pad(r.real, 6) + ' | ' + pad((r.real / 10).toFixed(1), 5) + ' | ' +
              pad(r.raw, 4) + ' | ' + pad(r.get.total, 3) + ' | ' + pad(r.get.distinct.length, 5) + ' | ' +
              r.path + ' : ' + r.methods.join(',') + flag);
}
console.log('');
console.log('──── الخلاصة ────');
console.log('أثقل فرع (واقعيّ): ' + worst.real + ' تعبيرًا = ' + (worst.real / 10).toFixed(1) + '٪ من السقف');
console.log('   سطر ' + worst.line + ' · ' + worst.path + ' : ' + worst.methods.join(','));
console.log('المتّسع المتبقّي: ' + (LIMIT_EXPR - worst.real) + ' تعبيرًا');
console.log('فروع فوق السقف: ' + over.length + '  ·  فروع في المنطقة الحمراء (>70٪): ' + warn.length);
console.log('أقصى نداءات مستندات مميّزة: ' + worstGet.get.distinct.length + ' / ' + LIMIT_GET_SINGLE + ' (سطر ' + worstGet.line + ')');
for (const pth of worstGet.get.distinct) console.log('   • ' + pth);

if (process.env.JSON_OUT) {
  console.log('\n---JSON---\n' + JSON.stringify({
    file: SRC, textBytes, limits: { LIMIT_EXPR, LIMIT_GET_SINGLE, LIMIT_GET_BATCH, LIMIT_TEXT, LIMIT_COMPILED },
    funcs: FUNCS.size, allows: allows.length,
    worst: { line: worst.line, path: worst.path, methods: worst.methods, real: worst.real, raw: worst.raw },
    headroom: LIMIT_EXPR - worst.real, over: over.length, warn: warn.length,
    maxDistinctGet: worstGet.get.distinct.length,
    rows: rows.map(r => ({ line: r.line, path: r.path, methods: r.methods, real: r.real, raw: r.raw,
                           getTotal: r.get.total, getDistinct: r.get.distinct.length, err: r.err })),
  }, null, 1));
}
