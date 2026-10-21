import {
  isDownloaded, downloadExam, loadExamData,
  saveProgress, loadProgress, clearProgress
} from './store.js';

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const params = new URLSearchParams(location.search);
const examName = params.get('de');

const $title = document.getElementById('exam-title');
const $answerList = document.getElementById('answer-list');
const $submitBtn = document.getElementById('submit-btn');
const $prevQ = document.getElementById('prev-q');
const $nextQ = document.getElementById('next-q');
const $qIndex = document.getElementById('q-index');
const $net = document.getElementById('net-status');
const $loading = document.getElementById('loading-overlay');
const $loadingText = document.getElementById('loading-text');
const $result = document.getElementById('result-overlay');
const $reviewActions = document.getElementById('review-actions');
const $pdfContainer = document.getElementById('pdf-container');
const $pdfZoomWrap = document.getElementById('pdf-zoom-wrap');
const $pdfZoomContent = document.getElementById('pdf-zoom-content');

const state = {
  questions: [],
  answers: {},
  currentIndex: 0,
  totalCorrect: 0,
};

/**
 * Some mobile browsers/PWA shells restore their viewport and media-query state
 * only after returning from the background. Use both viewport width and the
 * mobile user-agent signal, then re-sync on app/page lifecycle events.
 */
function syncResponsiveLayout() {
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isNarrowViewport =
    window.innerWidth <= 900 ||
    window.screen.width <= 900 ||
    window.matchMedia('(max-width: 900px)').matches;

  document.body.classList.toggle('mobile-layout', isMobileUA || isNarrowViewport);
}

syncResponsiveLayout();
window.addEventListener('resize', syncResponsiveLayout, { passive: true });
window.addEventListener('orientationchange', syncResponsiveLayout, { passive: true });
window.addEventListener('pageshow', syncResponsiveLayout);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncResponsiveLayout();
});

function updateNetStatus() {
  const online = navigator.onLine;
  $net.classList.toggle('online', online);
  $net.classList.toggle('offline', !online);
  $net.querySelector('.label').textContent = online ? 'Trực tuyến' : 'Ngoại tuyến';
}
window.addEventListener('online', updateNetStatus);
window.addEventListener('offline', updateNetStatus);
updateNetStatus();

async function init() {
  if (!examName) { location.replace('./index.html'); return; }
  $title.textContent = examName;

  try {
    if (!(await isDownloaded(examName))) {
      if (!navigator.onLine) throw new Error('Đề chưa tải và đang không có mạng.');
      $loadingText.textContent = 'Đang tải đề về máy...';
      await downloadExam(examName);
    }

    $loadingText.textContent = 'Đang mở đề...';
    const { answers, pdfBuffer } = await loadExamData(examName);

    buildQuestions(answers);
    restoreProgress();
    render();

    $loadingText.textContent = 'Đang hiển thị đề...';
    await renderPdf(pdfBuffer);

    $loading.classList.add('hidden');
  } catch (err) {
    console.error(err);
    $loadingText.textContent = 'Lỗi: ' + err.message;
    $loading.querySelector('.spinner')?.remove();
    if (!$loading.querySelector('.btn')) {
      const back = document.createElement('a');
      back.href = './index.html';
      back.className = 'btn btn-primary';
      back.textContent = 'Về menu';
      $loading.appendChild(back);
    }
  }
}

async function renderPdf(pdfBuffer) {
  $pdfZoomContent.innerHTML = '<div class="pdf-loading">Đang hiển thị đề...</div>';
  try {
    if (!window.pdfjsLib) throw new Error('Thiếu pdf.js (chưa tải được từ CDN)');

    const task = window.pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await task.promise;
    $pdfZoomContent.innerHTML = '';
    $pdfZoomContent.style.width = `${getPdfViewportWidth()}px`;

    const renderScale = 2;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: renderScale });

      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.floor(viewport.width);
      pageCanvas.height = Math.floor(viewport.height);
      pageCanvas.className = 'pdf-page';

      wrapper.appendChild(pageCanvas);
      $pdfZoomContent.appendChild(wrapper);

      await page.render({
        canvasContext: pageCanvas.getContext('2d'),
        viewport,
      }).promise;
    }

    applyPdfZoom(1);
  } catch (err) {
    console.error('PDF render error:', err);
    $pdfZoomContent.innerHTML =
      '<div class="pdf-loading">Không hiển thị được PDF: ' + err.message + '</div>';
    applyPdfZoom(pdfZoomScale);
  }
}

function buildQuestions(answers) {
  const questions = [];
  const sections = [
    { key: 'abcd', title: 'Phần I: Trắc nghiệm nhiều lựa chọn' },
    { key: 'ds',   title: 'Phần II: Đúng / Sai' },
    { key: 'tln',  title: 'Phần III: Trả lời ngắn' },
  ];
  for (const sec of sections) {
    const data = answers[sec.key];
    if (!data || typeof data !== 'object') continue;
    const keys = Object.keys(data).sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    keys.forEach((k, idx) => {
      questions.push({
        id: `${sec.key}-${k}`,
        type: sec.key,
        sectionTitle: sec.title,
        numberInSection: k,
        correct: String(data[k]),
        isFirstInSection: idx === 0,
      });
    });
  }
  state.questions = questions;
}

function restoreProgress() {
  const saved = loadProgress(examName);
  state.answers = (saved && saved.answers) ? saved.answers : {};
  state.currentIndex = 0;
  document.body.classList.remove('mode-review');
  $reviewActions.style.display = '';
}

function persist() { saveProgress(examName, { answers: state.answers }); }

function render() {
  $answerList.innerHTML = '';
  state.questions.forEach((q, i) => {
    if (q.isFirstInSection) {
      const h = document.createElement('div');
      h.className = 'section-header';
      h.textContent = q.sectionTitle;
      $answerList.appendChild(h);
    }
    const block = document.createElement('div');
    block.className = 'question-block';
    block.dataset.index = i;
    if (i === state.currentIndex) block.classList.add('current');

    const label = document.createElement('div');
    label.className = 'question-label';
    label.textContent = `Câu ${q.numberInSection}`;
    const tag = document.createElement('span');
    tag.className = 'section-tag';
    tag.textContent = q.sectionTitle;
    label.appendChild(tag);
    block.appendChild(label);

    if (q.type === 'abcd') block.appendChild(renderABCD(q));
    else if (q.type === 'ds') block.appendChild(renderDS(q));
    else if (q.type === 'tln') block.appendChild(renderTLN(q));

    $answerList.appendChild(block);
  });
  updateMobileNav();
}

function renderABCD(q) {
  const wrap = document.createElement('div');
  wrap.className = 'options abcd-options';
  ['a','b','c','d'].forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn';
    btn.dataset.value = opt;
    btn.textContent = opt.toUpperCase();
    if (state.answers[q.id] === opt) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      if (document.body.classList.contains('mode-review')) return;
      if (state.answers[q.id] === opt) delete state.answers[q.id];
      else state.answers[q.id] = opt;
      persist();
      wrap.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      if (state.answers[q.id]) {
        wrap.querySelector(`[data-value="${state.answers[q.id]}"]`).classList.add('selected');
      }
    });
    wrap.appendChild(btn);
  });
  return wrap;
}

function renderDS(q) {
  const wrap = document.createElement('div');
  wrap.className = 'options ds-options';
  const cur = (state.answers[q.id] || 'nnnn').padEnd(4, 'n').slice(0, 4);
  const chars = cur.split('');
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn ds-btn';
    btn.dataset.state = chars[i];
    btn.textContent = charLabel(chars[i]);
    btn.addEventListener('click', () => {
      if (document.body.classList.contains('mode-review')) return;
      let current = (state.answers[q.id] || 'nnnn').padEnd(4, 'n').slice(0, 4).split('');
      const nextMap = { n: 'd', d: 's', s: 'n' };
      current[i] = nextMap[current[i]] || 'n';
      state.answers[q.id] = current.join('');
      persist();
      btn.dataset.state = current[i];
      btn.textContent = charLabel(current[i]);
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

function charLabel(c) {
  if (c === 'd') return 'Đ';
  if (c === 's') return 'S';
  return 'N';
}

function renderTLN(q) {
  const wrap = document.createElement('div');
  wrap.className = 'tln-inputs';
  const current = (state.answers[q.id] || '').padEnd(4, ' ').slice(0, 4);
  const inputs = [];

  for (let i = 0; i < 4; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.inputMode = 'text';
    inp.className = 'tln-box';
    inp.value = current[i].trim();
    inp.dataset.idx = i;

    inp.addEventListener('input', () => {
      if (document.body.classList.contains('mode-review')) { inp.value = ''; return; }
      let v = inp.value.slice(-1);
      if (!v) { inp.value = ''; syncTLN(); return; }
      if (!/^[0-9,-]$/.test(v)) { inp.value = ''; return; }
      if (v === '-') {
        if (i !== 0) { inp.value = ''; return; }
        const others = inputs.map((el, j) => j === i ? '' : el.value).join('');
        if (others.includes('-')) { inp.value = ''; return; }
      }
      if (v === ',') {
        if (i !== 1 && i !== 2) { inp.value = ''; return; }
        const others = inputs.map((el, j) => j === i ? '' : el.value).join('');
        if (others.includes(',')) { inp.value = ''; return; }
      }
      inp.value = v;
      syncTLN();
      if (v && i < 3) inputs[i + 1].focus();
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) {
        e.preventDefault();
        inputs[i - 1].focus();
        inputs[i - 1].value = '';
        syncTLN();
      } else if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
      else if (e.key === 'ArrowRight' && i < 3) inputs[i + 1].focus();
    });

    inputs.push(inp);
    wrap.appendChild(inp);
  }

  function syncTLN() {
    let val = '';
    for (let i = 0; i < 4; i++) {
      const c = inputs[i].value.trim();
      if (!c) break;
      val += c;
    }
    if (val) state.answers[q.id] = val;
    else delete state.answers[q.id];
    persist();
  }
  return wrap;
}

function updateMobileNav() {
  $qIndex.textContent = `${state.currentIndex + 1} / ${state.questions.length || 1}`;
  $prevQ.disabled = state.currentIndex === 0;
  $nextQ.disabled = state.currentIndex >= state.questions.length - 1;
}

function setCurrent(idx) {
  if (idx < 0 || idx >= state.questions.length) return;
  state.currentIndex = idx;
  $answerList.querySelectorAll('.question-block.current').forEach(el => el.classList.remove('current'));
  const cur = $answerList.querySelector(`[data-index="${idx}"]`);
  if (cur) {
    cur.classList.add('current');
    cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  updateMobileNav();
}
$prevQ.addEventListener('click', () => setCurrent(state.currentIndex - 1));
$nextQ.addEventListener('click', () => setCurrent(state.currentIndex + 1));

$submitBtn.addEventListener('click', () => {
  if (state.questions.length === 0) return;
  const unanswered = state.questions.filter(q => !state.answers[q.id]).length;
  if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;

  let correct = 0;
  for (const q of state.questions) {
    if (state.answers[q.id] === q.correct) correct++;
  }
  state.totalCorrect = correct;
  const total = state.questions.length;
  const pct = total ? correct / total : 0;
  let cls = 'result-red';
  if (pct >= 0.8) cls = 'result-green';
  else if (pct >= 0.5) cls = 'result-yellow';

  const scoreEl = document.getElementById('result-score');
  scoreEl.textContent = `${correct} / ${total}`;
  scoreEl.className = 'result-score ' + cls;
  document.getElementById('result-detail').textContent =
    `Đúng ${correct} trên ${total} câu (${Math.round(pct * 100)}%)`;
  $result.classList.remove('hidden');
});

document.getElementById('result-review-btn').addEventListener('click', () => {
  $result.classList.add('hidden');
  enterReview();
});

document.querySelectorAll('.retry-action').forEach(btn => {
  btn.addEventListener('click', retry);
});

function retry() {
  clearProgress(examName);
  state.answers = {};
  state.currentIndex = 0;
  state.totalCorrect = 0;
  document.body.classList.remove('mode-review');
  $result.classList.add('hidden');
  $submitBtn.style.display = '';
  $reviewActions.style.display = '';
  render();
}

function enterReview() {
  document.body.classList.add('mode-review');
  $submitBtn.style.display = 'none';
  $reviewActions.style.display = 'flex';

  $answerList.innerHTML = '';
  state.questions.forEach((q) => {
    const block = document.createElement('div');
    block.className = 'question-block current';
    const label = document.createElement('div');
    label.className = 'question-label';
    label.textContent = `Câu ${q.numberInSection}`;
    block.appendChild(label);

    const userAns = state.answers[q.id];
    const isCorrect = userAns === q.correct;
    if (q.type === 'abcd') block.appendChild(reviewABCD(q, userAns));
    else if (q.type === 'ds') block.appendChild(reviewDS(q, userAns));
    else block.appendChild(reviewTLN(q, userAns, isCorrect));

    $answerList.appendChild(block);
  });
}

function reviewABCD(q, userAns) {
  const wrap = document.createElement('div');
  wrap.className = 'options abcd-options';
  if (!userAns) {
    const note = document.createElement('div');
    note.className = 'review-note';
    note.textContent = 'Chưa làm';
    wrap.appendChild(note);
  }
  ['a','b','c','d'].forEach(opt => {
    const el = document.createElement('div');
    el.className = 'option-btn';
    el.textContent = opt.toUpperCase();
    if (opt === q.correct) el.classList.add('correct');
    else if (opt === userAns) el.classList.add('incorrect');
    wrap.appendChild(el);
  });
  return wrap;
}

function reviewDS(q, userAns) {
  const wrap = document.createElement('div');
  wrap.className = 'options ds-options';
  const correctChars = q.correct.padEnd(4, 'n').slice(0, 4).split('');
  const userChars = (userAns || 'nnnn').padEnd(4, 'n').slice(0, 4).split('');

  if (!userAns || userAns === 'nnnn') {
    const note = document.createElement('div');
    note.className = 'review-note';
    note.textContent = 'Chưa làm';
    wrap.appendChild(note);
  }
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'option-btn ds-btn';
    const uc = userChars[i], cc = correctChars[i];
    if (uc === cc && uc !== 'n') {
      el.textContent = charLabel(uc);
      el.classList.add('correct');
    } else if (uc === 'n') {
      el.textContent = 'N';
      el.classList.add('unanswered');
      const cm = document.createElement('span');
      cm.className = 'correct-marker';
      cm.textContent = charLabel(cc);
      el.appendChild(cm);
    } else {
      el.textContent = charLabel(uc);
      el.classList.add('incorrect');
      const cm = document.createElement('span');
      cm.className = 'correct-marker';
      cm.textContent = charLabel(cc);
      el.appendChild(cm);
    }
    wrap.appendChild(el);
  }
  return wrap;
}

function reviewTLN(q, userAns, isCorrect) {
  const wrap = document.createElement('div');
  wrap.className = 'tln-review';
  if (!userAns) {
    const note = document.createElement('div');
    note.className = 'review-note';
    note.textContent = 'Chưa làm';
    wrap.appendChild(note);
    const right = document.createElement('div');
    right.className = 'tln-value correct';
    right.textContent = q.correct;
    wrap.appendChild(right);
  } else if (isCorrect) {
    const el = document.createElement('div');
    el.className = 'tln-value correct';
    el.textContent = userAns;
    wrap.appendChild(el);
  } else {
    const wrong = document.createElement('div');
    wrong.className = 'tln-value incorrect';
    wrong.textContent = userAns;
    wrap.appendChild(wrong);
    const right = document.createElement('div');
    right.className = 'tln-value correct';
    right.textContent = q.correct;
    wrap.appendChild(right);
  }
  return wrap;
}

// ========== PDF ZOOM ==========
let pdfZoomScale = 1;
const pdfPaneEl = document.querySelector('.pdf-pane');
const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 6;

function getPdfViewportWidth() {
  const style = getComputedStyle($pdfContainer);
  const horizontalPadding =
    (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return Math.max(1, $pdfContainer.clientWidth - horizontalPadding);
}

function applyPdfZoom(scale) {
  pdfZoomScale = Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, scale));

  if ($pdfZoomWrap && $pdfZoomContent) {
    const baseWidth = $pdfZoomContent.offsetWidth || getPdfViewportWidth();
    const baseHeight = $pdfZoomContent.scrollHeight;
    $pdfZoomContent.style.transform = `scale(${pdfZoomScale})`;

    // CSS transforms do not expand the scrolling layout, so size the outer
    // wrapper explicitly to the scaled document dimensions.
    $pdfZoomWrap.style.width = `${Math.ceil(baseWidth * pdfZoomScale)}px`;
    $pdfZoomWrap.style.height = `${Math.ceil(baseHeight * pdfZoomScale)}px`;
  }

  const label = document.getElementById('zoom-label');
  if (label) label.textContent = Math.round(pdfZoomScale * 100) + '%';
}


// Desktop: hold the left mouse button and drag to pan around the PDF.
if ($pdfContainer) {
  let panStart = null;

  $pdfContainer.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    panStart = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      scrollLeft: $pdfContainer.scrollLeft,
      scrollTop: $pdfContainer.scrollTop,
    };
    $pdfContainer.classList.add('is-panning');
    e.preventDefault();
    try { $pdfContainer.setPointerCapture(e.pointerId); } catch (_) {}
  });

  $pdfContainer.addEventListener('pointermove', (e) => {
    if (!panStart || e.pointerId !== panStart.pointerId) return;
    $pdfContainer.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
    $pdfContainer.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
    e.preventDefault();
  });

  const endMousePan = (e) => {
    if (!panStart || (e && e.pointerId !== panStart.pointerId)) return;
    const pointerId = panStart.pointerId;
    panStart = null;
    $pdfContainer.classList.remove('is-panning');
    try {
      if ($pdfContainer.hasPointerCapture(pointerId)) {
        $pdfContainer.releasePointerCapture(pointerId);
      }
    } catch (_) {}
  };

  $pdfContainer.addEventListener('pointerup', endMousePan);
  $pdfContainer.addEventListener('pointercancel', endMousePan);
  $pdfContainer.addEventListener('lostpointercapture', endMousePan);
}

// Re-fit the unscaled page width to the available pane width after resizing.
if (window.ResizeObserver) {
  const pdfResizeObserver = new ResizeObserver(() => {
    if (!$pdfZoomContent || !$pdfZoomContent.children.length) return;
    $pdfZoomContent.style.width = `${getPdfViewportWidth()}px`;
    applyPdfZoom(pdfZoomScale);
  });
  pdfResizeObserver.observe($pdfContainer);
}

// Desktop: Ctrl/Cmd + mouse wheel zooms only while the pointer is over the PDF pane.
window.addEventListener('wheel', (e) => {
  if (!e.target.closest('.pdf-pane') || (!e.ctrlKey && !e.metaKey)) return;
  e.preventDefault();
  applyPdfZoom(pdfZoomScale + (e.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

// Mobile: pinch-to-zoom in the PDF pane.
if (pdfPaneEl) {
  let startDist = 0;
  let startScale = 1;

  pdfPaneEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    startDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    startScale = pdfZoomScale;
  }, { passive: true });

  pdfPaneEl.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || startDist <= 0) return;
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    applyPdfZoom(startScale * (dist / startDist));
  }, { passive: false });

  const resetPinch = () => { startDist = 0; };
  pdfPaneEl.addEventListener('touchend', resetPinch, { passive: true });
  pdfPaneEl.addEventListener('touchcancel', resetPinch, { passive: true });
}

document.getElementById('zoom-in').addEventListener('click', () => applyPdfZoom(pdfZoomScale + 0.2));
document.getElementById('zoom-out').addEventListener('click', () => applyPdfZoom(pdfZoomScale - 0.2));
document.getElementById('zoom-reset').addEventListener('click', () => applyPdfZoom(1));

// --- Chặn pinch/double-tap zoom ngoài PDF (mobile) ---
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 && !e.target.closest('.pdf-pane')) {
    e.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('.pdf-pane')) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

init();