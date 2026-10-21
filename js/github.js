export const GH_OWNER = 'BaoBao-creator';
export const GH_REPO = 'on-tap';
export const GH_BRANCH = 'main';

const API_BASE = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
export const RAW_BASE = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}`;

export async function listExams() {
  const res = await fetch(`${API_BASE}/contents/exam?ref=${GH_BRANCH}`, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`Lỗi tải danh sách (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Phản hồi không hợp lệ');
  return data.filter(item => item.type === 'dir').map(item => item.name).sort();
}

export function examUrls(name) {
  const enc = encodeURIComponent(name);
  return {
    pdf: `${RAW_BASE}/exam/${enc}/questions.pdf`,
    json: `${RAW_BASE}/exam/${enc}/answers.json`,
  };
}
