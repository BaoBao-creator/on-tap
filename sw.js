const VERSION = 'v6';
const CACHE_APP = `app-${VERSION}`;
const CACHE_EXAM = 'exam-cache';

const CDN_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

const APP_FILES = [
  './',
  './index.html',
  './exam.html',
  './css/style.css',
  './js/app.js',
  './js/exam.js',
  './js/store.js',
  './js/github.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  `${CDN_PDFJS}/pdf.min.js`,
  `${CDN_PDFJS}/pdf.worker.min.js`,
];

const EXAM_RAW_PREFIX = 'https://raw.githubusercontent.com/BaoBao-creator/on-tap/main/exam/';
const GH_API = 'https://api.github.com/repos/BaoBao-creator/on-tap';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then(c => c.addAll(APP_FILES).catch(err => console.warn('Precache partial:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('app-') && k !== CACHE_APP).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (url.startsWith(EXAM_RAW_PREFIX)) {
    event.respondWith(handleExamFetch(req));
    return;
  }
  if (url.startsWith(GH_API)) {
    event.respondWith(handleApiFetch(req));
    return;
  }
  if (url.startsWith(self.location.origin) || url.startsWith(CDN_PDFJS)) {
    event.respondWith(handleAppFetch(req));
  }
});

async function handleExamFetch(req) {
  const cache = await caches.open(CACHE_EXAM);
  const cached = await cache.match(req.url);
  if (cached) return cached;
  return fetch(req);
}

async function handleApiFetch(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function handleAppFetch(req) {
  const cache = await caches.open(CACHE_APP);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}
