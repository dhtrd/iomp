// اختبار حقيقي لنفاد الحصّة (طلب المالك ٢١-١٠-٢٠٢٦): قراءةٌ فقط حتى RESOURCE_EXHAUSTED — لا كتابة ولا بيانات متروكة.
// يقرأ مجموعة counts عبر كل الجلسات مرارًا (كل مستند مقروء = قراءة واحدة من حصّة اليوم) ويتوقف عند أول رفض حصّة.
// حدود أمان: ٦٥ ألف قراءة كحدٍّ أعلى، و٢٠ دقيقة.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('سرّ حساب الخدمة مفقود'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const MAX = 65000, T0 = Date.now(), MAX_MS = 20 * 60 * 1000;
let reads = 0, rounds = 0;
const q = db.collectionGroup('counts');
while (reads < MAX && Date.now() - T0 < MAX_MS) {
  try {
    const qs = await q.get();
    reads += Math.max(1, qs.size); rounds++;
    if (rounds % 5 === 0) console.log(new Date().toISOString(), 'جولة', rounds, '— قراءات هذا السكربت', reads);
  } catch (e) {
    const code = e.code, msg = String(e.message || e);
    console.log(new Date().toISOString(), 'توقّف عند', reads, 'قراءة —', code, msg.slice(0, 200));
    if (code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) { console.log('✓ نفدت حصّة القراءة اليومية فعليًّا'); process.exit(0); }
    process.exit(1);
  }
}
console.log('انتهى دون نفاد — قراءات:', reads, 'جولات:', rounds);
