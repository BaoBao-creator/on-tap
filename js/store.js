import { examUrls, RAW_BASE } from './github.js';

const CACHE_EXAM = 'exam-cache';
const LS_EXAM_LIST = 'exam_tree_v2';
const LS_LEGACY_EXAM_LIST = 'exam_list';
const lsProgressKey = (path) => 'progress_' + path;

export function saveExamList(tree) {
  localStorage.setItem(LS_EXAM_LIST, JSON.stringify(tree));
}

export function getCachedExamList() {
  try {
    const stored = localStorage.getItem(LS_EXAM_LIST);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }

    // Compatibility with older versions that cached a flat list of exam names.
    const legacy = JSON.parse(localStorage.getItem(LS_LEGACY_EXAM_LIST)) || [];
    if (Array.isArray(legacy)) {
      return legacy
        .filter((name) => typeof name === 'string')
        .map((name) => ({ name, path: name, type: 'exam', children: [], legacy: true }));
    }
  } catch (error) {
    console.warn('Không đọc được thư viện đã lưu:', error);
  }
  return [];
}

export async function isDownloaded(path) {
  const { pdf, json } = examUrls(path);
  const cache = await caches.open(CACHE_EXAM);
  const [pdfResponse, jsonResponse] = await Promise.all([
    cache.match(pdf),
    cache.match(json),
  ]);
  return !!(pdfResponse && jsonResponse);
}

export async function downloadExam(path) {
  const { pdf, json } = examUrls(path);
  const [pdfResponse, jsonResponse] = await Promise.all([
    fetch(pdf, { cache: 'no-store' }),
    fetch(json, { cache: 'no-store' }),
  ]);

  if (!pdfResponse.ok) throw new Error('Không tải được PDF (' + pdfResponse.status + ')');
  if (!jsonResponse.ok) throw new Error('Không tải được answers.json (' + jsonResponse.status + ')');

  const cache = await caches.open(CACHE_EXAM);
  await cache.put(pdf, pdfResponse.clone());
  await cache.put(json, jsonResponse.clone());
}

export async function deleteExam(path) {
  const { pdf, json } = examUrls(path);
  const cache = await caches.open(CACHE_EXAM);
  await Promise.all([cache.delete(pdf), cache.delete(json)]);
  clearProgress(path);
}

export async function getAllDownloaded() {
  const cache = await caches.open(CACHE_EXAM);
  const requests = await cache.keys();
  const paths = new Set();
  const prefix = RAW_BASE + '/exam/';

  for (const request of requests) {
    if (!request.url.startsWith(prefix)) continue;

    try {
      const relative = decodeURIComponent(request.url.slice(prefix.length));
      const match = relative.match(/^(.*)\/(questions\.pdf|answers\.json)$/);
      if (match && match[1]) paths.add(match[1]);
    } catch (error) {
      console.warn('Bỏ qua cache có đường dẫn không hợp lệ:', request.url);
    }
  }

  return Array.from(paths);
}

export async function loadExamData(path) {
  const { pdf, json } = examUrls(path);
  const cache = await caches.open(CACHE_EXAM);
  let jsonResponse = await cache.match(json);
  let pdfResponse = await cache.match(pdf);

  if (!jsonResponse) {
    const response = await fetch(json, { cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được answers.json (' + response.status + ')');
    jsonResponse = response;
  }

  if (!pdfResponse) {
    const response = await fetch(pdf);
    if (!response.ok) throw new Error('Không tải được PDF (' + response.status + ')');
    pdfResponse = response;
  }

  const answers = await jsonResponse.json();
  const pdfBuffer = await pdfResponse.arrayBuffer();
  return { answers, pdfBuffer };
}

export function saveProgress(path, data) {
  localStorage.setItem(lsProgressKey(path), JSON.stringify(data));
}

export function loadProgress(path) {
  try {
    return JSON.parse(localStorage.getItem(lsProgressKey(path))) || null;
  } catch {
    return null;
  }
}

export function clearProgress(path) {
  localStorage.removeItem(lsProgressKey(path));
}
