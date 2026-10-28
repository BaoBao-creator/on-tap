import { listExams } from './github.js';
import {
  saveExamList, getCachedExamList, isDownloaded,
  downloadExam, deleteExam, getAllDownloaded
} from './store.js';

const $list = document.getElementById('exam-list');
const $msg = document.getElementById('menu-message');
const $net = document.getElementById('net-status');
const $folderTitle = document.getElementById('folder-title');
const $folderDescription = document.getElementById('folder-description');
const $breadcrumbs = document.getElementById('breadcrumbs');
const $search = document.getElementById('folder-search');
const $itemCount = document.getElementById('folder-item-count');

let library = [];
let currentPath = new URLSearchParams(location.search).get('path') || '';
let renderVersion = 0;

const ICONS = {
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7A2 2 0 0 1 20.5 9.5v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"></path><path d="M3.5 9h17"></path></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"></path><path d="M14 3.5v4h4M8.5 12h7M8.5 15.5h7"></path></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10.5 8.5-7 8.5 7"></path><path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6"></path></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"></path></svg>'
};

function makeIcon(name, className) {
  const icon = document.createElement('span');
  icon.className = className || 'ui-icon';
  icon.innerHTML = ICONS[name] || ICONS.file;
  return icon;
}

function updateNetStatus() {
  const online = navigator.onLine;
  $net.classList.toggle('online', online);
  $net.classList.toggle('offline', !online);
  $net.querySelector('.label').textContent = online ? 'Trực tuyến' : 'Ngoại tuyến';
}

function setMessage(message, type) {
  $msg.textContent = message || '';
  $msg.className = 'message';
  if (!message) {
    $msg.classList.add('hidden');
    return;
  }
  $msg.classList.add('message-' + (type || 'info'));
}

function findFolder(tree, path) {
  if (!path) return { name: '', path: '', type: 'folder', children: tree };
  const segments = path.split('/').filter(Boolean);
  let children = tree;
  let current = null;

  for (const segment of segments) {
    current = children.find((item) => item.name === segment && item.type === 'folder');
    if (!current) return null;
    children = current.children || [];
  }
  return current;
}

function collectExamPaths(items, output) {
  for (const item of items || []) {
    if (item.type === 'exam') output.push(item.path);
    else collectExamPaths(item.children, output);
  }
  return output;
}

function countContents(folder) {
  let folders = 0;
  let exams = 0;
  for (const item of folder.children || []) {
    if (item.type === 'exam') {
      exams += 1;
    } else {
      folders += 1;
      const nested = countContents(item);
      folders += nested.folders;
      exams += nested.exams;
    }
  }
  return { folders, exams };
}

function renderBreadcrumbs() {
  $breadcrumbs.replaceChildren();
  const crumbs = [{ name: 'Thư viện', path: '' }];
  let accumulated = '';

  for (const segment of currentPath.split('/').filter(Boolean)) {
    accumulated = accumulated ? accumulated + '/' + segment : segment;
    crumbs.push({ name: segment, path: accumulated });
  }

  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.setAttribute('aria-hidden', 'true');
      separator.innerHTML = ICONS.chevron;
      $breadcrumbs.appendChild(separator);
    }

    const isCurrent = index === crumbs.length - 1;
    const element = document.createElement(isCurrent ? 'span' : 'button');
    element.className = isCurrent ? 'breadcrumb-current' : 'breadcrumb-link';
    if (element.tagName === 'BUTTON') {
      element.type = 'button';
      element.addEventListener('click', () => navigateTo(crumb.path));
    }
    if (index === 0) element.prepend(makeIcon('home', 'breadcrumb-home'));
    const label = document.createElement('span');
    label.textContent = crumb.name;
    element.appendChild(label);
    if (isCurrent) element.setAttribute('aria-current', 'page');
    $breadcrumbs.appendChild(element);
  });
}

function navigateTo(path, updateHistory) {
  const target = path || '';
  if (target && !findFolder(library, target)) return;

  currentPath = target;
  if ($search) $search.value = '';

  if (updateHistory !== false) {
    const url = currentPath ? '?path=' + encodeURIComponent(currentPath) : location.pathname;
    history.pushState({ path: currentPath }, '', url);
  }
  renderCurrentFolder();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderEmptyState(message) {
  const item = document.createElement('li');
  item.className = 'empty-state';

  const icon = makeIcon('folder', 'empty-state-icon');
  const title = document.createElement('strong');
  title.textContent = message;
  const detail = document.createElement('span');
  detail.textContent = 'Các thư mục và đề thi sẽ xuất hiện ở đây.';
  item.append(icon, title, detail);
  $list.appendChild(item);
}

function renderEntry(item, downloaded, online) {
  const li = document.createElement('li');
  li.className = 'exam-item entry-item entry-' + item.type;

  const isFolder = item.type === 'folder';
  const main = document.createElement(isFolder ? 'button' : 'a');
  main.className = 'entry-main';
  if (isFolder) {
    main.type = 'button';
    main.addEventListener('click', () => navigateTo(item.path));
  } else {
    main.href = './exam.html?de=' + encodeURIComponent(item.path) + '&from=' + encodeURIComponent(currentPath);
    if (!downloaded && !online) {
      main.href = '#';
      main.classList.add('entry-main-disabled');
      main.setAttribute('aria-disabled', 'true');
      main.title = 'Đề này chưa được tải để làm ngoại tuyến';
      main.addEventListener('click', (event) => event.preventDefault());
    }
  }

  main.appendChild(makeIcon(isFolder ? 'folder' : 'file', 'entry-icon ' + (isFolder ? 'folder-icon' : 'exam-icon')));

  const copy = document.createElement('span');
  copy.className = 'entry-copy';
  const title = document.createElement('span');
  title.className = 'entry-title';
  title.textContent = item.name;
  const subtitle = document.createElement('span');
  subtitle.className = 'entry-subtitle';

  if (isFolder) {
    const counts = countContents(item);
    if (counts.exams || counts.folders) {
      subtitle.textContent = counts.folders + ' thư mục · ' + counts.exams + ' đề';
    } else {
      subtitle.textContent = 'Thư mục phân loại';
    }
  } else {
    subtitle.textContent = 'PDF · Đáp án';
  }

  copy.append(title, subtitle);
  main.appendChild(copy);
  li.appendChild(main);

  const side = document.createElement('div');
  side.className = 'entry-trailing';

  if (isFolder) {
    side.appendChild(makeIcon('chevron', 'entry-chevron'));
  } else {
    const status = document.createElement('span');
    status.className = 'entry-status';
    status.textContent = downloaded ? 'Đã tải' : 'Chưa tải';
    status.classList.add(downloaded ? 'status-downloaded' : (online ? 'status-pending' : 'status-unavailable'));
    side.appendChild(status);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'entry-action ' + (downloaded ? 'entry-action-remove' : 'entry-action-download');
    action.textContent = downloaded ? 'Gỡ' : 'Tải';
    action.title = downloaded ? 'Gỡ bản tải ngoại tuyến' : 'Tải đề để làm ngoại tuyến';
    action.disabled = !downloaded && !online;

    action.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (downloaded) {
        if (!confirm('Gỡ "' + item.name + '" khỏi bộ nhớ ngoại tuyến? Tiến độ làm bài của đề này cũng sẽ bị xóa.')) return;
        action.disabled = true;
        action.textContent = 'Đang gỡ…';
        try {
          await deleteExam(item.path);
          setMessage('Đã gỡ bản tải của "' + item.name + '".', 'success');
          await renderCurrentFolder();
        } catch (error) {
          setMessage('Không gỡ được bản tải: ' + error.message, 'error');
          await renderCurrentFolder();
        }
      } else {
        action.disabled = true;
        action.textContent = 'Đang tải…';
        try {
          await downloadExam(item.path);
          setMessage('Đã tải "' + item.name + '" để có thể làm ngoại tuyến.', 'success');
          await renderCurrentFolder();
        } catch (error) {
          setMessage('Không tải được "' + item.name + '": ' + error.message, 'error');
          await renderCurrentFolder();
        }
      }
    });

    side.appendChild(action);
  }

  li.appendChild(side);
  return li;
}

async function renderList(items) {
  const version = ++renderVersion;
  $list.replaceChildren();

  const query = ($search.value || '').trim().toLocaleLowerCase('vi');
  const filtered = (items || []).filter((item) => item.name.toLocaleLowerCase('vi').includes(query));

  if (!filtered.length) {
    renderEmptyState(query ? 'Không tìm thấy mục phù hợp.' : 'Thư mục này chưa có đề thi hoặc thư mục con.');
    return;
  }

  const online = navigator.onLine;
  const decorated = await Promise.all(filtered.map(async (item) => ({
    item,
    downloaded: item.type === 'exam' ? await isDownloaded(item.path).catch(() => false) : false,
  })));

  if (version !== renderVersion) return;
  for (const entry of decorated) {
    $list.appendChild(renderEntry(entry.item, entry.downloaded, online));
  }
}

async function renderCurrentFolder() {
  const folder = findFolder(library, currentPath);
  if (!folder) {
    currentPath = '';
    history.replaceState({ path: '' }, '', location.pathname);
    return renderCurrentFolder();
  }

  $folderTitle.textContent = folder.path ? folder.name : 'Tất cả đề thi';
  $folderDescription.textContent = folder.path
    ? 'Đang xem nội dung trong thư mục này.'
    : 'Duyệt theo thư mục hoặc mở một đề để bắt đầu làm bài.';
  renderBreadcrumbs();

  const children = folder.children || [];
  $itemCount.textContent = children.length + (children.length === 1 ? ' mục' : ' mục');
  await renderList(children);
}

async function init() {
  updateNetStatus();

  if (navigator.onLine) {
    try {
      setMessage('Đang cập nhật thư viện…', 'info');
      const latest = await listExams();
      library = latest;
      saveExamList(library);
      setMessage('', 'info');

      // Remove downloaded exams that were deleted, moved, or no longer satisfy
      // the exact two-file exam rule.
      const activePaths = new Set(collectExamPaths(library, []));
      const downloadedPaths = await getAllDownloaded();
      for (const oldPath of downloadedPaths) {
        if (!activePaths.has(oldPath)) await deleteExam(oldPath);
      }
    } catch (error) {
      console.error(error);
      library = getCachedExamList();
      if (library.length) {
        setMessage('Không cập nhật được thư viện. Đang hiển thị danh sách đã lưu.', 'warning');
      } else {
        setMessage('Không tải được thư viện. Hãy kiểm tra kết nối mạng rồi thử lại.', 'error');
      }
    }
  } else {
    library = getCachedExamList();
    setMessage(
      library.length
        ? 'Bạn đang ngoại tuyến. Chỉ những đề đã tải mới có thể mở.'
        : 'Chưa có thư viện được lưu trên thiết bị. Hãy kết nối mạng một lần để tải danh sách.',
      'warning'
    );
  }

  const requestedPath = new URLSearchParams(location.search).get('path') || '';
  if (requestedPath && findFolder(library, requestedPath)) currentPath = requestedPath;
  else currentPath = '';
  await renderCurrentFolder();
}

$search.addEventListener('input', () => {
  const folder = findFolder(library, currentPath);
  renderList(folder ? folder.children || [] : []);
});

$search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $search.value) {
    $search.value = '';
    const folder = findFolder(library, currentPath);
    renderList(folder ? folder.children || [] : []);
  }
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    $search.focus();
  }
});

window.addEventListener('popstate', () => {
  currentPath = new URLSearchParams(location.search).get('path') || '';
  renderCurrentFolder();
});

window.addEventListener('online', () => {
  updateNetStatus();
  init();
});

window.addEventListener('offline', () => {
  updateNetStatus();
  setMessage('Bạn đang ngoại tuyến. Chỉ những đề đã tải mới có thể mở.', 'warning');
  renderCurrentFolder();
});

updateNetStatus();
init();
