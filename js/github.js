export const GH_OWNER = 'BaoBao-creator';
export const GH_REPO = 'on-tap';
export const GH_BRANCH = 'main';

const API_BASE = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO;
export const RAW_BASE = 'https://raw.githubusercontent.com/' + GH_OWNER + '/' + GH_REPO + '/' + GH_BRANCH;

const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

function sortItems(items) {
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
}

/**
 * Build the visible library from the repository tree.
 * A directory is an exam only when its two direct entries are exactly
 * answers.json and questions.pdf. Any extra file or subdirectory makes it a folder.
 */
function buildExamTree(entries) {
  const root = { name: '', path: '', kind: 'folder', children: new Map() };

  for (const entry of entries) {
    if (typeof entry.path !== 'string' || !entry.path.startsWith('exam/')) continue;
    const relativePath = entry.path.slice('exam/'.length);
    if (!relativePath) continue;

    const parts = relativePath.split('/');
    let parent = root;
    let path = '';

    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i];
      path = path ? path + '/' + name : name;
      const isLast = i === parts.length - 1;
      const isDirectory = !isLast || entry.type === 'tree';

      let node = parent.children.get(name);
      if (!node) {
        node = {
          name,
          path,
          kind: isDirectory ? 'folder' : 'file',
          children: isDirectory ? new Map() : null,
        };
      }

      if (isDirectory) {
        if (node.kind !== 'folder') {
          node.kind = 'folder';
          node.children = node.children || new Map();
        }
      } else {
        node.kind = 'file';
        node.children = null;
      }

      parent.children.set(name, node);
      if (isDirectory) parent = node;
    }
  }

  function classify(node) {
    const entriesInside = Array.from((node.children || new Map()).values());
    const isExam =
      entriesInside.length === 2 &&
      entriesInside.every((child) => child.kind === 'file') &&
      entriesInside.some((child) => child.name === 'answers.json') &&
      entriesInside.some((child) => child.name === 'questions.pdf');

    if (isExam) {
      return { name: node.name, path: node.path, type: 'exam', children: [] };
    }

    const children = entriesInside
      .filter((child) => child.kind === 'folder')
      .map(classify);

    return {
      name: node.name,
      path: node.path,
      type: 'folder',
      children: sortItems(children),
    };
  }

  return sortItems(
    Array.from(root.children.values())
      .filter((node) => node.kind === 'folder')
      .map(classify)
  );
}

export async function listExams() {
  const res = await fetch(API_BASE + '/git/trees/' + GH_BRANCH + '?recursive=1', {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Lỗi tải thư viện (' + res.status + ')');

  const data = await res.json();
  if (!Array.isArray(data.tree)) throw new Error('GitHub trả về danh sách thư mục không hợp lệ');
  if (data.truncated) {
    throw new Error('Thư viện quá lớn để đọc đầy đủ trong một lần. Hãy kiểm tra giới hạn GitHub API.');
  }

  return buildExamTree(data.tree);
}

function encodeRepositoryPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function examUrls(path) {
  const encodedPath = encodeRepositoryPath(path);
  if (!encodedPath) throw new Error('Đường dẫn đề thi không hợp lệ');
  const base = RAW_BASE + '/exam/' + encodedPath;
  return {
    pdf: base + '/questions.pdf',
    json: base + '/answers.json',
  };
}
