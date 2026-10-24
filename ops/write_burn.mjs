// اختبار حقيقي لنفاد حصّة الكتابة (طلب المالك ٢١-١٠-٢٠٢٦): كتابةٌ فوق ٥٠٠ مستندٍ ثابتة في zz_quota_test مرارًا
// (كل كتابة = كتابة من حصّة اليوم) حتى RESOURCE_EXHAUSTED — يبقى ٥٠٠ مستند فقط تُحذف لاحقًا. لا يمسّ أي بيانات أخرى.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('سرّ حساب الخدمة مفقود'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const MODE = process.env.MODE || 'burn';
if (MODE === 'cleanup') {
  const qs = await db.collection('zz_quota_test').listDocuments(); let n = 0;
  for (let i = 0; i < qs.length; i += 400) { const b = db.batch(); qs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); n += Math.min(400, qs.length - i); }
  console.log('حُذف', n, 'مستند اختباري'); process.exit(0);
}
let BS = 500; const MAX = 26000, T0 = Date.now(), MAX_MS = 20 * 60 * 1000; let writes = 0, round = 0;
while (writes < MAX && Date.now() - T0 < MAX_MS) {
  const b = db.batch();
  for (let i = 0; i < BS; i++) b.set(db.collection('zz_quota_test').doc('d' + i), { r: round, at: Date.now() });
  try { await b.commit(); writes += BS; round++; if (round % 5 === 0) console.log(new Date().toISOString(), 'جولة', round, '— كتابات', writes); }
  catch (e) { const msg = String(e.message || e); console.log(new Date().toISOString(), 'توقّف عند', writes, 'كتابة —', e.code, msg.slice(0, 200));
    if (e.code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) { if (BS > 1) { BS = BS >= 50 ? 10 : 1; console.log('تصغير الدفعة إلى', BS); continue; } console.log('✓ نفدت حصّة الكتابة اليومية فعليًّا — حتى الكتابة المفردة مرفوضة'); process.exit(0); } process.exit(1); }
}
console.log('انتهى دون نفاد — كتابات:', writes);
