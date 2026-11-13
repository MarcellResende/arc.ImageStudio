const compressor = { items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map() };
const resizer = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map(),
  mode: 'dimensions', lockRatio: true, sourceRatio: 1, primaryDimension: 'width', platform: 'instagram', presetId: 'instagram-square', selectedItemId: ''
};
const converter = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map(),
  format: 'webp', quality: 88, lossless: false, background: '#ffffff', preserveColorProfile: true,
  keepMetadata: false, selectedItemId: '', previews: new Map()
};
const renamer = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map(), plan: [],
  pattern: '{nome}-{n}', prefix: '', suffix: '', find: '', replace: '', caseSensitive: false,
  caseMode: 'keep', startNumber: 1, digits: 3, outputMode: 'copy', previewRequest: 0
};
const metadataCleaner = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false,
  results: new Map(), analysis: new Map(), preserveColorProfile: true, analyzing: false,
  selectedItemId: '', groupFilter: 'all', search: ''
};
const receiver = {
  running: false, destinationRoot: '', url: '', qrDataUrl: '', addresses: [],
  receivedCount: 0, receivedBytes: 0, activeUploads: 0, items: new Map()
};

const presets = {
  instagram: [
    { id: 'instagram-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'instagram-portrait', name: 'Post retrato', width: 1080, height: 1350, kind: 'portrait' },
    { id: 'instagram-story', name: 'Story / Reels', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'instagram-profile', name: 'Foto de perfil', width: 320, height: 320, kind: 'profile' }
  ],
  facebook: [
    { id: 'facebook-cover', name: 'Capa', width: 851, height: 315, kind: 'cover' },
    { id: 'facebook-feed', name: 'Post / link', width: 1200, height: 630, kind: 'landscape' },
    { id: 'facebook-square', name: 'Post / anúncio', width: 1080, height: 1080, kind: 'square' },
    { id: 'facebook-profile', name: 'Foto de perfil', width: 320, height: 320, kind: 'profile' }
  ],
  x: [
    { id: 'x-header', name: 'Capa do perfil', width: 1500, height: 500, kind: 'cover' },
    { id: 'x-post', name: 'Post horizontal', width: 1600, height: 900, kind: 'landscape' },
    { id: 'x-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'x-profile', name: 'Foto de perfil', width: 400, height: 400, kind: 'profile' }
  ],
  tiktok: [
    { id: 'tiktok-video', name: 'Vídeo / post', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'tiktok-cover', name: 'Capa vertical', width: 1080, height: 1920, kind: 'portrait' },
    { id: 'tiktok-profile', name: 'Foto de perfil', width: 200, height: 200, kind: 'profile' }
  ],
  linkedin: [
    { id: 'linkedin-cover', name: 'Capa do perfil', width: 1584, height: 396, kind: 'cover' },
    { id: 'linkedin-post', name: 'Post / link', width: 1200, height: 627, kind: 'landscape' },
    { id: 'linkedin-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'linkedin-profile', name: 'Foto de perfil', width: 400, height: 400, kind: 'profile' }
  ],
  youtube: [
    { id: 'youtube-thumbnail', name: 'Thumbnail', width: 1280, height: 720, kind: 'landscape' },
    { id: 'youtube-banner', name: 'Banner do canal', width: 2560, height: 1440, kind: 'cover' },
    { id: 'youtube-short', name: 'Short', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'youtube-profile', name: 'Foto do canal', width: 800, height: 800, kind: 'profile' }
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const actionLabels = new WeakMap();

function setActionState(button, state) {
  const label = button.querySelector('span:first-child');
  if (!actionLabels.has(button)) actionLabels.set(button, label?.textContent || 'Processar');
  button.dataset.state = state;
  if (!label) return;
  label.textContent = state === 'running'
    ? 'Processando…'
    : state === 'success'
      ? 'Concluído'
      : state === 'error'
        ? 'Tentar novamente'
        : actionLabels.get(button);
}
const thumbnailCache = new Map();
const metadataCache = new Map();
let resizePreviewTimer = null;
let resizePreviewRequest = 0;
let renamePreviewTimer = null;

const thumbnailObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    thumbnailObserver.unobserve(entry.target);
    loadThumbnail(entry.target);
  }
}, { rootMargin: '100px' });

const compressorElements = {
  selectFiles: $('#select-files'), selectFolder: $('#select-folder'), addMore: $('#add-more'), selectOutput: $('#select-output'),
  outputPath: $('#output-path'), start: $('#start'), clear: $('#clear'), dropZone: $('#drop-zone'), queue: $('#queue'),
  queueTitle: $('#queue-title'), queueSubtitle: $('#queue-subtitle'), fileList: $('#file-list'), progressWrap: $('#progress-wrap'),
  progressBar: $('#progress-bar'), progressText: $('#progress-text'), working: $('#working-animation'), summary: $('#summary'),
  summaryText: $('#summary-text'), summaryPath: $('#summary-path'), savedSize: $('#saved-size'), savedPercent: $('#saved-percent'),
  processedCount: $('#processed-count'), openOutput: $('#open-output'), newBatch: $('#new-batch')
};

const resizeElements = {
  selectFiles: $('#resize-select-files'), selectFolder: $('#resize-select-folder'), addMore: $('#resize-add-more'),
  selectOutput: $('#resize-select-output'), outputPath: $('#resize-output-path'), start: $('#resize-start'), clear: $('#resize-clear'),
  dropZone: $('#resize-drop-zone'), queue: $('#resize-queue'), queueTitle: $('#resize-queue-title'), queueSubtitle: $('#resize-queue-subtitle'),
  fileList: $('#resize-file-list'), progressWrap: $('#resize-progress-wrap'), progressBar: $('#resize-progress-bar'),
  progressText: $('#resize-progress-text'), working: $('#resize-working-animation'), summary: $('#resize-summary'),
  summaryText: $('#resize-summary-text'), summaryPath: $('#resize-summary-path'), processedCount: $('#resize-processed-count'),
  resultSize: $('#resize-result-size'), openOutput: $('#resize-open-output'), newBatch: $('#resize-new-batch'), width: $('#resize-width'),
  height: $('#resize-height'), percentage: $('#resize-percentage'), percentageRange: $('#resize-percentage-range'), ratioLock: $('#ratio-lock'),
  ratioLockInput: $('#ratio-lock-input'), templateRatioLock: $('#template-ratio-lock'), templateRatioLockInput: $('#template-ratio-lock-input'),
  targetLabel: $('#resize-target-label'), targetDetail: $('#resize-target-detail'), modeHint: $('#resize-mode-hint'), presetGrid: $('#preset-grid'),
  previewImage: $('#resize-preview-image'), previewPlaceholder: $('#resize-preview-placeholder'), previewName: $('#resize-preview-name'), previewMeta: $('#resize-preview-meta'),
  previewBadge: $('#resize-preview-badge'), previewRefresh: $('#refresh-resize-preview')
};

const metadataElements = {
  selectFiles: $('#metadata-select-files'), selectFolder: $('#metadata-select-folder'), addMore: $('#metadata-add-more'),
  selectOutput: $('#metadata-select-output'), outputPath: $('#metadata-output-path'), start: $('#metadata-start'), clear: $('#metadata-clear'),
  dropZone: $('#metadata-drop-zone'), queue: $('#metadata-queue'), queueTitle: $('#metadata-queue-title'), queueSubtitle: $('#metadata-queue-subtitle'),
  fileList: $('#metadata-file-list'), progressWrap: $('#metadata-progress-wrap'), progressBar: $('#metadata-progress-bar'),
  progressText: $('#metadata-progress-text'), working: $('#metadata-working-animation'), summary: $('#metadata-summary'),
  summaryText: $('#metadata-summary-text'), summaryPath: $('#metadata-summary-path'), cleanedCount: $('#metadata-cleaned-count'),
  alreadyCleanCount: $('#metadata-already-clean-count'), processedCount: $('#metadata-processed-count'), openOutput: $('#metadata-open-output'),
  newBatch: $('#metadata-new-batch'), colorProfile: $('#metadata-color-profile'), colorProfileInput: $('#metadata-color-profile-input'),
  inspectorEmpty: $('#metadata-inspector-empty'), inspectorContent: $('#metadata-inspector-content'), inspectorName: $('#metadata-inspector-name'),
  inspectorSummary: $('#metadata-inspector-summary'), totalBadge: $('#metadata-total-badge'), aiCard: $('#metadata-ai-card'),
  aiLabel: $('#metadata-ai-label'), aiDetail: $('#metadata-ai-detail'), locationLabel: $('#metadata-location-label'),
  locationDetail: $('#metadata-location-detail'), deviceLabel: $('#metadata-device-label'), dateDetail: $('#metadata-date-detail'),
  health: $('#metadata-health'), healthLabel: $('#metadata-health-label'), healthDetail: $('#metadata-health-detail'),
  evidence: $('#metadata-evidence'), searchInput: $('#metadata-search-input'), groupFilter: $('#metadata-group-filter'),
  visibleCount: $('#metadata-visible-count'), details: $('#metadata-details')
};

const converterElements = {
  selectFiles: $('#converter-select-files'), selectFolder: $('#converter-select-folder'), addMore: $('#converter-add-more'),
  selectOutput: $('#converter-select-output'), outputPath: $('#converter-output-path'), start: $('#converter-start'), clear: $('#converter-clear'),
  dropZone: $('#converter-drop-zone'), queue: $('#converter-queue'), queueTitle: $('#converter-queue-title'), queueSubtitle: $('#converter-queue-subtitle'),
  fileList: $('#converter-file-list'), progressWrap: $('#converter-progress-wrap'), progressBar: $('#converter-progress-bar'),
  progressText: $('#converter-progress-text'), working: $('#converter-working-animation'), summary: $('#converter-summary'),
  summaryText: $('#converter-summary-text'), summaryPath: $('#converter-summary-path'), processedCount: $('#converter-processed-count'),
  summaryFormat: $('#converter-summary-format'), outputSize: $('#converter-output-size'), openOutput: $('#converter-open-output'),
  newBatch: $('#converter-new-batch'), previewImage: $('#converter-preview-image'), previewPlaceholder: $('#converter-preview-placeholder'),
  previewName: $('#converter-preview-name'), previewMeta: $('#converter-preview-meta'), previewBadge: $('#converter-preview-badge'),
  formatHint: $('#converter-format-hint'), qualityControl: $('#converter-quality-control'), qualityRange: $('#converter-quality-range'),
  qualityLabel: $('#converter-quality-label'), qualityDetail: $('#converter-quality-detail'), backgroundControl: $('#converter-background-control'),
  background: $('#converter-background'), backgroundValue: $('#converter-background-value'), lossless: $('#converter-lossless'),
  losslessInput: $('#converter-lossless-input'), colorProfile: $('#converter-color-profile'), colorProfileInput: $('#converter-color-profile-input'),
  metadata: $('#converter-metadata'), metadataInput: $('#converter-metadata-input'), targetLabel: $('#converter-target-label'), targetDetail: $('#converter-target-detail')
};

const renamerElements = {
  selectFiles: $('#renamer-select-files'), selectFolder: $('#renamer-select-folder'), addMore: $('#renamer-add-more'),
  selectOutput: $('#renamer-select-output'), outputPath: $('#renamer-output-path'), start: $('#renamer-start'), clear: $('#renamer-clear'),
  dropZone: $('#renamer-drop-zone'), queue: $('#renamer-queue'), queueTitle: $('#renamer-queue-title'), queueSubtitle: $('#renamer-queue-subtitle'),
  fileList: $('#renamer-file-list'), progressWrap: $('#renamer-progress-wrap'), progressBar: $('#renamer-progress-bar'),
  progressText: $('#renamer-progress-text'), working: $('#renamer-working-animation'), summary: $('#renamer-summary'),
  summaryText: $('#renamer-summary-text'), summaryPath: $('#renamer-summary-path'), summaryLocation: $('#renamer-summary-location'),
  summaryLocationLabel: $('#renamer-summary-location-label'), processedCount: $('#renamer-processed-count'), conflictCount: $('#renamer-conflict-count'),
  summaryMode: $('#renamer-summary-mode'), openOutput: $('#renamer-open-output'), newBatch: $('#renamer-new-batch'),
  pattern: $('#renamer-pattern'), prefix: $('#renamer-prefix'), suffix: $('#renamer-suffix'), find: $('#renamer-find'), replace: $('#renamer-replace'),
  startNumber: $('#renamer-start-number'), digits: $('#renamer-digits'), caseMode: $('#renamer-case'), caseSensitive: $('#renamer-case-sensitive'),
  caseSensitiveInput: $('#renamer-case-sensitive-input'), example: $('#renamer-example'), originalWarning: $('#renamer-original-warning'),
  destinationSetting: $('#renamer-destination-setting'), settingsBar: $('.renamer-settings-bar'), targetLabel: $('#renamer-target-label'), targetDetail: $('#renamer-target-detail')
};

const updateElements = {
  button: $('#update-button'), buttonLabel: $('#update-button-label'), notice: $('#update-notice'),
  kicker: $('#update-notice-kicker'), title: $('#update-notice-title'), detail: $('#update-notice-detail'),
  progress: $('#update-progress'), progressBar: $('#update-progress-bar'), action: $('#update-action'), dismiss: $('#update-dismiss')
};
const receiverElements = {
  statusDot: $('#receiver-status-dot'), statusLabel: $('#receiver-status-label'), outputPath: $('#receiver-output-path'),
  selectOutput: $('#receiver-select-output'), start: $('#receiver-start'), stop: $('#receiver-stop'), openOutput: $('#receiver-open-output'),
  idle: $('#receiver-idle'), active: $('#receiver-active'), qr: $('#receiver-qr'), url: $('#receiver-url'), copyUrl: $('#receiver-copy-url'),
  networkLabel: $('#receiver-network-label'), fileCount: $('#receiver-file-count'), byteCount: $('#receiver-byte-count'),
  feedSubtitle: $('#receiver-feed-subtitle'), fileList: $('#receiver-file-list')
};
let updateUiState = { status: 'idle', currentVersion: '2.7.2', availableVersion: '', percent: 0, showNotice: false };
let dismissedUpdateStatus = '';

function renderUpdateState(state) {
  const previousStatus = updateUiState.status;
  updateUiState = { ...updateUiState, ...state };
  if (previousStatus !== updateUiState.status && ['available', 'downloading', 'installing', 'error'].includes(updateUiState.status)) dismissedUpdateStatus = '';
  const { status, currentVersion, availableVersion, percent = 0, message = '' } = updateUiState;
  updateElements.button.className = `update-button ${status}`;
  updateElements.button.disabled = ['checking', 'downloading', 'installing'].includes(status);
  updateElements.button.title = status === 'available' ? `Atualizar para ${availableVersion}` : 'Verificar atualizações';

  if (status === 'available') updateElements.buttonLabel.textContent = `Atualização v${availableVersion}`;
  else if (status === 'downloading') updateElements.buttonLabel.textContent = `Baixando ${Math.round(percent)}%`;
  else if (status === 'installing') updateElements.buttonLabel.textContent = 'Reiniciando…';
  else if (status === 'checking') updateElements.buttonLabel.textContent = 'Verificando…';
  else if (status === 'up-to-date') updateElements.buttonLabel.textContent = `v${currentVersion} · atual`;
  else updateElements.buttonLabel.textContent = `v${currentVersion}`;

  const noticeVisible = updateUiState.showNotice && dismissedUpdateStatus !== status;
  updateElements.notice.classList.toggle('hidden', !noticeVisible);
  updateElements.progress.classList.toggle('hidden', !['downloading', 'installing'].includes(status));
  updateElements.progressBar.style.width = `${status === 'installing' ? 100 : Math.max(0, Math.min(100, percent))}%`;
  updateElements.action.classList.toggle('hidden', !['available', 'error'].includes(status));
  updateElements.action.disabled = !['available', 'error'].includes(status);

  if (status === 'available') {
    updateElements.kicker.textContent = 'Atualização disponível';
    updateElements.title.textContent = `ARC Image Studio v${availableVersion}`;
    updateElements.detail.textContent = 'Um clique baixa, substitui a versão atual e abre o aplicativo novamente.';
    updateElements.action.textContent = 'Atualizar agora';
  } else if (status === 'downloading') {
    updateElements.kicker.textContent = 'Baixando atualização';
    updateElements.title.textContent = `${Math.round(percent)}% concluído`;
    updateElements.detail.textContent = updateUiState.total ? `${formatBytes(updateUiState.transferred)} de ${formatBytes(updateUiState.total)}` : message;
  } else if (status === 'installing') {
    updateElements.kicker.textContent = 'Tudo pronto';
    updateElements.title.textContent = 'Instalando e reiniciando…';
    updateElements.detail.textContent = 'O aplicativo abrirá novamente em instantes.';
  } else if (status === 'error') {
    updateElements.kicker.textContent = 'Atualização não concluída';
    updateElements.title.textContent = 'Não foi possível atualizar';
    updateElements.detail.textContent = message;
    updateElements.action.textContent = 'Tentar novamente';
  } else if (status === 'up-to-date') {
    updateElements.kicker.textContent = 'Aplicativo atualizado';
    updateElements.title.textContent = `Você já está na versão ${currentVersion}`;
    updateElements.detail.textContent = message;
  } else if (status === 'development') {
    updateElements.kicker.textContent = 'Modo de desenvolvimento';
    updateElements.title.textContent = 'Atualizador disponível no instalador';
    updateElements.detail.textContent = message;
  }
}

async function loadThumbnail(image) {
  const sourcePath = image.dataset.path;
  if (!sourcePath) return;
  try {
    const mode = image.dataset.previewMode || 'standard';
    const cacheKey = `${mode}:${sourcePath}`;
    let preview = thumbnailCache.get(cacheKey);
    if (!preview) {
      preview = mode === 'converter'
        ? window.arc.conversionPreview(sourcePath, 96, 96).then((result) => result.dataUrl)
        : window.arc.imagePreview(sourcePath, 96, 96);
      thumbnailCache.set(cacheKey, preview);
    }
    image.src = await preview;
    image.classList.add('loaded');
  } catch {
    image.closest('.file-thumb')?.classList.add('unavailable');
  }
}

function observeThumbnails(container) {
  container.querySelectorAll('img[data-path]').forEach((image) => thumbnailObserver.observe(image));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toLocaleString('pt-BR', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function receiverItemMarkup(item) {
  const total = Math.max(0, Number(item.size) || 0);
  const received = item.status === 'completed' ? total : Math.max(0, Number(item.receivedBytes) || 0);
  const percent = total ? Math.min(100, Math.round(received / total * 100)) : item.status === 'completed' ? 100 : 0;
  const status = item.status === 'completed'
    ? 'Recebido sem alterações'
    : item.status === 'error'
      ? item.error || 'Transferência interrompida'
      : `Recebendo ${percent}%`;
  const icon = item.status === 'completed' ? 'i-check' : item.status === 'error' ? 'i-alert' : 'i-download';
  return `<article class="receiver-file ${item.status || 'receiving'}" title="${escapeHtml(item.name)}">
    <span class="receiver-file-icon"><svg class="i i-sm"><use href="#${icon}"/></svg></span>
    <span class="receiver-file-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(status)} · ${formatBytes(total)}</small></span>
    <span class="receiver-file-percent num">${item.status === 'completed' ? '100%' : item.status === 'error' ? 'Erro' : `${percent}%`}</span>
    <span class="receiver-file-track"><i style="width:${percent}%"></i></span>
  </article>`;
}

function renderReceiverFiles() {
  const items = [...receiver.items.values()].slice(-100).reverse();
  if (!items.length) {
    receiverElements.fileList.innerHTML = '<div class="receiver-feed-empty"><svg class="i i-lg"><use href="#i-download"/></svg><strong>Pronto para receber</strong><span>Os arquivos aparecerão aqui durante a transferência.</span></div>';
    receiverElements.feedSubtitle.textContent = 'Aguardando o primeiro arquivo…';
    return;
  }
  receiverElements.fileList.innerHTML = items.map(receiverItemMarkup).join('');
  const active = items.filter((item) => item.status === 'receiving').length;
  receiverElements.feedSubtitle.textContent = active
    ? `${active} ${active === 1 ? 'transferência em andamento' : 'transferências em andamento'}`
    : `${receiver.receivedCount} ${receiver.receivedCount === 1 ? 'arquivo recebido' : 'arquivos recebidos'} nesta sessão`;
}

function renderReceiverState(state = {}) {
  Object.assign(receiver, state);
  if (Array.isArray(state.received)) {
    for (const item of state.received) receiver.items.set(item.id, { ...item, status: 'completed', receivedBytes: item.size });
  }
  const running = Boolean(receiver.running);
  receiverElements.statusDot.classList.toggle('active', running);
  receiverElements.statusLabel.textContent = running ? 'Pronto para receber' : 'Sessão desligada';
  receiverElements.outputPath.value = receiver.destinationRoot || '';
  receiverElements.selectOutput.disabled = running;
  receiverElements.start.classList.toggle('hidden', running);
  receiverElements.stop.classList.toggle('hidden', !running);
  receiverElements.idle.classList.toggle('hidden', running);
  receiverElements.active.classList.toggle('hidden', !running);
  receiverElements.fileCount.textContent = String(receiver.receivedCount || 0);
  receiverElements.byteCount.textContent = formatBytes(receiver.receivedBytes || 0);
  receiverElements.url.textContent = receiver.url || '';
  if (receiver.qrDataUrl) receiverElements.qr.src = receiver.qrDataUrl;
  const network = receiver.addresses?.[0];
  receiverElements.networkLabel.textContent = network ? `Rede local · ${network.address}:${receiver.port}` : 'Disponível nesta rede local';
  renderReceiverFiles();
}

async function startReceiverSession() {
  receiverElements.start.disabled = true;
  receiverElements.start.querySelector('span').textContent = 'Preparando conexão…';
  try {
    renderReceiverState(await window.arc.startReceiver({ destinationRoot: receiver.destinationRoot }));
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível iniciar. Confira a conexão Wi-Fi.', 'error');
  } finally {
    receiverElements.start.disabled = false;
    receiverElements.start.querySelector('span').textContent = 'Iniciar recebimento';
  }
}

async function stopReceiverSession() {
  receiverElements.stop.disabled = true;
  receiverElements.stop.querySelector('span').textContent = 'Encerrando…';
  try {
    renderReceiverState(await window.arc.stopReceiver());
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível encerrar a sessão.', 'error');
  } finally {
    receiverElements.stop.disabled = false;
    receiverElements.stop.querySelector('span').textContent = 'Encerrar sessão';
  }
}

function handleReceiverEvent(event) {
  if (!event || typeof event !== 'object') return;
  if (event.type === 'session-started') {
    receiver.items.clear();
    renderReceiverState(event.state);
    return;
  }
  if (event.type === 'session-stopped') {
    renderReceiverState(event.state);
    return;
  }
  if (event.type === 'upload-started') {
    receiver.activeUploads += 1;
    receiver.items.set(event.id, { ...event, status: 'receiving', receivedBytes: 0 });
  } else if (event.type === 'upload-progress') {
    receiver.items.set(event.id, { ...(receiver.items.get(event.id) || event), ...event, status: 'receiving' });
  } else if (event.type === 'upload-completed') {
    receiver.activeUploads = Math.max(0, receiver.activeUploads - 1);
    receiver.receivedCount += 1;
    receiver.receivedBytes += event.item.size;
    receiver.items.set(event.item.id, { ...event.item, status: 'completed', receivedBytes: event.item.size });
    receiverElements.fileCount.textContent = String(receiver.receivedCount);
    receiverElements.byteCount.textContent = formatBytes(receiver.receivedBytes);
  } else if (event.type === 'upload-error') {
    receiver.activeUploads = Math.max(0, receiver.activeUploads - 1);
    receiver.items.set(event.id, { ...(receiver.items.get(event.id) || event), ...event, status: 'error' });
  }
  renderReceiverFiles();
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function addUniqueItems(state, items) {
  state.completed = false;
  const existing = new Set(state.items.map((item) => item.path.toLowerCase()));
  for (const item of items) {
    if (!existing.has(item.path.toLowerCase())) { state.items.push(item); existing.add(item.path.toLowerCase()); }
  }
}

let pasteToastTimer = null;
let pastingClipboard = false;

function showPasteToast(message, type = 'success') {
  let toast = $('#paste-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'paste-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.className = `paste-toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('visible'));
  clearTimeout(pasteToastTimer);
  pasteToastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function activeTool() {
  return $('.tool-tab.active')?.dataset.tool || 'compressor';
}

function pasteTargetIsEditable(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

async function addPastedItems(tool, items) {
  if (tool === 'compressor') {
    if (compressor.completed) resetCompressor();
    const before = compressor.items.length;
    addUniqueItems(compressor, items);
    renderCompressorQueue();
    return compressor.items.length - before;
  }
  if (tool === 'resizer') {
    if (resizer.completed) resetResize();
    const before = resizer.items.length;
    await addResizeItems(items);
    return resizer.items.length - before;
  }
  if (tool === 'converter') {
    if (converter.completed) resetConverter();
    const before = converter.items.length;
    await addConverterItems(items);
    return converter.items.length - before;
  }
  if (tool === 'renamer') {
    if (renamer.completed) resetRenamer();
    const before = renamer.items.length;
    await addRenamerItems(items);
    return renamer.items.length - before;
  }
  if (metadataCleaner.completed) resetMetadataCleaner();
  const before = metadataCleaner.items.length;
  await addMetadataItems(items);
  return metadataCleaner.items.length - before;
}

async function handleClipboardPaste(event) {
  if (pasteTargetIsEditable(event.target) || pastingClipboard) return;
  const tool = activeTool();
  if (tool === 'receiver') return;
  event.preventDefault();
  const states = { compressor, resizer, converter, renamer, metadata: metadataCleaner };
  const labels = { compressor: 'Compressor', resizer: 'Resizer', converter: 'Conversor', renamer: 'Renomeador', metadata: 'Metadados' };
  const state = states[tool];
  if (state.running || (tool === 'metadata' && state.analyzing)) {
    showPasteToast('Aguarde o processamento atual terminar para colar outra imagem.', 'error');
    return;
  }

  pastingClipboard = true;
  try {
    const paths = [...(event.clipboardData?.files || [])]
      .map((file) => window.arc.getPathForFile(file))
      .filter(Boolean);
    let items = [];
    if (paths.length) {
      if (tool === 'converter') items = await window.arc.addConversionPaths(paths);
      else if (tool === 'renamer') items = await window.arc.addRenamePaths(paths);
      else items = await window.arc.addPaths(paths);
    }
    if (!items.length) items = await window.arc.pasteClipboardImages();
    if (!items.length) {
      showPasteToast('O conteúdo copiado não contém uma imagem compatível.', 'error');
      return;
    }

    const added = await addPastedItems(tool, items);
    if (!added) {
      showPasteToast('Essa imagem já está no lote atual.', 'error');
      return;
    }
    showPasteToast(`${added === 1 ? 'Imagem adicionada' : `${added} imagens adicionadas`} ao ${labels[tool]} pelo Ctrl + V.`);
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível colar a imagem.', 'error');
  } finally {
    pastingClipboard = false;
  }
}

function renderCompressorQueue() {
  if (compressor.completed) return;
  const hasItems = compressor.items.length > 0;
  compressorElements.dropZone.classList.toggle('hidden', hasItems);
  compressorElements.queue.classList.toggle('hidden', !hasItems);
  compressorElements.summary.classList.add('hidden');
  compressorElements.start.disabled = !hasItems || compressor.running;
  compressorElements.clear.disabled = compressor.running;
  compressorElements.addMore.disabled = compressor.running;
  compressorElements.queueTitle.textContent = `${compressor.items.length.toLocaleString('pt-BR')} ${compressor.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  const totalBytes = compressor.items.reduce((sum, item) => sum + item.size, 0);
  compressorElements.queueSubtitle.textContent = `Tamanho total: ${formatBytes(totalBytes)}`;
  updateCompressorSummary(totalBytes);
  compressorElements.fileList.innerHTML = compressor.items.map((item) => {
    const result = compressor.results.get(item.id);
    let status = 'Na fila', statusClass = '', size = formatBytes(item.size), detail = shortPath(item.path);
    if (result?.working) { status = 'Otimizando'; statusClass = 'working'; }
    else if (result?.ok) { status = result.savedBytes > 0 ? `−${result.savedPercent.toFixed(1)}%` : 'Já otimizada'; statusClass = 'success'; size = `${formatBytes(result.originalBytes)} → ${formatBytes(result.optimizedBytes)}`; detail = result.method; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; }
    return fileRow(item, detail, size, status, statusClass, { thumbnail: true });
  }).join('');
  observeThumbnails(compressorElements.fileList);
}

const compressorLevelCopy = {
  lossless: { label: 'Sem perda', note: 'Reorganiza os dados do arquivo sem recodificar a imagem. Os pixels permanecem idênticos.' },
  compact: { label: 'Redução forte', note: 'Recodifica com perda visual mínima para reduzir ainda mais o tamanho do arquivo.' }
};

function updateCompressorSummary(totalBytes = compressor.items.reduce((sum, item) => sum + item.size, 0)) {
  const level = $('input[name="level"]:checked')?.value || 'lossless';
  const count = compressor.items.length;
  $('#level-note').textContent = compressorLevelCopy[level].note;
  $('#compressor-target-label').textContent = compressorLevelCopy[level].label;
  $('#compressor-target-detail').textContent = count
    ? `${count.toLocaleString('pt-BR')} ${count === 1 ? 'imagem' : 'imagens'} · ${formatBytes(totalBytes)}`
    : 'Nenhuma imagem selecionada';
}

const THUMB_ICON = '<svg class="i" aria-hidden="true"><use href="#i-image"/></svg>';

function thumbMarkup(item, options = {}) {
  const image = options.thumbnail
    ? `<img data-path="${escapeHtml(item.path)}"${options.previewMode ? ` data-preview-mode="${escapeHtml(options.previewMode)}"` : ''} alt="" loading="lazy">`
    : '';
  return `<span class="file-thumb">${THUMB_ICON}${image}</span>`;
}

/* Folder hint shown under the file name: the last two folders, never the whole path. */
function shortPath(filePath = '') {
  const parts = String(filePath).split(/[\\/]/).filter(Boolean);
  parts.pop();
  const tail = parts.slice(-2).join(' › ');
  return tail ? `${parts.length > 2 ? '… › ' : ''}${tail}` : String(filePath);
}

function rowAttributes(item, options = {}) {
  const classes = ['file-row', options.selectable && 'selectable', options.className, options.active && 'selected'].filter(Boolean).join(' ');
  const selection = options.selectable ? ` data-item-id="${escapeHtml(item.id)}" tabindex="0" role="option" aria-selected="${Boolean(options.active)}"` : '';
  return `class="${classes}"${selection}`;
}

function fileRow(item, detail, value, status, statusClass, options = {}) {
  const compact = Boolean(options.compact);
  const hideStatus = compact && !statusClass && status === 'Na fila';
  const statusMarkup = hideStatus ? '<span></span>' : `<div class="file-status ${statusClass}" title="${escapeHtml(status)}"><span>${escapeHtml(status)}</span></div>`;
  const sizeMarkup = compact ? '' : `<div class="file-size">${escapeHtml(value)}</div>`;
  return `<div ${rowAttributes(item, options)}>${thumbMarkup(item, options)}<div class="file-info"><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div></div>${sizeMarkup}${statusMarkup}</div>`;
}

/* Lists are re-rendered often (progress, previews); keep keyboard focus on the same row across renders. */
function captureListFocus(list) {
  const id = list.contains(document.activeElement) ? document.activeElement.dataset?.itemId : '';
  return () => { if (id) list.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); };
}

/* One delegated listener per list instead of one per row: cheaper for big batches and keyboard-friendly. */
function bindRowSelection(list, onSelect) {
  const pick = (event) => {
    const row = event.target.closest('[data-item-id]');
    if (row && list.contains(row)) onSelect(row.dataset.itemId);
  };
  list.addEventListener('click', pick);
  list.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(event); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const row = event.target.closest('[data-item-id]');
    const sibling = row && (event.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling);
    if (!sibling) return;
    event.preventDefault();
    sibling.focus();
    sibling.click();
  });
}

/* Coalesce high-frequency progress events into one render per frame. */
const pendingRenders = new Set();
const renderCost = new Map();
function queueRender(render) {
  if (pendingRenders.has(render)) return;
  pendingRenders.add(render);
  // Adaptive throttle: a render that costs N ms may use at most ~1/3 of the main thread, so huge batches stay responsive.
  const wait = Math.min(450, (renderCost.get(render) || 0) * 2);
  setTimeout(() => requestAnimationFrame(() => {
    pendingRenders.delete(render);
    const start = performance.now();
    render();
    renderCost.set(render, performance.now() - start);
  }), wait);
}

/* ───────── Sliding "glass" selection (segmented controls, grids and lists share it) ───────── */
function syncSeg(seg) {
  const thumb = seg.querySelector(':scope > .seg-thumb');
  if (!thumb) return;
  const active = seg.querySelector(':scope > .seg-item.active') || seg.querySelector(':scope > .seg-item:has(input:checked)');
  if (!active || !active.offsetWidth) { thumb.style.opacity = '0'; return; }
  const first = thumb.dataset.ready !== '1';
  if (first) thumb.classList.add('no-anim');
  thumb.style.opacity = '';
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.height = `${active.offsetHeight}px`;
  thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  if (first) { void thumb.offsetWidth; thumb.classList.remove('no-anim'); thumb.dataset.ready = '1'; }
}

const segObserver = new ResizeObserver((entries) => entries.forEach((entry) => syncSeg(entry.target)));
function initSegments() {
  $$('.seg').forEach((seg) => { segObserver.observe(seg); syncSeg(seg); });
  const resync = (event) => { const seg = event.target.closest?.('.seg'); if (seg) requestAnimationFrame(() => syncSeg(seg)); };
  document.addEventListener('click', resync);
  document.addEventListener('change', resync);
  document.fonts?.ready.then(() => $$('.seg').forEach(syncSeg));
}

function setRangeFill(input) {
  const min = Number(input.min) || 0, max = Number(input.max) || 100;
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, (Number(input.value) - min) / (max - min) * 100))}%`);
}

/* Light that follows the pointer on buttons */
let lightFrame = 0;
document.addEventListener('pointermove', (event) => {
  const button = event.target.closest?.('.btn');
  if (!button || lightFrame) return;
  lightFrame = requestAnimationFrame(() => {
    lightFrame = 0;
    const box = button.getBoundingClientRect();
    button.style.setProperty('--mx', `${event.clientX - box.left}px`);
    button.style.setProperty('--my', `${event.clientY - box.top}px`);
  });
}, { passive: true });

async function chooseCompressorFiles(folder = false) {
  addUniqueItems(compressor, folder ? await window.arc.selectFolder() : await window.arc.selectFiles());
  renderCompressorQueue();
}

async function chooseOutput(state, element) {
  const selected = await window.arc.selectOutput();
  if (selected) { state.outputRoot = selected; element.value = selected; }
}

async function startOptimization() {
  if (compressor.running || !compressor.items.length) return;
  compressor.running = true; compressor.results.clear();
  setCompressorBusy(true);
  try {
    const response = await window.arc.optimize({ items: compressor.items, outputRoot: compressor.outputRoot, level: $('input[name="level"]:checked').value });
    compressor.batchPath = response.batchPath; compressor.completed = true; showCompressorSummary(response.results, response.batchPath);
  } catch (error) { setActionState(compressorElements.start, 'error'); window.alert(error?.message || 'Não foi possível processar este lote.'); }
  finally { compressor.running = false; setCompressorBusy(false); }
}

function setCompressorBusy(busy) {
  for (const element of [compressorElements.selectFiles, compressorElements.selectFolder, compressorElements.addMore, compressorElements.selectOutput, compressorElements.clear]) element.disabled = busy;
  compressorElements.start.disabled = busy || !compressor.items.length || compressor.completed;
  compressorElements.progressWrap.classList.toggle('hidden', !busy);
  compressorElements.working.classList.toggle('hidden', !busy);
  setActionState(compressorElements.start, busy ? 'running' : compressor.completed ? 'success' : compressorElements.start.dataset.state === 'error' ? 'error' : 'idle');
  if (busy) { compressorElements.progressBar.style.width = '0%'; compressorElements.progressText.textContent = `0 de ${compressor.items.length}`; }
  renderCompressorQueue();
}

function showCompressorSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok), failed = results.length - successful.length;
  const original = successful.reduce((sum, result) => sum + result.originalBytes, 0);
  const saved = successful.reduce((sum, result) => sum + result.savedBytes, 0);
  compressorElements.queue.classList.add('hidden'); compressorElements.dropZone.classList.add('hidden'); compressorElements.summary.classList.remove('hidden'); compressorElements.working.classList.add('hidden');
  compressorElements.savedSize.textContent = formatBytes(saved);
  compressorElements.savedPercent.textContent = `${(original ? saved / original * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  compressorElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  compressorElements.summaryText.textContent = failed ? `${successful.length} imagens prontas e ${failed} não puderam ser processadas.` : 'Tudo pronto. O lote foi salvo em uma pasta exclusiva.';
  compressorElements.summaryPath.textContent = batchPath; compressorElements.summaryPath.title = batchPath;
}

function resetCompressor() {
  Object.assign(compressor, { items: [], batchPath: '', completed: false }); compressor.results.clear();
  compressorElements.progressWrap.classList.add('hidden'); compressorElements.working.classList.add('hidden'); setActionState(compressorElements.start, 'idle'); renderCompressorQueue();
}

async function addResizeItems(items) {
  const wasEmpty = resizer.items.length === 0;
  addUniqueItems(resizer, items);
  if (wasEmpty && resizer.items[0]) {
    resizer.selectedItemId = resizer.items[0].id;
    await loadResizePreview(resizer.items[0], true);
  }
  updateResizeTarget(); renderResizeQueue();
}

async function chooseResizeFiles(folder = false) { await addResizeItems(folder ? await window.arc.selectFolder() : await window.arc.selectFiles()); }

function renderResizeQueue() {
  if (resizer.completed) return;
  const hasItems = resizer.items.length > 0;
  resizeElements.dropZone.classList.toggle('hidden', hasItems); resizeElements.queue.classList.toggle('hidden', !hasItems); resizeElements.summary.classList.add('hidden');
  resizeElements.start.disabled = !hasItems || resizer.running; resizeElements.clear.disabled = resizer.running; resizeElements.addMore.disabled = resizer.running;
  resizeElements.queueTitle.textContent = `${resizer.items.length.toLocaleString('pt-BR')} ${resizer.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  resizeElements.queueSubtitle.textContent = `Tamanho total: ${formatBytes(resizer.items.reduce((sum, item) => sum + item.size, 0))}`;
  const restoreFocus = captureListFocus(resizeElements.fileList);
  resizeElements.fileList.innerHTML = resizer.items.map((item) => {
    const result = resizer.results.get(item.id);
    let status = 'Na fila', statusClass = '', value = targetText(), detail = `${formatBytes(item.size)} → ${value}`;
    if (result?.working) { status = 'Redimensionando'; statusClass = 'working'; }
    else if (result?.ok) { status = 'Pronta'; statusClass = 'success'; value = `${result.outputWidth} × ${result.outputHeight} px`; detail = `${result.originalWidth} × ${result.originalHeight} px → ${value}`; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; value = '—'; }
    return fileRow(item, detail, value, status, statusClass, { thumbnail: true, compact: true, selectable: true, active: item.id === resizer.selectedItemId });
  }).join('');
  observeThumbnails(resizeElements.fileList);
  restoreFocus();
}

function selectResizeItem(itemId) {
  const item = resizer.items.find((candidate) => candidate.id === itemId);
  if (!item || item.id === resizer.selectedItemId) return;
  resizer.selectedItemId = item.id;
  renderResizeQueue();
  loadResizePreview(item, true);
}

async function loadResizePreview(item, syncDimensions = false) {
  if (!item) return;
  resizeElements.previewName.textContent = item.name;
  resizeElements.previewMeta.textContent = 'Preparando simulação…';
  resizeElements.previewImage.classList.add('hidden');
  resizeElements.previewPlaceholder.classList.remove('hidden');
  try {
    let metadata = metadataCache.get(item.path);
    if (!metadata) {
      metadata = await window.arc.imageMetadata(item.path);
      metadataCache.set(item.path, metadata);
    }
    if (resizer.selectedItemId !== item.id) return;
    if (syncDimensions && metadata.width && metadata.height) {
      resizer.sourceRatio = metadata.width / metadata.height;
      resizeElements.width.value = metadata.width;
      resizeElements.height.value = metadata.height;
      resizer.primaryDimension = 'width';
      updateResizeTarget();
    }
    await refreshResizePreview(item, metadata);
  } catch {
    if (resizer.selectedItemId !== item.id) return;
    resizeElements.previewMeta.textContent = 'Preview indisponível';
    resizeElements.previewPlaceholder.querySelector('span').textContent = 'Não foi possível exibir esta imagem';
  }
}

async function refreshResizePreview(item = resizer.items.find((candidate) => candidate.id === resizer.selectedItemId), knownMetadata = null) {
  if (!item) return;
  const request = ++resizePreviewRequest;
  clearTimeout(resizePreviewTimer);
  resizeElements.previewImage.classList.add('updating');
  resizeElements.previewBadge.textContent = 'ATUALIZANDO';
  resizeElements.previewRefresh.disabled = true;
  try {
    let metadata = knownMetadata || metadataCache.get(item.path);
    if (!metadata) {
      metadata = await window.arc.imageMetadata(item.path);
      metadataCache.set(item.path, metadata);
    }
    const preview = await window.arc.resizePreview(item.path, resizeOptions(), 900, 620);
    if (request !== resizePreviewRequest || resizer.selectedItemId !== item.id) return;
    resizeElements.previewImage.src = preview.dataUrl;
    resizeElements.previewImage.classList.remove('hidden');
    resizeElements.previewPlaceholder.classList.add('hidden');
    resizeElements.previewMeta.textContent = `${metadata.width} × ${metadata.height} px → ${preview.outputWidth} × ${preview.outputHeight} px`;
    resizeElements.previewBadge.textContent = 'RESULTADO';
    updateResizeResult(metadata, { width: preview.outputWidth, height: preview.outputHeight });
  } catch (error) {
    if (request !== resizePreviewRequest) return;
    resizeElements.previewMeta.textContent = error?.message || 'Preview indisponível';
    resizeElements.previewBadge.textContent = 'INDISPONÍVEL';
  } finally {
    if (request === resizePreviewRequest) {
      resizeElements.previewImage.classList.remove('updating');
      resizeElements.previewRefresh.disabled = false;
    }
  }
}

function updateResizeResult(original, output) {
  const viz = $('#resize-result-viz');
  const [originalBox, newBox] = viz.children;
  viz.classList.toggle('is-empty', !original || !output);
  if (!original || !output) {
    $('#resize-result-original').textContent = '—';
    $('#resize-result-new').textContent = '—';
    $('#resize-result-delta').textContent = '—';
    originalBox.style.width = originalBox.style.height = newBox.style.width = newBox.style.height = '0px';
    return;
  }
  const fit = Math.min(84 / Math.max(original.width, output.width), 52 / Math.max(original.height, output.height));
  originalBox.style.width = `${Math.round(original.width * fit)}px`;
  originalBox.style.height = `${Math.round(original.height * fit)}px`;
  newBox.style.width = `${Math.max(4, Math.round(output.width * fit))}px`;
  newBox.style.height = `${Math.max(4, Math.round(output.height * fit))}px`;
  const change = (output.width * output.height) / (original.width * original.height) - 1;
  $('#resize-result-original').textContent = `${original.width} × ${original.height} px`;
  $('#resize-result-new').textContent = `${output.width} × ${output.height} px`;
  $('#resize-result-delta').textContent = Math.abs(change) < 0.0005
    ? 'sem alteração'
    : `${change > 0 ? '+' : '−'}${Math.abs(change * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

function scheduleResizePreview(delay = 160) {
  clearTimeout(resizePreviewTimer);
  if (!resizer.selectedItemId || resizer.running || resizer.completed) return;
  resizeElements.previewBadge.textContent = 'AGUARDANDO';
  resizePreviewTimer = setTimeout(() => refreshResizePreview(), delay);
}

function currentPreset() { return presets[resizer.platform].find((preset) => preset.id === resizer.presetId) || presets[resizer.platform][0]; }

function targetText() {
  if (resizer.mode === 'percentage') return `${resizeElements.percentage.value || 50}% do original`;
  const preset = currentPreset();
  const width = resizer.mode === 'template' ? preset.width : resizeElements.width.value;
  const height = resizer.mode === 'template' ? preset.height : resizeElements.height.value;
  return `${width} × ${height} px`;
}

function updateResizeTarget() {
  resizeElements.targetLabel.textContent = targetText();
  resizeElements.targetDetail.textContent = resizer.mode === 'percentage' ? 'mantém a proporção original' : (resizer.lockRatio ? 'proporção preservada' : 'proporção livre');
  if (!resizer.completed) queueRender(renderResizeQueue);
}

function setResizeMode(mode) {
  resizer.mode = mode;
  $$('.resize-mode-tab').forEach((button) => button.classList.toggle('active', button.dataset.resizeMode === mode));
  for (const [id, name] of [['#dimensions-panel', 'dimensions'], ['#percentage-panel', 'percentage'], ['#template-panel', 'template']]) {
    const panel = $(id);
    const show = mode === name;
    if (show && panel.classList.contains('hidden')) { panel.classList.remove('hidden'); panel.classList.remove('entering'); void panel.offsetWidth; panel.classList.add('entering'); }
    else if (!show) panel.classList.add('hidden');
  }
  resizeElements.modeHint.textContent = mode === 'dimensions' ? 'Informe largura e altura em pixels.' : mode === 'percentage' ? 'Reduza ou amplie mantendo as proporções.' : 'Escolha a rede e o formato desejado.';
  updateResizeTarget();
  scheduleResizePreview(0);
}

function setRatioLock(value) {
  resizer.lockRatio = value;
  resizeElements.ratioLockInput.checked = value;
  resizeElements.templateRatioLockInput.checked = value;
  resizeElements.ratioLock.classList.toggle('active', value);
  resizeElements.templateRatioLock.classList.toggle('active', value);
  const caption = $('.lock-caption');
  caption.querySelector('strong').textContent = value ? 'Proporção bloqueada' : 'Proporção livre';
  caption.querySelector('small').textContent = value ? 'evita deformações' : 'largura e altura independentes';
  resizeElements.ratioLock.title = value ? 'Desbloquear proporção' : 'Bloquear proporção';
  resizeElements.templateRatioLock.querySelector('small').textContent = value ? 'ativada · preenche sem deformar' : 'desativada · pode distorcer a imagem';
  updateResizeTarget();
  scheduleResizePreview(0);
}

function syncDimension(changed) {
  resizer.primaryDimension = changed;
  if (resizer.lockRatio && Number.isFinite(resizer.sourceRatio) && resizer.sourceRatio > 0) {
    if (changed === 'width') resizeElements.height.value = Math.max(1, Math.round(Number(resizeElements.width.value) / resizer.sourceRatio));
    else resizeElements.width.value = Math.max(1, Math.round(Number(resizeElements.height.value) * resizer.sourceRatio));
  }
  updateResizeTarget();
  scheduleResizePreview();
}

function renderPresets() {
  const list = presets[resizer.platform];
  if (!list.some((preset) => preset.id === resizer.presetId)) resizer.presetId = list[0].id;
  const grid = resizeElements.presetGrid;
  [...grid.children].forEach((child) => { if (!child.classList.contains('seg-thumb')) child.remove(); });
  grid.insertAdjacentHTML('beforeend', list.map((preset) => `<button class="preset-card seg-item ${preset.id === resizer.presetId ? 'active' : ''}" type="button" data-preset="${preset.id}"><span class="preset-shape">${presetIcon(preset.kind)}</span><span><strong>${preset.name}</strong><small>${preset.width} × ${preset.height} px</small></span></button>`).join(''));
  updateResizeTarget();
  syncSeg(grid);
}

function presetIcon(kind) {
  const common = '<path class="preset-mountain" d="m7 20 5-5 4 4 3-3 5 5"/><circle class="preset-sun" cx="20" cy="10" r="2"/>';
  if (kind === 'profile') return '<svg viewBox="0 0 32 32"><circle class="preset-frame" cx="16" cy="16" r="11"/><circle class="preset-person" cx="16" cy="13" r="4"/><path class="preset-person" d="M9.5 24c1.2-4 3.4-6 6.5-6s5.3 2 6.5 6"/></svg>';
  const frames = {
    cover: '<rect class="preset-frame" x="3" y="9" width="26" height="14" rx="2"/>',
    landscape: '<rect class="preset-frame" x="4" y="7" width="24" height="18" rx="2"/>',
    square: '<rect class="preset-frame" x="5" y="5" width="22" height="22" rx="2"/>',
    portrait: '<rect class="preset-frame" x="7" y="3" width="18" height="26" rx="2"/>',
    vertical: '<rect class="preset-frame" x="9" y="2" width="14" height="28" rx="2"/>'
  };
  return `<svg viewBox="0 0 32 32">${frames[kind] || frames.square}${common}</svg>`;
}

function resizeOptions() {
  const preset = currentPreset();
  return {
    mode: resizer.mode, lockRatio: resizer.lockRatio, primaryDimension: resizer.primaryDimension,
    width: resizer.mode === 'template' ? preset.width : Number(resizeElements.width.value),
    height: resizer.mode === 'template' ? preset.height : Number(resizeElements.height.value),
    percentage: Number(resizeElements.percentage.value)
  };
}

async function startResize() {
  if (resizer.running || !resizer.items.length) return;
  resizer.running = true; resizer.results.clear(); setResizeBusy(true);
  try {
    const response = await window.arc.resize({ items: resizer.items, outputRoot: resizer.outputRoot, options: resizeOptions() });
    resizer.batchPath = response.batchPath; resizer.completed = true; showResizeSummary(response.results, response.batchPath);
  } catch (error) { setActionState(resizeElements.start, 'error'); window.alert(error?.message || 'Não foi possível redimensionar este lote.'); }
  finally { resizer.running = false; setResizeBusy(false); }
}

function setResizeBusy(busy) {
  for (const element of [resizeElements.selectFiles, resizeElements.selectFolder, resizeElements.addMore, resizeElements.selectOutput, resizeElements.clear]) element.disabled = busy;
  resizeElements.start.disabled = busy || !resizer.items.length || resizer.completed;
  resizeElements.progressWrap.classList.toggle('hidden', !busy); resizeElements.working.classList.toggle('hidden', !busy);
  setActionState(resizeElements.start, busy ? 'running' : resizer.completed ? 'success' : resizeElements.start.dataset.state === 'error' ? 'error' : 'idle');
  if (busy) { resizeElements.progressBar.style.width = '0%'; resizeElements.progressText.textContent = `0 de ${resizer.items.length}`; }
  renderResizeQueue();
}

function showResizeSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok), failed = results.length - successful.length;
  resizeElements.queue.classList.add('hidden'); resizeElements.dropZone.classList.add('hidden'); resizeElements.summary.classList.remove('hidden'); resizeElements.working.classList.add('hidden');
  resizeElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  const first = successful[0]; resizeElements.resultSize.textContent = first ? `${first.outputWidth} × ${first.outputHeight}` : '—';
  resizeElements.summaryText.textContent = failed ? `${successful.length} imagens prontas e ${failed} não puderam ser processadas.` : 'Tudo pronto. As imagens foram salvas em uma pasta exclusiva.';
  resizeElements.summaryPath.textContent = batchPath; resizeElements.summaryPath.title = batchPath;
}

function resetResize() {
  clearTimeout(resizePreviewTimer); resizePreviewRequest += 1;
  Object.assign(resizer, { items: [], batchPath: '', completed: false, selectedItemId: '' }); resizer.results.clear();
  resizeElements.previewImage.removeAttribute('src'); resizeElements.previewImage.classList.add('hidden'); resizeElements.previewPlaceholder.classList.remove('hidden');
  resizeElements.previewName.textContent = 'Imagem selecionada'; resizeElements.previewMeta.textContent = 'Clique em um arquivo para visualizar'; resizeElements.previewBadge.textContent = 'RESULTADO'; resizeElements.previewRefresh.disabled = false; updateResizeResult(null, null);
  resizeElements.progressWrap.classList.add('hidden'); resizeElements.working.classList.add('hidden'); setActionState(resizeElements.start, 'idle'); renderResizeQueue();
}

const converterFormatLabels = { jpeg: 'JPG', png: 'PNG', webp: 'WebP', avif: 'AVIF' };
const converterFormatHints = {
  jpeg: 'JPG é a opção mais compatível para fotografias e não possui transparência.',
  png: 'PNG preserva pixels e transparência sem perda, mas costuma gerar arquivos maiores.',
  webp: 'WebP oferece arquivos pequenos, transparência e ótima qualidade.',
  avif: 'AVIF prioriza a menor saída possível, com processamento um pouco mais demorado.'
};

function converterOptions() {
  return {
    format: converter.format,
    quality: converter.quality,
    lossless: converter.lossless,
    background: converter.background,
    preserveColorProfile: converter.preserveColorProfile,
    keepMetadata: converter.keepMetadata
  };
}

function updateConverterControls() {
  const label = converterFormatLabels[converter.format];
  const supportsLossless = ['webp', 'avif'].includes(converter.format);
  const qualityDisabled = converter.format === 'png' || converter.lossless;
  converterElements.formatHint.textContent = converterFormatHints[converter.format];
  converterElements.qualityControl.classList.toggle('disabled', qualityDisabled);
  converterElements.qualityRange.disabled = converter.running || qualityDisabled;
  converterElements.qualityLabel.textContent = converter.format === 'png' || converter.lossless ? 'Sem perda' : `${converter.quality}%`;
  converterElements.qualityDetail.textContent = qualityDisabled ? 'Os pixels serão preservados sem compressão com perda' : 'Alta qualidade com boa redução de tamanho';
  converterElements.backgroundControl.classList.toggle('hidden', converter.format !== 'jpeg');
  converterElements.lossless.classList.toggle('disabled', !supportsLossless);
  converterElements.losslessInput.disabled = converter.running || !supportsLossless;
  converterElements.losslessInput.checked = supportsLossless && converter.lossless;
  converterElements.previewBadge.textContent = `→ ${label.toUpperCase()}`;
  converterElements.targetLabel.textContent = qualityDisabled ? `${label} · sem perda` : `${label} · qualidade ${converter.quality}%`;
  converterElements.targetDetail.textContent = `${converter.preserveColorProfile ? 'perfil de cores preservado' : 'perfil de cores removido'} · ${converter.keepMetadata ? 'metadados copiados' : 'metadados removidos'}`;
  const previewStage = converterElements.previewImage.parentElement;
  converterElements.previewImage.style.background = converter.format === 'jpeg' ? converter.background : '';
  $$('.converter-format-card').forEach((card) => card.classList.toggle('active', card.dataset.converterFormat === converter.format));
  setRangeFill(converterElements.qualityRange);
  syncSeg($('.converter-format-grid'));
}

async function loadConverterPreview(item) {
  if (!item) return;
  const requestId = item.id;
  converterElements.previewName.textContent = item.name;
  converterElements.previewMeta.textContent = 'Gerando preview…';
  converterElements.previewPlaceholder.classList.remove('hidden');
  converterElements.previewImage.classList.add('hidden');
  try {
    let preview = converter.previews.get(item.id);
    if (!preview) {
      preview = await window.arc.conversionPreview(item.path, 760, 560);
      converter.previews.set(item.id, preview);
    }
    if (converter.selectedItemId !== requestId) return;
    converterElements.previewImage.src = preview.dataUrl;
    converterElements.previewImage.classList.remove('hidden');
    converterElements.previewPlaceholder.classList.add('hidden');
    const alpha = preview.hasAlpha ? ' · transparência' : '';
    converterElements.previewMeta.textContent = `${String(preview.format).toUpperCase()} · ${preview.width} × ${preview.height} px${alpha}`;
  } catch (error) {
    if (converter.selectedItemId !== requestId) return;
    converterElements.previewPlaceholder.querySelector('span').textContent = error?.message || 'Preview indisponível';
    converterElements.previewMeta.textContent = 'Não foi possível visualizar este arquivo';
  }
}

function renderConverterQueue() {
  if (converter.completed) return;
  const hasItems = converter.items.length > 0;
  converterElements.dropZone.classList.toggle('hidden', hasItems);
  converterElements.queue.classList.toggle('hidden', !hasItems);
  converterElements.summary.classList.add('hidden');
  converterElements.start.disabled = !hasItems || converter.running;
  converterElements.clear.disabled = converter.running;
  converterElements.addMore.disabled = converter.running;
  converterElements.queueTitle.textContent = `${converter.items.length.toLocaleString('pt-BR')} ${converter.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  converterElements.queueSubtitle.textContent = `${formatBytes(converter.items.reduce((sum, item) => sum + item.size, 0))} de entrada · saída em ${converterFormatLabels[converter.format]}`;
  const restoreFocus = captureListFocus(converterElements.fileList);
  converterElements.fileList.innerHTML = converter.items.map((item) => {
    const result = converter.results.get(item.id);
    let status = 'Na fila', statusClass = '', value = `→ ${converterFormatLabels[converter.format]}`, detail = `${formatBytes(item.size)} → ${converterFormatLabels[converter.format]}`;
    if (result?.working) { status = 'Convertendo'; statusClass = 'working'; }
    else if (result?.ok) { status = 'Convertida'; statusClass = 'success'; value = `${formatBytes(result.originalBytes)} → ${formatBytes(result.outputBytes)}`; detail = `${formatBytes(result.originalBytes)} → ${formatBytes(result.outputBytes)} · ${result.outputFormat}`; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; }
    return fileRow(item, detail, value, status, statusClass, {
      thumbnail: true, compact: true, previewMode: 'converter', selectable: true, active: item.id === converter.selectedItemId, className: 'converter-row'
    });
  }).join('');
  observeThumbnails(converterElements.fileList);
  restoreFocus();
  updateConverterControls();
}

function selectConverterItem(itemId) {
  if (!itemId || itemId === converter.selectedItemId) return;
  converter.selectedItemId = itemId;
  renderConverterQueue();
  loadConverterPreview(converter.items.find((item) => item.id === converter.selectedItemId));
}

async function addConverterItems(items) {
  addUniqueItems(converter, items);
  if (!converter.selectedItemId && converter.items[0]) converter.selectedItemId = converter.items[0].id;
  renderConverterQueue();
  await loadConverterPreview(converter.items.find((item) => item.id === converter.selectedItemId));
}

async function chooseConverterFiles(folder = false) {
  await addConverterItems(folder ? await window.arc.selectConversionFolder() : await window.arc.selectConversionFiles());
}

async function startConversion() {
  if (converter.running || !converter.items.length) return;
  converter.running = true; converter.results.clear(); setConverterBusy(true);
  try {
    const response = await window.arc.convert({ items: converter.items, outputRoot: converter.outputRoot, options: converterOptions() });
    converter.batchPath = response.batchPath; converter.completed = true; showConverterSummary(response.results, response.batchPath);
  } catch (error) { setActionState(converterElements.start, 'error'); window.alert(error?.message || 'Não foi possível converter este lote.'); }
  finally { converter.running = false; setConverterBusy(false); }
}

function setConverterBusy(busy) {
  for (const element of [converterElements.selectFiles, converterElements.selectFolder, converterElements.addMore, converterElements.selectOutput, converterElements.clear, converterElements.qualityRange, converterElements.background, converterElements.losslessInput, converterElements.colorProfileInput, converterElements.metadataInput]) element.disabled = busy;
  $$('.converter-format-card').forEach((element) => { element.disabled = busy; });
  converterElements.start.disabled = busy || !converter.items.length || converter.completed;
  converterElements.progressWrap.classList.toggle('hidden', !busy); converterElements.working.classList.toggle('hidden', !busy);
  setActionState(converterElements.start, busy ? 'running' : converter.completed ? 'success' : converterElements.start.dataset.state === 'error' ? 'error' : 'idle');
  if (busy) { converterElements.progressBar.style.width = '0%'; converterElements.progressText.textContent = `0 de ${converter.items.length}`; }
  renderConverterQueue();
}

function showConverterSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok), failed = results.length - successful.length;
  converterElements.queue.classList.add('hidden'); converterElements.dropZone.classList.add('hidden'); converterElements.summary.classList.remove('hidden'); converterElements.working.classList.add('hidden');
  converterElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  converterElements.summaryFormat.textContent = converterFormatLabels[converter.format].toUpperCase();
  converterElements.outputSize.textContent = formatBytes(successful.reduce((sum, result) => sum + result.outputBytes, 0));
  converterElements.summaryText.textContent = failed ? `${successful.length} imagens convertidas e ${failed} não puderam ser processadas.` : 'Tudo pronto. Os arquivos convertidos foram salvos sem alterar os originais.';
  converterElements.summaryPath.textContent = batchPath; converterElements.summaryPath.title = batchPath;
}

function resetConverter() {
  Object.assign(converter, { items: [], batchPath: '', completed: false, selectedItemId: '' });
  converter.results.clear(); converter.previews.clear();
  converterElements.previewImage.removeAttribute('src'); converterElements.previewImage.classList.add('hidden'); converterElements.previewPlaceholder.classList.remove('hidden');
  converterElements.previewPlaceholder.querySelector('span').textContent = 'Preparando preview…'; converterElements.previewName.textContent = 'Imagem selecionada'; converterElements.previewMeta.textContent = 'Clique em um arquivo para visualizar';
  converterElements.progressWrap.classList.add('hidden'); converterElements.working.classList.add('hidden'); setActionState(converterElements.start, 'idle'); renderConverterQueue();
}

function renameOptions() {
  return {
    pattern: renamer.pattern,
    prefix: renamer.prefix,
    suffix: renamer.suffix,
    find: renamer.find,
    replace: renamer.replace,
    caseSensitive: renamer.caseSensitive,
    caseMode: renamer.caseMode,
    startNumber: renamer.startNumber,
    digits: renamer.digits,
    outputMode: renamer.outputMode
  };
}

function updateRenamerControls() {
  const originalMode = renamer.outputMode === 'original';
  $$('.renamer-mode-card').forEach((card) => card.classList.toggle('active', card.dataset.renameMode === renamer.outputMode));
  const warningWasHidden = renamerElements.originalWarning.classList.contains('hidden');
  renamerElements.originalWarning.classList.toggle('hidden', !originalMode);
  if (originalMode && warningWasHidden) requestAnimationFrame(() => renamerElements.originalWarning.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  renamerElements.settingsBar.classList.toggle('original-mode', originalMode);
  renamerElements.selectOutput.disabled = renamer.running || originalMode;
  renamerElements.outputPath.disabled = originalMode;
  renamerElements.caseSensitive.classList.toggle('active', renamer.caseSensitive);
  renamerElements.targetLabel.textContent = originalMode ? 'Arquivos originais' : 'Cópias em nova pasta';
  const example = renamer.plan[0]?.newName || renamerElements.example.textContent;
  renamerElements.targetDetail.textContent = originalMode ? `nome atual → ${example}` : `original → ${example}`;
  renamerElements.start.querySelector('span').textContent = originalMode ? 'Renomear originais' : 'Criar cópias renomeadas';
}

function renderRenamerQueue() {
  if (renamer.completed) return;
  const hasItems = renamer.items.length > 0;
  const planById = new Map(renamer.plan.map((item) => [item.id, item]));
  const conflicts = renamer.plan.filter((item) => item.conflictAdjusted).length;
  renamerElements.dropZone.classList.toggle('hidden', hasItems);
  renamerElements.queue.classList.toggle('hidden', !hasItems);
  renamerElements.summary.classList.add('hidden');
  renamerElements.start.disabled = !hasItems || renamer.running || renamer.plan.length !== renamer.items.length;
  renamerElements.clear.disabled = renamer.running;
  renamerElements.addMore.disabled = renamer.running;
  renamerElements.queueTitle.textContent = `${renamer.items.length.toLocaleString('pt-BR')} ${renamer.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  renamerElements.queueSubtitle.textContent = conflicts
    ? `${conflicts} ${conflicts === 1 ? 'conflito ajustado automaticamente' : 'conflitos ajustados automaticamente'} · extensões preservadas`
    : 'Preview atualizado · extensões preservadas';
  renamerElements.fileList.innerHTML = renamer.items.map((item) => {
    const plan = planById.get(item.id);
    const result = renamer.results.get(item.id);
    let status = plan ? (plan.changed ? 'Pronto' : 'Sem alteração') : 'Calculando';
    let statusClass = plan?.conflictAdjusted ? 'working' : '';
    if (result?.working) { status = 'Renomeando'; statusClass = 'working'; }
    else if (result?.ok) { status = result.changed ? 'Renomeado' : 'Mantido'; statusClass = 'success'; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; }
    const newName = result?.newName || plan?.newName || 'Calculando…';
    const resultClass = !plan && !result ? 'calculating' : (plan && !plan.changed && !result?.changed ? 'unchanged' : '');
    const conflictNote = plan?.conflictAdjusted ? '<small>conflito resolvido</small>' : '';
    return `<div class="file-row renamer-row">${thumbMarkup(item, { thumbnail: true, previewMode: 'converter' })}<div class="file-info"><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-detail" title="${escapeHtml(item.path)}">${escapeHtml(shortPath(item.path))}</div></div><span class="rename-arrow" aria-hidden="true"><svg class="i"><use href="#i-arrow-right"/></svg></span><div class="rename-result ${resultClass}" title="${escapeHtml(newName)}">${escapeHtml(newName)}${conflictNote}</div><div class="file-status ${statusClass}">${escapeHtml(status)}</div></div>`;
  }).join('');
  observeThumbnails(renamerElements.fileList);
  updateRenamerControls();
}

async function refreshRenamePreview() {
  const request = ++renamer.previewRequest;
  const previewItems = renamer.items.length
    ? renamer.items
    : [{ id: '__example__', path: 'minha-foto.jpg', name: 'minha-foto.jpg', size: 0 }];
  try {
    const plan = await window.arc.renamePreview(previewItems, renameOptions());
    if (request !== renamer.previewRequest) return;
    if (renamer.items.length) renamer.plan = plan;
    else renamer.plan = [];
    if (plan[0]) renamerElements.example.textContent = plan[0].newName;
    renderRenamerQueue();
    updateRenamerControls();
  } catch (error) {
    if (request !== renamer.previewRequest) return;
    renamer.plan = [];
    renamerElements.example.textContent = error?.message || 'Padrão inválido';
    renderRenamerQueue();
  }
}

function scheduleRenamePreview(delay = 120) {
  clearTimeout(renamePreviewTimer);
  renamer.plan = [];
  renderRenamerQueue();
  renamePreviewTimer = setTimeout(() => refreshRenamePreview(), delay);
}

async function addRenamerItems(items) {
  addUniqueItems(renamer, items);
  scheduleRenamePreview(0);
}

async function chooseRenamerFiles(folder = false) {
  await addRenamerItems(folder ? await window.arc.selectRenameFolder() : await window.arc.selectRenameFiles());
}

function setRenamerBusy(busy) {
  const controls = [renamerElements.selectFiles, renamerElements.selectFolder, renamerElements.addMore, renamerElements.clear,
    renamerElements.pattern, renamerElements.prefix, renamerElements.suffix, renamerElements.find, renamerElements.replace,
    renamerElements.startNumber, renamerElements.digits, renamerElements.caseMode, renamerElements.caseSensitiveInput];
  for (const element of controls) element.disabled = busy;
  renamerElements.selectOutput.disabled = busy || renamer.outputMode === 'original';
  $$('.renamer-mode-card, [data-rename-token]').forEach((element) => { element.disabled = busy; });
  renamerElements.start.disabled = busy || !renamer.items.length || renamer.completed || renamer.plan.length !== renamer.items.length;
  renamerElements.progressWrap.classList.toggle('hidden', !busy);
  renamerElements.working.classList.toggle('hidden', !busy);
  setActionState(renamerElements.start, busy ? 'running' : renamer.completed ? 'success' : renamerElements.start.dataset.state === 'error' ? 'error' : 'idle');
  if (busy) { renamerElements.progressBar.style.width = '0%'; renamerElements.progressText.textContent = `0 de ${renamer.items.length}`; }
  renderRenamerQueue();
}

async function startRenaming() {
  if (renamer.running || !renamer.items.length || renamer.plan.length !== renamer.items.length) return;
  if (renamer.outputMode === 'original' && !window.confirm('Renomear os arquivos originais nos locais atuais? O ARC protegerá contra conflitos, mas os nomes atuais serão substituídos.')) return;
  renamer.running = true; renamer.results.clear(); setRenamerBusy(true);
  try {
    const response = await window.arc.renameImages({ items: renamer.items, outputRoot: renamer.outputRoot, options: renameOptions() });
    renamer.batchPath = response.batchPath; renamer.completed = true; showRenamerSummary(response);
  } catch (error) {
    setActionState(renamerElements.start, 'error');
    window.alert(error?.message || 'Não foi possível renomear este lote.');
  } finally {
    renamer.running = false; setRenamerBusy(false);
  }
}

function showRenamerSummary(response) {
  const successful = response.results.filter((result) => result.ok);
  const conflicts = successful.filter((result) => result.conflictAdjusted).length;
  const originalMode = response.outputMode === 'original';
  renamerElements.queue.classList.add('hidden'); renamerElements.dropZone.classList.add('hidden'); renamerElements.summary.classList.remove('hidden'); renamerElements.working.classList.add('hidden');
  renamerElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  renamerElements.conflictCount.textContent = conflicts.toLocaleString('pt-BR');
  renamerElements.summaryMode.textContent = originalMode ? 'ORIGINAIS' : 'CÓPIAS';
  renamerElements.summaryText.textContent = originalMode
    ? 'Os nomes foram atualizados nos locais de origem. O conteúdo das imagens permaneceu intacto.'
    : 'As cópias renomeadas foram salvas em uma pasta exclusiva. Os originais não foram alterados.';
  renamerElements.summaryLocationLabel.textContent = originalMode ? 'LOCAL DOS ARQUIVOS' : 'ARQUIVOS SALVOS EM';
  renamerElements.summaryPath.textContent = originalMode ? 'Locais de origem preservados' : response.batchPath;
  renamerElements.summaryPath.title = originalMode ? '' : response.batchPath;
  renamerElements.openOutput.classList.toggle('hidden', originalMode);
}

function resetRenamer() {
  clearTimeout(renamePreviewTimer);
  Object.assign(renamer, { items: [], batchPath: '', completed: false, plan: [] });
  renamer.results.clear();
  renamerElements.openOutput.classList.remove('hidden');
  renamerElements.progressWrap.classList.add('hidden'); renamerElements.working.classList.add('hidden'); setActionState(renamerElements.start, 'idle');
  renderRenamerQueue(); refreshRenamePreview();
}

function removableMetadataTypes(analysis) {
  if (!analysis?.ok) return [];
  return analysis.types.filter((type) => !(metadataCleaner.preserveColorProfile && type.id === 'icc'));
}

function metadataDetailSummary(analysis) {
  if (!analysis?.ok) return '';
  const format = String(analysis.format || '').toUpperCase();
  const software = analysis.origin?.software ? ` · ${analysis.origin.software}` : '';
  return `${analysis.width} × ${analysis.height} px · ${format} · ${analysis.detailCount.toLocaleString('pt-BR')} metadados${software}`;
}

function renderMetadataInspector() {
  const item = metadataCleaner.items.find((candidate) => candidate.id === metadataCleaner.selectedItemId);
  const analysis = item ? metadataCleaner.analysis.get(item.id) : null;
  const ready = Boolean(item && analysis?.ok);
  metadataElements.inspectorEmpty.classList.toggle('hidden', ready);
  metadataElements.inspectorContent.classList.toggle('hidden', !ready);
  if (!item) return;
  if (!analysis) {
    metadataElements.inspectorEmpty.querySelector('strong').textContent = 'Analisando a imagem…';
    metadataElements.inspectorEmpty.querySelector('span').textContent = 'Os metadados aparecerão aqui.';
    return;
  }
  if (!analysis.ok) {
    metadataElements.inspectorEmpty.querySelector('strong').textContent = 'Análise indisponível';
    metadataElements.inspectorEmpty.querySelector('span').textContent = analysis.error || 'Não foi possível ler os metadados.';
    return;
  }

  metadataElements.inspectorName.textContent = item.name;
  metadataElements.inspectorSummary.textContent = metadataDetailSummary(analysis);
  metadataElements.totalBadge.textContent = `${analysis.detailCount.toLocaleString('pt-BR')} ${analysis.detailCount === 1 ? 'metadado' : 'metadados'}`;

  const health = analysis.metadataHealth;
  metadataElements.health.classList.remove('missing', 'partial', 'complete');
  metadataElements.health.classList.toggle('hidden', !health || health.status === 'complete');
  if (health) {
    metadataElements.health.classList.add(health.status);
    metadataElements.healthLabel.textContent = health.label;
    metadataElements.healthDetail.textContent = health.detail;
  }

  const ai = analysis.ai;
  metadataElements.aiCard.classList.remove('detected', 'possible', 'unknown');
  metadataElements.aiCard.classList.add(ai.status);
  metadataElements.aiLabel.textContent = ai.label;
  metadataElements.aiDetail.textContent = ai.generator ? `${ai.generator} · confiança ${ai.confidence}` : `confiança ${ai.confidence}`;
  metadataElements.evidence.classList.toggle('hidden', !ai.evidence?.length);
  metadataElements.evidence.innerHTML = ai.evidence?.length
    ? `<strong>Evidências da origem</strong>${ai.evidence.map((evidence) => `<span>${escapeHtml(evidence)}</span>`).join('')}`
    : '';

  const location = analysis.origin?.location;
  metadataElements.locationLabel.textContent = location ? `${location.latitude}, ${location.longitude}` : 'GPS não veio no arquivo';
  metadataElements.locationDetail.textContent = location?.altitude ? `Altitude: ${location.altitude}` : 'O arquivo não contém coordenadas incorporadas';
  const deviceParts = [analysis.origin?.device, analysis.origin?.lens].filter(Boolean);
  metadataElements.deviceLabel.textContent = deviceParts.join(' · ') || 'Modelo não veio no arquivo';
  metadataElements.dateDetail.textContent = analysis.origin?.capturedAt || (analysis.origin?.author ? `Autor: ${analysis.origin.author}` : 'O arquivo não contém dados da câmera');

  const groupCounts = new Map();
  for (const detail of analysis.details) groupCounts.set(detail.group, (groupCounts.get(detail.group) || 0) + 1);
  if (metadataCleaner.groupFilter !== 'all' && !groupCounts.has(metadataCleaner.groupFilter)) metadataCleaner.groupFilter = 'all';
  metadataElements.groupFilter.innerHTML = [
    `<button class="${metadataCleaner.groupFilter === 'all' ? 'active' : ''}" data-metadata-group="all">Todos <span>${analysis.detailCount}</span></button>`,
    ...[...groupCounts.entries()].map(([group, count]) => `<button class="${metadataCleaner.groupFilter === group ? 'active' : ''}" data-metadata-group="${escapeHtml(group)}">${escapeHtml(group)} <span>${count}</span></button>`)
  ].join('');
  metadataElements.groupFilter.querySelectorAll('[data-metadata-group]').forEach((button) => button.addEventListener('click', () => {
    metadataCleaner.groupFilter = button.dataset.metadataGroup;
    renderMetadataInspector();
  }));

  const query = metadataCleaner.search.trim().toLocaleLowerCase('pt-BR');
  const visible = analysis.details.filter((detail) => {
    if (metadataCleaner.groupFilter !== 'all' && detail.group !== metadataCleaner.groupFilter) return false;
    return !query || `${detail.group} ${detail.name} ${detail.value}`.toLocaleLowerCase('pt-BR').includes(query);
  });
  const grouped = new Map();
  for (const detail of visible) {
    if (!grouped.has(detail.group)) grouped.set(detail.group, []);
    grouped.get(detail.group).push(detail);
  }
  metadataElements.visibleCount.textContent = `${visible.length.toLocaleString('pt-BR')} ${visible.length === 1 ? 'item' : 'itens'}`;
  metadataElements.details.innerHTML = visible.length ? [...grouped.entries()].map(([group, details]) => `
    <section class="metadata-detail-group"><h4><span>${escapeHtml(group)}</span><small>${details.length}</small></h4>${details.map((detail) => `
      <div class="metadata-detail-row"><div><strong>${escapeHtml(detail.name)}</strong>${detail.id ? `<small>${escapeHtml(detail.id)}</small>` : ''}</div><span title="${escapeHtml(detail.value)}">${escapeHtml(detail.value)}</span></div>`).join('')}
    </section>`).join('') : '<div class="metadata-no-results">Nenhum metadado corresponde à pesquisa.</div>';
}

function renderMetadataQueue() {
  if (metadataCleaner.completed) return;
  const hasItems = metadataCleaner.items.length > 0;
  metadataElements.dropZone.classList.toggle('hidden', hasItems);
  metadataElements.queue.classList.toggle('hidden', !hasItems);
  metadataElements.summary.classList.add('hidden');
  metadataElements.start.disabled = !hasItems || metadataCleaner.running || metadataCleaner.analyzing;
  metadataElements.clear.disabled = metadataCleaner.running;
  metadataElements.addMore.disabled = metadataCleaner.running;
  metadataElements.queueTitle.textContent = `${metadataCleaner.items.length.toLocaleString('pt-BR')} ${metadataCleaner.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  const analyzed = metadataCleaner.items.filter((item) => metadataCleaner.analysis.get(item.id)?.ok);
  const exposed = analyzed.filter((item) => removableMetadataTypes(metadataCleaner.analysis.get(item.id)).length).length;
  metadataElements.queueSubtitle.textContent = metadataCleaner.analyzing
    ? `Analisando dados ocultos… ${analyzed.length} de ${metadataCleaner.items.length}`
    : `${exposed.toLocaleString('pt-BR')} ${exposed === 1 ? 'imagem contém dados removíveis' : 'imagens contêm dados removíveis'}`;
  const restoreFocus = captureListFocus(metadataElements.fileList);
  metadataElements.fileList.innerHTML = metadataCleaner.items.map((item) => {
    const analysis = metadataCleaner.analysis.get(item.id);
    const result = metadataCleaner.results.get(item.id);
    let status = analysis ? 'Pronta para limpar' : 'Analisando';
    let statusClass = analysis ? '' : 'working';
    let detail = shortPath(item.path);
    if (analysis?.error) { status = 'Falhou na análise'; statusClass = 'error'; detail = analysis.error; }
    if (analysis?.ok) detail = `${analysis.width} × ${analysis.height} px · ${String(analysis.format || '').toUpperCase()}`;
    if (result?.working) { status = 'Limpando'; statusClass = 'working'; }
    else if (result?.ok) {
      status = result.hadAiSignals && result.aiSignalsRemoved ? 'IA removida' : (result.alreadyClean ? 'Já protegida' : 'Limpa');
      statusClass = 'success';
      detail = result.hadAiSignals && result.aiSignalsRemoved
        ? `${result.filenameAnonymized ? 'Nome revelador neutralizado; ' : ''}rastros de IA, software gerador e C2PA removidos e verificados`
        : (result.alreadyClean ? 'Nenhum dado selecionado para remover' : `${result.removedTypes.join(', ')} removidos`);
    }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; }
    if (analysis?.ok && !result) { const exposed = removableMetadataTypes(analysis).length > 0; status = exposed ? 'Com dados' : 'Sem dados'; statusClass = exposed ? 'warn' : ''; }
    return fileRow(item, detail, '', status, statusClass, {
      thumbnail: true, compact: true, selectable: true, active: item.id === metadataCleaner.selectedItemId, className: 'metadata-row'
    });
  }).join('');
  observeThumbnails(metadataElements.fileList);
  restoreFocus();
  renderMetadataInspector();
}

function selectMetadataItem(itemId) {
  if (!itemId || itemId === metadataCleaner.selectedItemId) return;
  metadataCleaner.selectedItemId = itemId;
  metadataCleaner.groupFilter = 'all';
  metadataCleaner.search = '';
  metadataElements.searchInput.value = '';
  renderMetadataQueue();
}

async function addMetadataItems(items) {
  const knownIds = new Set(metadataCleaner.items.map((item) => item.id));
  addUniqueItems(metadataCleaner, items);
  if (!metadataCleaner.selectedItemId && metadataCleaner.items[0]) metadataCleaner.selectedItemId = metadataCleaner.items[0].id;
  const pending = metadataCleaner.items.filter((item) => !knownIds.has(item.id) && !metadataCleaner.analysis.has(item.id));
  renderMetadataQueue();
  if (!pending.length) return;
  metadataCleaner.analyzing = true;
  renderMetadataQueue();
  try {
    const analyses = await window.arc.inspectMetadata(pending);
    for (const analysis of analyses) {
      if (metadataCleaner.items.some((item) => item.id === analysis.id)) metadataCleaner.analysis.set(analysis.id, analysis);
    }
  } catch (error) {
    for (const item of pending) metadataCleaner.analysis.set(item.id, { id: item.id, ok: false, error: error?.message || 'Não foi possível analisar a imagem.' });
  } finally {
    metadataCleaner.analyzing = false;
    renderMetadataQueue();
  }
}

async function chooseMetadataFiles(folder = false) {
  await addMetadataItems(folder ? await window.arc.selectFolder() : await window.arc.selectFiles());
}

async function startMetadataCleaning() {
  if (metadataCleaner.running || metadataCleaner.analyzing || !metadataCleaner.items.length) return;
  metadataCleaner.running = true;
  metadataCleaner.results.clear();
  setMetadataBusy(true);
  try {
    const response = await window.arc.cleanMetadata({
      items: metadataCleaner.items,
      outputRoot: metadataCleaner.outputRoot,
      preserveColorProfile: metadataCleaner.preserveColorProfile
    });
    metadataCleaner.batchPath = response.batchPath;
    metadataCleaner.completed = true;
    showMetadataSummary(response.results, response.batchPath);
  } catch (error) {
    setActionState(metadataElements.start, 'error');
    window.alert(error?.message || 'Não foi possível limpar os metadados deste lote.');
  } finally {
    metadataCleaner.running = false;
    setMetadataBusy(false);
  }
}

function setMetadataBusy(busy) {
  for (const element of [metadataElements.selectFiles, metadataElements.selectFolder, metadataElements.addMore, metadataElements.selectOutput, metadataElements.clear, metadataElements.colorProfileInput]) element.disabled = busy;
  metadataElements.start.disabled = busy || !metadataCleaner.items.length || metadataCleaner.completed;
  metadataElements.progressWrap.classList.toggle('hidden', !busy);
  metadataElements.working.classList.toggle('hidden', !busy);
  setActionState(metadataElements.start, busy ? 'running' : metadataCleaner.completed ? 'success' : metadataElements.start.dataset.state === 'error' ? 'error' : 'idle');
  if (busy) { metadataElements.progressBar.style.width = '0%'; metadataElements.progressText.textContent = `0 de ${metadataCleaner.items.length}`; }
  renderMetadataQueue();
}

function showMetadataSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok);
  const failed = results.length - successful.length;
  const alreadyClean = successful.filter((result) => result.alreadyClean).length;
  const cleaned = successful.length - alreadyClean;
  const aiRemoved = successful.filter((result) => result.hadAiSignals && result.aiSignalsRemoved).length;
  metadataElements.queue.classList.add('hidden'); metadataElements.dropZone.classList.add('hidden'); metadataElements.summary.classList.remove('hidden'); metadataElements.working.classList.add('hidden');
  metadataElements.cleanedCount.textContent = cleaned.toLocaleString('pt-BR');
  metadataElements.alreadyCleanCount.textContent = aiRemoved.toLocaleString('pt-BR');
  metadataElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  metadataElements.summaryText.textContent = failed
    ? `${successful.length} imagens protegidas e ${failed} não puderam ser processadas.`
    : `Tudo pronto. A limpeza foi verificada em ${successful.length.toLocaleString('pt-BR')} ${successful.length === 1 ? 'arquivo' : 'arquivos'}, sem alterar os originais.`;
  metadataElements.summaryPath.textContent = batchPath; metadataElements.summaryPath.title = batchPath;
}

function resetMetadataCleaner() {
  Object.assign(metadataCleaner, { items: [], batchPath: '', completed: false, analyzing: false, selectedItemId: '', groupFilter: 'all', search: '' });
  metadataCleaner.results.clear(); metadataCleaner.analysis.clear();
  metadataElements.searchInput.value = '';
  metadataElements.progressWrap.classList.add('hidden'); metadataElements.working.classList.add('hidden'); setActionState(metadataElements.start, 'idle');
  renderMetadataQueue();
}

function wireDropZone(element, addCallback, pathLoader = (paths) => window.arc.addPaths(paths)) {
  element.tabIndex = 0;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', `${element.querySelector('h2')?.textContent || 'Adicionar imagens'}. Use Enter ou Espaço para escolher arquivos.`);
  for (const eventName of ['dragenter', 'dragover']) element.addEventListener(eventName, (event) => { event.preventDefault(); element.classList.add('dragging'); });
  for (const eventName of ['dragleave', 'drop']) element.addEventListener(eventName, (event) => { event.preventDefault(); element.classList.remove('dragging'); });
  element.addEventListener('click', (event) => {
    if (!event.target.closest('button')) element.querySelector('.btn-primary')?.click();
  });
  element.addEventListener('keydown', (event) => {
    if (event.target !== element || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    element.querySelector('.btn-primary')?.click();
  });
  element.addEventListener('drop', async (event) => {
    const paths = [...event.dataTransfer.files].map((file) => window.arc.getPathForFile(file)).filter(Boolean);
    if (paths.length) addCallback(await pathLoader(paths));
  });
}

document.addEventListener('paste', handleClipboardPaste);

const toolTabs = $$('.tool-tab');
toolTabs.forEach((button, index) => {
  button.tabIndex = button.classList.contains('active') ? 0 : -1;
  button.addEventListener('keydown', (event) => {
    const keyMoves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keyMoves) && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? toolTabs.length - 1 : (index + keyMoves[event.key] + toolTabs.length) % toolTabs.length;
    toolTabs[nextIndex].click();
    toolTabs[nextIndex].focus();
  });
  button.addEventListener('click', () => {
    const tool = button.dataset.tool;
    if (button.classList.contains('active')) return;
    toolTabs.forEach((tab) => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    for (const view of $$('.tool-view')) {
      const show = view.id === `${tool}-view`;
      view.classList.toggle('hidden', !show);
      if (show) { view.classList.remove('entering'); void view.offsetWidth; view.classList.add('entering'); }
    }
  });
});
// Ctrl/Cmd + 1…6 jump between tools
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < toolTabs.length) { event.preventDefault(); toolTabs[index].click(); }
});

compressorElements.selectFiles.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.addMore.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.selectFolder.addEventListener('click', () => chooseCompressorFiles(true));
compressorElements.selectOutput.addEventListener('click', () => chooseOutput(compressor, compressorElements.outputPath)); compressorElements.start.addEventListener('click', startOptimization); compressorElements.clear.addEventListener('click', resetCompressor); compressorElements.newBatch.addEventListener('click', resetCompressor); compressorElements.openOutput.addEventListener('click', () => window.arc.showOutput(compressor.batchPath || compressor.outputRoot));
wireDropZone(compressorElements.dropZone, (items) => { addUniqueItems(compressor, items); renderCompressorQueue(); });

resizeElements.selectFiles.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.addMore.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.selectFolder.addEventListener('click', () => chooseResizeFiles(true));
resizeElements.selectOutput.addEventListener('click', () => chooseOutput(resizer, resizeElements.outputPath)); resizeElements.start.addEventListener('click', startResize); resizeElements.clear.addEventListener('click', resetResize); resizeElements.newBatch.addEventListener('click', resetResize); resizeElements.openOutput.addEventListener('click', () => window.arc.showOutput(resizer.batchPath || resizer.outputRoot));
resizeElements.previewRefresh.addEventListener('click', () => refreshResizePreview());
wireDropZone(resizeElements.dropZone, addResizeItems);
bindRowSelection(resizeElements.fileList, selectResizeItem);
bindRowSelection(converterElements.fileList, selectConverterItem);
bindRowSelection(metadataElements.fileList, selectMetadataItem);
resizeElements.presetGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  resizer.presetId = button.dataset.preset;
  renderPresets(); scheduleResizePreview(0);
});
$$('input[name="level"]').forEach((radio) => radio.addEventListener('change', () => updateCompressorSummary()));

converterElements.selectFiles.addEventListener('click', () => chooseConverterFiles(false)); converterElements.addMore.addEventListener('click', () => chooseConverterFiles(false)); converterElements.selectFolder.addEventListener('click', () => chooseConverterFiles(true));
converterElements.selectOutput.addEventListener('click', () => chooseOutput(converter, converterElements.outputPath)); converterElements.start.addEventListener('click', startConversion); converterElements.clear.addEventListener('click', resetConverter); converterElements.newBatch.addEventListener('click', resetConverter); converterElements.openOutput.addEventListener('click', () => window.arc.showOutput(converter.batchPath || converter.outputRoot));
wireDropZone(converterElements.dropZone, addConverterItems, (paths) => window.arc.addConversionPaths(paths));
$$('.converter-format-card').forEach((button) => button.addEventListener('click', () => {
  converter.format = button.dataset.converterFormat;
  if (!['webp', 'avif'].includes(converter.format)) converter.lossless = false;
  updateConverterControls(); renderConverterQueue();
}));
converterElements.qualityRange.addEventListener('input', () => { converter.quality = Number(converterElements.qualityRange.value); updateConverterControls(); });converterElements.background.addEventListener('input', () => { converter.background = converterElements.background.value; converterElements.backgroundValue.textContent = converter.background.toUpperCase(); updateConverterControls(); });
converterElements.losslessInput.addEventListener('change', () => { converter.lossless = converterElements.losslessInput.checked; updateConverterControls(); });
converterElements.colorProfileInput.addEventListener('change', () => { converter.preserveColorProfile = converterElements.colorProfileInput.checked; updateConverterControls(); });
converterElements.metadataInput.addEventListener('change', () => { converter.keepMetadata = converterElements.metadataInput.checked; updateConverterControls(); });

renamerElements.selectFiles.addEventListener('click', () => chooseRenamerFiles(false)); renamerElements.addMore.addEventListener('click', () => chooseRenamerFiles(false)); renamerElements.selectFolder.addEventListener('click', () => chooseRenamerFiles(true));
renamerElements.selectOutput.addEventListener('click', () => chooseOutput(renamer, renamerElements.outputPath)); renamerElements.start.addEventListener('click', startRenaming); renamerElements.clear.addEventListener('click', resetRenamer); renamerElements.newBatch.addEventListener('click', resetRenamer); renamerElements.openOutput.addEventListener('click', () => window.arc.showOutput(renamer.batchPath || renamer.outputRoot));
wireDropZone(renamerElements.dropZone, addRenamerItems, (paths) => window.arc.addRenamePaths(paths));
const renameTextBindings = [
  [renamerElements.pattern, 'pattern'], [renamerElements.prefix, 'prefix'], [renamerElements.suffix, 'suffix'],
  [renamerElements.find, 'find'], [renamerElements.replace, 'replace']
];
renameTextBindings.forEach(([element, property]) => element.addEventListener('input', () => { renamer[property] = element.value; scheduleRenamePreview(); }));
renamerElements.startNumber.addEventListener('input', () => { renamer.startNumber = Number(renamerElements.startNumber.value) || 0; scheduleRenamePreview(); });
renamerElements.digits.addEventListener('change', () => { renamer.digits = Number(renamerElements.digits.value); scheduleRenamePreview(0); });
renamerElements.caseMode.addEventListener('change', () => { renamer.caseMode = renamerElements.caseMode.value; scheduleRenamePreview(0); });
renamerElements.caseSensitiveInput.addEventListener('change', () => { renamer.caseSensitive = renamerElements.caseSensitiveInput.checked; updateRenamerControls(); scheduleRenamePreview(0); });
$$('[data-rename-token]').forEach((button) => button.addEventListener('click', () => {
  const input = renamerElements.pattern;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = `${input.value.slice(0, start)}${button.dataset.renameToken}${input.value.slice(end)}`;
  renamer.pattern = input.value;
  input.focus(); input.setSelectionRange(start + button.dataset.renameToken.length, start + button.dataset.renameToken.length);
  scheduleRenamePreview(0);
}));
$$('.renamer-mode-card').forEach((button) => button.addEventListener('click', () => {
  renamer.outputMode = button.dataset.renameMode;
  updateRenamerControls(); scheduleRenamePreview(0);
}));

metadataElements.selectFiles.addEventListener('click', () => chooseMetadataFiles(false)); metadataElements.addMore.addEventListener('click', () => chooseMetadataFiles(false)); metadataElements.selectFolder.addEventListener('click', () => chooseMetadataFiles(true));
metadataElements.selectOutput.addEventListener('click', () => chooseOutput(metadataCleaner, metadataElements.outputPath)); metadataElements.start.addEventListener('click', startMetadataCleaning); metadataElements.clear.addEventListener('click', resetMetadataCleaner); metadataElements.newBatch.addEventListener('click', resetMetadataCleaner); metadataElements.openOutput.addEventListener('click', () => window.arc.showOutput(metadataCleaner.batchPath || metadataCleaner.outputRoot));
metadataElements.colorProfileInput.addEventListener('change', () => {
  metadataCleaner.preserveColorProfile = metadataElements.colorProfileInput.checked;
  metadataElements.colorProfile.classList.toggle('active', metadataCleaner.preserveColorProfile);
  metadataElements.colorProfile.querySelector('small').textContent = metadataCleaner.preserveColorProfile
    ? 'ICC mantido · EXIF e rastros de IA removidos'
    : 'limpeza total · inclusive perfil de cores ICC';
  renderMetadataQueue();
});
metadataElements.searchInput.addEventListener('input', () => { metadataCleaner.search = metadataElements.searchInput.value; renderMetadataInspector(); });
wireDropZone(metadataElements.dropZone, addMetadataItems);

$$('.resize-mode-tab').forEach((button) => button.addEventListener('click', () => setResizeMode(button.dataset.resizeMode)));
resizeElements.ratioLockInput.addEventListener('change', () => setRatioLock(resizeElements.ratioLockInput.checked)); resizeElements.templateRatioLockInput.addEventListener('change', () => setRatioLock(resizeElements.templateRatioLockInput.checked));
resizeElements.width.addEventListener('input', () => syncDimension('width')); resizeElements.height.addEventListener('input', () => syncDimension('height'));
resizeElements.percentage.addEventListener('input', () => { resizeElements.percentageRange.value = Math.min(200, Number(resizeElements.percentage.value) || 1); setRangeFill(resizeElements.percentageRange); $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item.dataset.percentage === resizeElements.percentage.value)); updateResizeTarget(); scheduleResizePreview(); });
resizeElements.percentageRange.addEventListener('input', () => { resizeElements.percentage.value = resizeElements.percentageRange.value; setRangeFill(resizeElements.percentageRange); $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item.dataset.percentage === resizeElements.percentage.value)); updateResizeTarget(); scheduleResizePreview(); });
$$('[data-percentage]').forEach((button) => button.addEventListener('click', () => { resizeElements.percentage.value = button.dataset.percentage; resizeElements.percentageRange.value = Math.min(200, Number(button.dataset.percentage)); setRangeFill(resizeElements.percentageRange); $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item === button)); updateResizeTarget(); scheduleResizePreview(0); }));
$$('[data-platform]').forEach((button) => button.addEventListener('click', () => { resizer.platform = button.dataset.platform; resizer.presetId = presets[resizer.platform][0].id; $$('[data-platform]').forEach((item) => item.classList.toggle('active', item === button)); renderPresets(); scheduleResizePreview(0); }));

window.arc.onProgress((progress) => { compressor.results.set(progress.id, progress); const done = progress.index + 1; compressorElements.progressBar.style.width = `${done / progress.total * 100}%`; compressorElements.progressText.textContent = `${done} de ${progress.total}`; if (!compressor.completed) queueRender(renderCompressorQueue); });
window.arc.onStarted(({ id }) => { if (!compressor.completed) { compressor.results.set(id, { working: true }); queueRender(renderCompressorQueue); } });
window.arc.onResizeProgress((progress) => { resizer.results.set(progress.id, progress); const done = progress.index + 1; resizeElements.progressBar.style.width = `${done / progress.total * 100}%`; resizeElements.progressText.textContent = `${done} de ${progress.total}`; if (!resizer.completed) queueRender(renderResizeQueue); });
window.arc.onResizeStarted(({ id }) => { if (!resizer.completed) { resizer.results.set(id, { working: true }); queueRender(renderResizeQueue); } });
window.arc.onMetadataProgress((progress) => { metadataCleaner.results.set(progress.id, progress); const done = progress.index + 1; metadataElements.progressBar.style.width = `${done / progress.total * 100}%`; metadataElements.progressText.textContent = `${done} de ${progress.total}`; if (!metadataCleaner.completed) queueRender(renderMetadataQueue); });
window.arc.onMetadataStarted(({ id }) => { if (!metadataCleaner.completed) { metadataCleaner.results.set(id, { working: true }); queueRender(renderMetadataQueue); } });
window.arc.onConversionProgress((progress) => { converter.results.set(progress.id, progress); const done = progress.index + 1; converterElements.progressBar.style.width = `${done / progress.total * 100}%`; converterElements.progressText.textContent = `${done} de ${progress.total}`; if (!converter.completed) queueRender(renderConverterQueue); });
window.arc.onConversionStarted(({ id }) => { if (!converter.completed) { converter.results.set(id, { working: true }); queueRender(renderConverterQueue); } });
window.arc.onRenameProgress((progress) => { renamer.results.set(progress.id, progress); const done = progress.index + 1; renamerElements.progressBar.style.width = `${done / progress.total * 100}%`; renamerElements.progressText.textContent = `${done} de ${progress.total}`; if (!renamer.completed) queueRender(renderRenamerQueue); });
window.arc.onRenameStarted(({ id }) => { if (!renamer.completed) { renamer.results.set(id, { working: true }); queueRender(renderRenamerQueue); } });
window.arc.onUpdateState(renderUpdateState);
window.arc.onReceiverEvent(handleReceiverEvent);

[compressorElements.start, resizeElements.start, converterElements.start, renamerElements.start, metadataElements.start]
  .forEach((button) => setActionState(button, 'idle'));
$$('.progress').forEach((element) => { element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); });
$$('.summary').forEach((element) => { element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); });

updateElements.button.addEventListener('click', () => {
  if (updateUiState.status === 'available') window.arc.installUpdate();
  else window.arc.checkForUpdates();
});
updateElements.action.addEventListener('click', () => {
  if (updateUiState.status === 'available') window.arc.installUpdate();
  else window.arc.checkForUpdates();
});
updateElements.dismiss.addEventListener('click', () => {
  dismissedUpdateStatus = updateUiState.status;
  updateElements.notice.classList.add('hidden');
});

receiverElements.start.addEventListener('click', startReceiverSession);
receiverElements.stop.addEventListener('click', stopReceiverSession);
receiverElements.selectOutput.addEventListener('click', async () => {
  const outputPath = await window.arc.selectReceiverOutput();
  if (outputPath) { receiver.destinationRoot = outputPath; receiverElements.outputPath.value = outputPath; }
});
receiverElements.openOutput.addEventListener('click', () => window.arc.showOutput(receiver.destinationRoot));
receiverElements.copyUrl.addEventListener('click', async () => {
  if (await window.arc.copyReceiverUrl()) showPasteToast('Endereço copiado.');
});

window.arc.defaultOutput().then((outputPath) => { compressor.outputRoot = outputPath; resizer.outputRoot = outputPath; converter.outputRoot = outputPath; renamer.outputRoot = outputPath; metadataCleaner.outputRoot = outputPath; compressorElements.outputPath.value = outputPath; resizeElements.outputPath.value = outputPath; converterElements.outputPath.value = outputPath; renamerElements.outputPath.value = outputPath; metadataElements.outputPath.value = outputPath; });
window.arc.getUpdateState().then(renderUpdateState);
window.arc.getReceiverState().then(renderReceiverState);
metadataElements.colorProfile.classList.add('active');
converterElements.colorProfile.classList.add('active');
renderPresets(); updateResizeTarget(); updateConverterControls(); updateRenamerControls(); refreshRenamePreview(); updateCompressorSummary();
[resizeElements.percentageRange, converterElements.qualityRange].forEach(setRangeFill);
initSegments();
