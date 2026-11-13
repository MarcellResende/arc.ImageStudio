const input = document.querySelector('#files');
const queue = document.querySelector('#queue');
const connection = document.querySelector('#connection');
const token = new URLSearchParams(location.search).get('token') || '';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString('pt-BR', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function createRow(file) {
  const row = document.createElement('article');
  row.className = 'file';
  const name = document.createElement('strong');
  name.textContent = file.name;
  const state = document.createElement('em');
  state.textContent = `Aguardando · ${formatBytes(file.size)}`;
  const track = document.createElement('div');
  track.className = 'track';
  const bar = document.createElement('div');
  bar.className = 'bar';
  track.append(bar);
  row.append(name, state, track);
  queue.prepend(row);
  return { row, state, bar };
}

function upload(file, elements) {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/upload?token=${encodeURIComponent(token)}`);
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.setRequestHeader('X-ARC-File-Name', encodeURIComponent(file.name));
    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round(event.loaded / event.total * 100);
      elements.bar.style.width = `${percent}%`;
      elements.state.textContent = `Enviando ${percent}% · ${formatBytes(event.loaded)} de ${formatBytes(event.total)}`;
    });
    request.addEventListener('load', () => {
      let result = {};
      try { result = JSON.parse(request.responseText); } catch {}
      if (request.status >= 200 && request.status < 300) {
        elements.row.classList.add('done');
        elements.bar.style.width = '100%';
        elements.state.textContent = `Recebido sem alterações · ${formatBytes(file.size)}`;
      } else {
        elements.row.classList.add('error');
        elements.state.textContent = result.error || 'Não foi possível enviar este arquivo.';
      }
      resolve();
    });
    request.addEventListener('error', () => {
      elements.row.classList.add('error');
      elements.state.textContent = 'Conexão interrompida. Confira se a sessão continua ativa.';
      resolve();
    });
    request.addEventListener('abort', resolve);
    elements.state.textContent = `Preparando · ${formatBytes(file.size)}`;
    request.send(file);
  });
}

async function checkConnection() {
  try {
    const response = await fetch(`/health?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    connection.textContent = 'Conectado ao arc.Studio';
    connection.className = 'connection ok';
    input.disabled = false;
  } catch {
    connection.textContent = 'A sessão não está mais disponível no computador.';
    connection.className = 'connection error';
    input.disabled = true;
  }
}

input.disabled = true;
input.addEventListener('change', async () => {
  const files = [...input.files];
  input.value = '';
  for (const file of files) await upload(file, createRow(file));
});
checkConnection();
