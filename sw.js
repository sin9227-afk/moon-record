/* 달의 기록 서비스 워커 — 상대 경로 기반 (GitHub Pages 하위 경로 호환) */
const VERSION = 'moon-record-v1.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/nav.js',
  './js/util.js',
  './js/ui.js',
  './js/store.js',
  './js/lunar.js',
  './js/holidays.js',
  './js/repeat.js',
  './js/dday.js',
  './js/install.js',
  './js/views/month.js',
  './js/views/day.js',
  './js/views/editor.js',
  './js/views/search.js',
  './js/views/dday.js',
  './js/views/settings.js',
  './js/views/onboarding.js',
  './icons/icon.svg',
  './icons/favicon.svg',
  './icons/favicon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/PretendardVariable.woff2',
  './fonts/NanumMyeongjo-Regular.woff2',
  './fonts/NanumMyeongjo-Bold.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 페이지 이동: 네트워크 우선, 실패하면 캐시된 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(new URL('./index.html', self.registration.scope).href)
          .then((r) => r || caches.match(new URL('./', self.registration.scope).href))
          .then((r) => r || new Response('오프라인입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
    );
    return;
  }

  // 그 외 정적 파일: 캐시 우선
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
