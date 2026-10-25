// حذف نهائي لجلستَي اختبار الحصّة فقط (موافقة المالك 2026-10-25، الخيار «ب»).
// التطبيق يمنع حذف جلسةٍ بدأ عدّها — وهذا مقصود لحماية الجرد — فهذه أداة لمرّة واحدة تعمل بحساب الخدمة.
// الحماية: (١) معرّفان مثبّتان في الشيفرة لا غير؛ (٢) قبل الحذف يُتحقَّق أن الاسم فيه «🧪» و«يُحذف» والموقع «مستودع تجريبي»،
// وإلا تتوقّف الأداة دون حذف شيء؛ (٣) الوضع الافتراضي «معاينة» يعدّ فقط ولا يحذف؛ (٤) الحذف يتطلّب عبارة تأكيد مكتوبة.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TARGETS = ['DLlz4ZKYqgyJOCrFW6XY', 'sfHq0DptimQYhYFhTuoD'];
const CONFIRM = 'احذف جلستي الاختبار';
const MODE = (process.env.MODE || 'معاينة').trim();
const PHRASE = (process.env.CONFIRM || '').trim();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('✗ سرّ حساب الخدمة مفقود'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const SUBS = ['snapshot', 'counts', 'itemNotes', 'extraItems', 'activity', 'branchReview'];
const plan = [];
for (const sid of TARGETS) {
  const ref = db.collection('sessions').doc(sid);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`— ${sid}: غير موجودة (ربما حُذفت سابقًا) — تخطٍّ`); continue; }
  const s = snap.data();
  const safe = String(s.name || '').includes('🧪') && String(s.name || '').includes('يُحذف') && s.location === 'مستودع تجريبي';
  if (!safe) { console.error(`✗ ${sid}: لا تطابق علامات جلسة الاختبار (الاسم/الموقع) — أُوقفت الأداة ولم يُحذف شيء`); process.exit(1); }
  const counts = {};
  for (const sub of SUBS) counts[sub] = (await ref.collection(sub).count().get()).data().count;
  const other = (await ref.listCollections()).map(c => c.id).filter(id => !SUBS.includes(id));
  plan.push({ sid, ref, name: s.name, counts, other });
  console.log(`• ${s.name} (${sid}) — ` + SUBS.map(k => `${k}: ${counts[k]}`).join(' · ') + (other.length ? ` · أخرى: ${other.join(',')}` : ''));
}

if (MODE !== 'حذف') { console.log('\nوضع «معاينة»: لم يُحذف شيء. لتنفيذ الحذف شغّل الأداة بوضع «حذف» واكتب عبارة التأكيد.'); process.exit(0); }
if (PHRASE !== CONFIRM) { console.error(`✗ عبارة التأكيد غير مطابقة — اكتب حرفيًّا: ${CONFIRM}`); process.exit(1); }

for (const p of plan) {
  await db.recursiveDelete(p.ref);   // المستند وكل مجموعاته الفرعية
  const left = await p.ref.get();
  if (left.exists) { console.error(`✗ ${p.sid}: بقي المستند بعد الحذف`); process.exit(1); }
  console.log(`✓ حُذفت نهائيًّا: ${p.name} (${p.sid})`);
}
console.log(`\nاكتمل: حُذفت ${plan.length} جلسة اختبار بكل بياناتها.`);
