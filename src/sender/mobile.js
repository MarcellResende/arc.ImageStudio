const filesElement = document.querySelector('#files');
const countElement = document.querySelector('#count');
const statusElement = document.querySelector('#status');
const loadMoreElement = document.querySelector('#load-more');
const downloadAllElement = document.querySelector('#download-all');
const token = new URLSearchParams(location.search).get('token') || '';
let nextOffset = 0;
let totalFiles = 0;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString('pt-BR', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function renderFile(file) {
  const row = document.createElement('article');
  row.className = 'file';
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = '↗';
  const copy = document.createElement('span');
  copy.className = 'file-copy';
  const name = document.createElement('strong');
  name.textContent = file.name;
  const size = document.createElement('small');
  size.textContent = `${formatBytes(file.size)} · arquivo original`;
  copy.append(name, size);
  const link = document.createElement('a');
  link.className = 'download';
  link.textContent = 'Baixar';
  link.href = `/download/${encodeURIComponent(file.id)}?token=${encodeURIComponent(token)}`;
  link.download = file.name;
  link.addEventListener('click', () => {
    row.classList.add('started');
    link.textContent = 'Iniciado';
    statusElement.textContent = `Download de “${file.name}” iniciado.`;
  });
  row.append(icon, copy, link);
  return row;
}

async function loadFiles({ reset = false } = {}) {
  try {
    if (reset) { nextOffset = 0; filesElement.replaceChildren(); }
    loadMoreElement.disabled = true;
    const response = await fetch(`/api/files?token=${encodeURIComponent(token)}&offset=${nextOffset}&limit=100`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sessão indisponível.');
    totalFiles = result.total;
    nextOffset = result.nextOffset;
    countElement.textContent = `${totalFiles} ${totalFiles === 1 ? 'arquivo' : 'arquivos'}`;
    filesElement.append(...result.files.map(renderFile));
    loadMoreElement.hidden = nextOffset >= totalFiles;
    downloadAllElement.hidden = totalFiles === 0;
    loadMoreElement.disabled = false;
    statusElement.textContent = 'Conectado diretamente ao computador.';
  } catch (error) {
    countElement.textContent = 'Sessão encerrada';
    filesElement.innerHTML = '<div class="empty">Estes arquivos não estão mais disponíveis.</div>';
    statusElement.textContent = error.message || 'Não foi possível conectar ao computador.';
    statusElement.className = 'status error';
  }
}

downloadAllElement.href = `/download-all?token=${encodeURIComponent(token)}`;
downloadAllElement.addEventListener('click', () => {
  statusElement.textContent = 'Preparando o ZIP com todos os arquivos originais…';
});
loadMoreElement.addEventListener('click', () => loadFiles());
loadFiles({ reset: true });
