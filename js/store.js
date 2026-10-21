import { examUrls, RAW_BASE } from './github.js';

const CACHE_EXAM = 'exam-cache';
const LS_EXAM_LIST = 'exam_list';
const lsProgressKey = (name) => `progress_${name}`;

// ------- danh sách đề (cache) -------
export function saveExamList(list) {
  localStorage.setItem(LS_EXAM_LIST, JSON.stringify(list));
}
export function getCachedExamList() {
  try { return JSON.parse(localStorage.getItem(LS_EXAM_LIST)) || []; }
  catch { return []; }
}

// ------- download / cache -------
export async function isDownloaded(name) {
  const { pdf, json } = examUrls(name);
  const cache = await caches.open(CACHE_EXAM);
  const [p, j] = await Promise.all([cache.match(pdf), cache.match(json)]);
  return !!(p && j);
}

export async function downloadExam(name) {
  const { pdf, json } = examUrls(name);
  const [pdfRes, jsonRes] = await Promise.all([
    fetch(pdf, { cache: 'no-store' }),
    fetch(json, { cache: 'no-store' }),
  ]);
  if (!pdfRes.ok) throw new Error('Không tải được PDF (' + pdfRes.status + ')');
  if (!jsonRes.ok) throw new Error('Không tải được answers.json (' + jsonRes.status + ')');
  const cache = await caches.open(CACHE_EXAM);
  await cache.put(pdf, pdfRes);
  await cache.put(json, jsonRes);
}

export async function deleteExam(name) {
  const { pdf, json } = examUrls(name);
  const cache = await caches.open(CACHE_EXAM);
  await cache.delete(pdf);
  await cache.delete(json);
  clearProgress(name);
}

export async function getAllDownloaded() {
  const cache = await caches.open(CACHE_EXAM);
  const keys = await cache.keys();
  const names = new Set();
  const prefix = `${RAW_BASE}/exam/`;
  for (const req of keys) {
    if (req.url.startsWith(prefix)) {
      const rest = req.url.slice(prefix.length);
      const name = decodeURIComponent(rest.split('/')[0]);
      if (name) names.add(name);
    }
  }
  return [...names];
}

// ------- load exam data -------
export async function loadExamData(name) {
  const { pdf, json } = examUrls(name);
  const cache = await caches.open(CACHE_EXAM);
  let jsonRes = await cache.match(json);
  let pdfRes = await cache.match(pdf);
  if (!jsonRes) {
    const net = await fetch(json, { cache: 'no-store' });
    if (!net.ok) throw new Error('Không tải được answers.json');
    jsonRes = net;
  }
  if (!pdfRes) {
    const net = await fetch(pdf);
    if (!net.ok) throw new Error('Không tải được PDF');
    pdfRes = net;
  }
  const answers = await jsonRes.json();
  const pdfBlob = await pdfRes.blob();
  const pdfUrl = URL.createObjectURL(pdfBlob);
  return { answers, pdfUrl };
}

// ------- progress -------
export function saveProgress(name, data) {
  localStorage.setItem(lsProgressKey(name), JSON.stringify(data));
}
export function loadProgress(name) {
  try { return JSON.parse(localStorage.getItem(lsProgressKey(name))) || null; }
  catch { return null; }
}
export function clearProgress(name) {
  localStorage.removeItem(lsProgressKey(name));
}
