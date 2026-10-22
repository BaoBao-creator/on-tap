import { listExams } from './github.js';
import {
  saveExamList, getCachedExamList, isDownloaded,
  downloadExam, deleteExam, getAllDownloaded
} from './store.js';

const $list = document.getElementById('exam-list');
const $msg = document.getElementById('menu-message');
const $net = document.getElementById('net-status');

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
  let exams = [];
  const online = navigator.onLine;

  if (online) {
    try {
      $msg.textContent = 'Đang tải danh sách đề...';
      exams = await listExams();
      saveExamList(exams);
      $msg.textContent = '';

      // dọn đề đã bị xóa khỏi GitHub
      const downloaded = await getAllDownloaded();
      const current = new Set(exams);
      for (const old of downloaded) {
        if (!current.has(old)) {
          await deleteExam(old);
        }
      }
    } catch (err) {
      console.error(err);
      exams = getCachedExamList();
      $msg.textContent = 'Không kết nối được GitHub. Đang dùng danh sách đã lưu.';
    }
  } else {
    exams = getCachedExamList();
    $msg.textContent = 'Bạn đang ngoại tuyến. Chỉ có thể làm các đề đã tải.';
  }

  await renderList(exams);
}

async function renderList(exams) {
  $list.innerHTML = '';
  if (exams.length === 0) {
    $list.innerHTML = '<li class="empty">Chưa có đề nào.</li>';
    return;
  }

  const online = navigator.onLine;

  for (const name of exams) {
    const li = document.createElement('li');
    li.className = 'exam-item';

    const nameEl = document.createElement('a');
    nameEl.className = 'exam-name';
    nameEl.href = `./exam.html?de=${encodeURIComponent(name)}`;
    nameEl.textContent = name;

    const actions = document.createElement('div');
    actions.className = 'exam-actions';

    const downloaded = await isDownloaded(name);
    const status = document.createElement('span');
    status.className = 'exam-status';

    if (downloaded) {
      status.textContent = 'Đã tải';
      status.title = 'Có thể mở đề khi không có mạng';
    } else if (!online) {
      nameEl.href = '#';
      nameEl.classList.add('exam-name-disabled');
      nameEl.setAttribute('aria-disabled', 'true');
      nameEl.title = 'Cần có mạng để tải đề này';
      nameEl.addEventListener('click', (e) => e.preventDefault());
      status.textContent = 'Chưa tải';
      status.title = 'Kết nối mạng rồi tải đề để làm ngoại tuyến';
      status.classList.add('unavailable');
    }

    if (downloaded) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = 'Xóa';
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm(`Xóa "${name}" khỏi bộ nhớ ngoại tuyến?`)) return;
        await deleteExam(name);
        init();
      });
      actions.appendChild(delBtn);
    } else {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-primary';
      dlBtn.textContent = 'Tải';
      if (!online) dlBtn.disabled = true;
      dlBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dlBtn.disabled = true;
        dlBtn.textContent = 'Đang tải...';
        try {
          await downloadExam(name);
          renderList(exams);
        } catch (err) {
          alert('Lỗi tải đề: ' + err.message);
          dlBtn.disabled = false;
          dlBtn.textContent = 'Tải';
        }
      });
      actions.appendChild(dlBtn);
    }

    li.appendChild(nameEl);
    if (status.textContent) li.appendChild(status);
    li.appendChild(actions);
    $list.appendChild(li);
  }
}

init();
