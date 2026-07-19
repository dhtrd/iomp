// Service Worker — نظام الجرد (IOMP) | شركة الضبيبي التجارية
// الفلسفة: بسيط وغير معترض — «الشبكة أولًا» للملفات المحلية مع احتياط من الكاش عند الانقطاع،
// و«الكاش أولًا» لوحدات Firebase الثابتة المُرقّمة (لا تتغير أبدًا لنفس الإصدار)،
// وتمرير مباشر لكل ما سواه (Firestore/المصادقة/الخطوط) دون أي تدخّل.
// النتيجة: التطبيق يظلّ محدَّثًا دائمًا عند توفر الشبكة، ويفتح من الكاش عند انقطاعها.
const CACHE = 'iomp-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // كتابات/طلبات أخرى — تمرير مباشر
  const url = new URL(req.url);

  // وحدات Firebase الثابتة المرقّمة — كاش أولًا (غير قابلة للتغيّر لنفس الرقم)
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return res;
      }))
    );
    return;
  }

  // ما ليس من أصلنا (Firestore/المصادقة/الخطوط/Dropbox…) — لا تدخّل إطلاقًا
  if (url.origin !== self.location.origin) return;

  // ملفاتنا: شبكة أولًا (تحديث فوري عند النشر) واحتياط الكاش عند الانقطاع
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() =>
      caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
