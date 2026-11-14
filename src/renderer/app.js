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
const sender = {
  items: [], running: false, url: '', qrDataUrl: '', addresses: [],
  downloadCount: 0, sentBytes: 0, activeDownloads: 0, activities: new Map()
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
const senderElements = {
  statusDot: $('#sender-status-dot'), statusLabel: $('#sender-status-label'), selectedCount: $('#sender-selected-count'),
  selectedSize: $('#sender-selected-size'), selectFiles: $('#sender-select-files'), selectFilesMain: $('#sender-select-files-main'),
  start: $('#sender-start'), stop: $('#sender-stop'), clear: $('#sender-clear'), idle: $('#sender-idle'), active: $('#sender-active'),
  dropZone: $('#sender-drop-zone'), selection: $('#sender-selection'), selectionSubtitle: $('#sender-selection-subtitle'),
  selectedList: $('#sender-selected-list'), qr: $('#sender-qr'), url: $('#sender-url'), copyUrl: $('#sender-copy-url'),
  networkLabel: $('#sender-network-label'), downloadCount: $('#sender-download-count'), byteCount: $('#sender-byte-count'),
  feedSubtitle: $('#sender-feed-subtitle'), activityList: $('#sender-activity-list')
};
let updateUiState = { status: 'idle', currentVersion: '2.9.0', availableVersion: '', percent: 0, showNotice: false };
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
    updateElements.title.textContent = `arc.Studio v${availableVersion}`;
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

/* The CSP forbids inline style attributes, so bar widths are applied through the CSSOM after rendering. */
function applyProgressWidths(container) {
  container.querySelectorAll('[data-percent]').forEach((bar) => { bar.style.width = `${bar.dataset.percent}%`; });
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
    <span class="receiver-file-track"><i data-percent="${percent}"></i></span>
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
  applyProgressWidths(receiverElements.fileList);
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

function addSenderItems(items) {
  const existing = new Set(sender.items.map((item) => item.path.toLowerCase()));
  for (const item of items || []) {
    if (!item?.path || existing.has(item.path.toLowerCase())) continue;
    sender.items.push(item);
    existing.add(item.path.toLowerCase());
    if (sender.items.length >= 10000) break;
  }
  renderSenderSelection();
}

function renderSenderSelection() {
  const count = sender.items.length;
  const totalSize = sender.items.reduce((total, item) => total + (Number(item.size) || 0), 0);
  senderElements.selectedCount.textContent = count ? `${count} ${count === 1 ? 'arquivo' : 'arquivos'}` : 'Nenhum arquivo';
  senderElements.selectedSize.textContent = count ? formatBytes(totalSize) : 'Selecione no computador';
  senderElements.selection.classList.toggle('hidden', !count);
  senderElements.selectionSubtitle.textContent = count ? `${count} ${count === 1 ? 'item' : 'itens'} · ${formatBytes(totalSize)}` : '';
  senderElements.start.disabled = !count || sender.running;
  senderElements.clear.disabled = !count || sender.running;
  senderElements.selectFiles.disabled = sender.running;
  if (!count) { senderElements.selectedList.innerHTML = ''; return; }
  const visibleItems = sender.items.slice(0, 500);
  senderElements.selectedList.innerHTML = visibleItems.map((item, index) => `<div class="sender-selected-row" title="${escapeHtml(item.name)}">
    <span class="sender-file-icon"><svg class="i i-sm"><use href="#i-file"/></svg></span>
    <span class="sender-selected-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.relativePath || item.name)}</small></span>
    <span class="num">${formatBytes(item.size)}</span>
    <button class="sender-remove" type="button" data-sender-remove="${index}" title="Remover" aria-label="Remover ${escapeHtml(item.name)}"><svg class="i i-xs"><use href="#i-x"/></svg></button>
  </div>`).join('') + (count > visibleItems.length ? `<div class="sender-selected-overflow">Mais ${count - visibleItems.length} arquivos estão incluídos na sessão.</div>` : '');
}

function senderActivityMarkup(item) {
  const size = Math.max(0, Number(item.size) || 0);
  const transferred = item.status === 'completed' ? size : Math.max(0, Number(item.transferredBytes) || 0);
  const percent = size ? Math.min(100, Math.round(transferred / size * 100)) : item.status === 'completed' ? 100 : 0;
  const status = item.status === 'completed' ? 'Download concluído' : item.status === 'error' ? item.error || 'Download interrompido' : `Enviando ${percent}%`;
  const icon = item.status === 'completed' ? 'i-check' : item.status === 'error' ? 'i-alert' : 'i-send';
  return `<article class="receiver-file ${item.status || 'receiving'}" title="${escapeHtml(item.name)}">
    <span class="receiver-file-icon"><svg class="i i-sm"><use href="#${icon}"/></svg></span>
    <span class="receiver-file-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(status)} · ${formatBytes(size)}</small></span>
    <span class="receiver-file-percent num">${item.status === 'completed' ? '100%' : item.status === 'error' ? 'Erro' : `${percent}%`}</span>
    <span class="receiver-file-track"><i data-percent="${percent}"></i></span>
  </article>`;
}

function renderSenderActivities() {
  const items = [...sender.activities.values()].slice(-100).reverse();
  if (!items.length) {
    senderElements.activityList.innerHTML = '<div class="receiver-feed-empty"><svg class="i i-lg"><use href="#i-send"/></svg><strong>Arquivos disponíveis</strong><span>Os downloads aparecerão aqui em tempo real.</span></div>';
    senderElements.feedSubtitle.textContent = 'Aguardando o primeiro download…';
    return;
  }
  senderElements.activityList.innerHTML = items.map(senderActivityMarkup).join('');
  applyProgressWidths(senderElements.activityList);
  const active = items.filter((item) => item.status === 'receiving').length;
  senderElements.feedSubtitle.textContent = active
    ? `${active} ${active === 1 ? 'download em andamento' : 'downloads em andamento'}`
    : `${sender.downloadCount} ${sender.downloadCount === 1 ? 'download concluído' : 'downloads concluídos'} nesta sessão`;
}

function renderSenderState(state = {}) {
  const { files, downloads, ...publicState } = state;
  Object.assign(sender, publicState);
  if (Array.isArray(files) && files.length) sender.items = files;
  if (Array.isArray(downloads)) {
    for (const item of downloads) sender.activities.set(item.id, { ...item, status: 'completed', transferredBytes: item.size });
  }
  const running = Boolean(sender.running);
  senderElements.statusDot.classList.toggle('active', running);
  senderElements.statusLabel.textContent = running ? 'Arquivos disponíveis' : 'Sessão desligada';
  senderElements.start.classList.toggle('hidden', running);
  senderElements.stop.classList.toggle('hidden', !running);
  senderElements.idle.classList.toggle('hidden', running);
  senderElements.active.classList.toggle('hidden', !running);
  senderElements.downloadCount.textContent = String(sender.downloadCount || 0);
  senderElements.byteCount.textContent = formatBytes(sender.sentBytes || 0);
  senderElements.url.textContent = sender.url || '';
  if (sender.qrDataUrl) senderElements.qr.src = sender.qrDataUrl;
  const network = sender.addresses?.[0];
  senderElements.networkLabel.textContent = network ? `Rede local · ${network.address}:${sender.port}` : 'Disponível nesta rede local';
  renderSenderSelection();
  renderSenderActivities();
}

async function chooseSenderFiles() {
  addSenderItems(await window.arc.selectSenderFiles());
}

async function startSenderSession() {
  senderElements.start.disabled = true;
  senderElements.start.querySelector('span').textContent = 'Preparando conexão…';
  try {
    renderSenderState(await window.arc.startSender({ items: sender.items }));
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível iniciar. Confira a conexão Wi-Fi.', 'error');
  } finally {
    senderElements.start.querySelector('span').textContent = 'Iniciar envio';
    renderSenderSelection();
  }
}

async function stopSenderSession() {
  senderElements.stop.disabled = true;
  senderElements.stop.querySelector('span').textContent = 'Encerrando…';
  try { renderSenderState(await window.arc.stopSender()); }
  catch (error) { showPasteToast(error?.message || 'Não foi possível encerrar a sessão.', 'error'); }
  finally { senderElements.stop.disabled = false; senderElements.stop.querySelector('span').textContent = 'Encerrar sessão'; }
}

function handleSenderEvent(event) {
  if (!event || typeof event !== 'object') return;
  if (event.type === 'session-started') {
    sender.activities.clear();
    renderSenderState(event.state);
    return;
  }
  if (event.type === 'session-stopped') { renderSenderState(event.state); return; }
  if (event.type === 'download-started') {
    sender.activeDownloads += 1;
    sender.activities.set(event.id, { ...event, status: 'receiving', transferredBytes: 0 });
  } else if (event.type === 'download-progress') {
    sender.activities.set(event.id, { ...(sender.activities.get(event.id) || event), ...event, status: 'receiving' });
  } else if (event.type === 'download-completed') {
    sender.activeDownloads = Math.max(0, sender.activeDownloads - 1);
    sender.downloadCount += 1;
    sender.sentBytes += event.item.size;
    sender.activities.set(event.item.id, { ...event.item, status: 'completed', transferredBytes: event.item.size });
    senderElements.downloadCount.textContent = String(sender.downloadCount);
    senderElements.byteCount.textContent = formatBytes(sender.sentBytes);
  } else if (event.type === 'download-error') {
    sender.activeDownloads = Math.max(0, sender.activeDownloads - 1);
    sender.activities.set(event.id, { ...(sender.activities.get(event.id) || event), ...event, status: 'error' });
  }
  renderSenderActivities();
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
  return window.ArcNav?.current() || 'compressor';
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
  if (tool === 'receiver' || tool === 'sender') return;
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
  if (selected) {
    state.outputRoot = selected; element.value = selected;
    const key = outputKeyOf(state);
    if (key) saveSettings({ paths: { [key]: selected } });
  }
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

/* ───────── Persistent preferences ─────────
   Folders and tool options are saved by the main process in userData (settings.json) and restored on start.
   Deliberately NOT saved: the rename "originals" mode (destructive) and batch-specific text (prefix, suffix, find/replace). */
const settingsState = { ready: false, timer: 0 };

function saveSettings(patch) {
  if (!settingsState.ready) return;
  window.arc.saveSettings(patch).catch(() => {});
}

function outputKeyOf(state) {
  return state === compressor ? 'compressor' : state === resizer ? 'resizer' : state === converter ? 'converter'
    : state === renamer ? 'renamer' : state === metadataCleaner ? 'metadata' : '';
}

function collectOptions() {
  return {
    compressor: { level: $('input[name="level"]:checked')?.value || 'lossless' },
    resizer: {
      mode: resizer.mode, lockRatio: resizer.lockRatio, platform: resizer.platform, presetId: resizer.presetId,
      percentage: Math.max(1, Math.min(500, Math.round(Number(resizeElements.percentage.value)) || 50))
    },
    converter: {
      format: converter.format, quality: converter.quality, lossless: converter.lossless, background: converter.background,
      preserveColorProfile: converter.preserveColorProfile, keepMetadata: converter.keepMetadata
    },
    renamer: { pattern: renamer.pattern, caseMode: renamer.caseMode, caseSensitive: renamer.caseSensitive, digits: renamer.digits },
    metadata: { preserveColorProfile: metadataCleaner.preserveColorProfile },
    promptGen: {
      target: pg.target.value, style: promptGen.style, promptLanguage: promptGen.promptLanguage, responseLanguage: pg.responseLanguage.value,
      clarify: pg.clarify.value, reasoning: pg.reasoning.checked, grounding: pg.grounding.checked, verify: pg.verify.checked,
      fileBudget: Number(pg.fileBudget.value)
    },
    qrGen: qrCollectSettings(),
    fileHash: { algorithms: [...fh.algos], uppercase: fh.upper },
    units: ucCollectSettings(),
    claudeMd: { language: claudeMd.language, detail: cm.detail.value, includeExisting: cm.includeExisting.checked, premisesOff: claudeMd.premisesOff }
  };
}

function scheduleOptionsSave() {
  if (!settingsState.ready) return;
  clearTimeout(settingsState.timer);
  settingsState.timer = setTimeout(() => saveSettings(collectOptions()), 400);
}

async function loadSettings() {
  let loaded;
  try {
    loaded = await window.arc.getSettings();
  } catch {
    const fallback = await window.arc.defaultOutput();
    loaded = { settings: null, effectivePaths: {}, unavailable: [], defaults: { output: fallback, receiverOutput: '' } };
  }
  const { settings, effectivePaths = {}, unavailable = [], defaults } = loaded;

  const targets = [
    ['compressor', compressor, compressorElements], ['resizer', resizer, resizeElements], ['converter', converter, converterElements],
    ['renamer', renamer, renamerElements], ['metadata', metadataCleaner, metadataElements]
  ];
  for (const [key, state, elements] of targets) {
    state.outputRoot = effectivePaths[key] || defaults.output;
    elements.outputPath.value = state.outputRoot;
  }
  if (effectivePaths.receiver) { receiver.destinationRoot = effectivePaths.receiver; receiverElements.outputPath.value = effectivePaths.receiver; }

  if (settings) {
    const radio = $(`input[name="level"][value="${settings.compressor.level}"]`);
    if (radio) { radio.checked = true; updateCompressorSummary(); }

    const r = settings.resizer;
    resizeElements.percentage.value = r.percentage;
    resizeElements.percentageRange.value = Math.min(200, r.percentage);
    $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item.dataset.percentage === String(r.percentage)));
    resizer.platform = r.platform;
    if (presets[r.platform].some((preset) => preset.id === r.presetId)) resizer.presetId = r.presetId;
    $$('[data-platform]').forEach((item) => item.classList.toggle('active', item.dataset.platform === r.platform));
    renderPresets();
    setRatioLock(r.lockRatio);
    setResizeMode(r.mode);

    const c = settings.converter;
    Object.assign(converter, { format: c.format, quality: c.quality, lossless: c.lossless && ['webp', 'avif'].includes(c.format), background: c.background, preserveColorProfile: c.preserveColorProfile, keepMetadata: c.keepMetadata });
    converterElements.qualityRange.value = c.quality;
    converterElements.background.value = c.background;
    converterElements.backgroundValue.textContent = c.background.toUpperCase();
    converterElements.colorProfileInput.checked = c.preserveColorProfile;
    converterElements.metadataInput.checked = c.keepMetadata;
    updateConverterControls();

    const n = settings.renamer;
    Object.assign(renamer, { pattern: n.pattern, caseMode: n.caseMode, caseSensitive: n.caseSensitive, digits: n.digits });
    renamerElements.pattern.value = n.pattern;
    renamerElements.caseMode.value = n.caseMode;
    renamerElements.caseSensitiveInput.checked = n.caseSensitive;
    renamerElements.digits.value = String(n.digits);
    updateRenamerControls();
    refreshRenamePreview();

    metadataCleaner.preserveColorProfile = settings.metadata.preserveColorProfile;
    metadataElements.colorProfileInput.checked = metadataCleaner.preserveColorProfile;
    metadataElements.colorProfile.classList.toggle('active', metadataCleaner.preserveColorProfile);
    metadataElements.colorProfile.querySelector('small').textContent = metadataCleaner.preserveColorProfile
      ? 'ICC mantido · EXIF e rastros de IA removidos'
      : 'limpeza total · inclusive perfil de cores ICC';

    const g = settings.promptGen;
    pg.target.value = g.target; pg.responseLanguage.value = g.responseLanguage; pg.clarify.value = g.clarify;
    pg.reasoning.checked = g.reasoning; pg.grounding.checked = g.grounding; pg.verify.checked = g.verify;
    promptGen.style = g.style; promptGen.promptLanguage = g.promptLanguage; setBudgetSelect(g.fileBudget);
    for (const key of PG_DRAFT_FIELDS) pg[key].value = settings.promptDraft[key] || '';
    syncPromptSegments(); renderPromptGen();

    qrLoadSettings(settings.qrGen);
    fh.algos = new Set(settings.fileHash.algorithms); fh.upper = settings.fileHash.uppercase; fhEl.upper.checked = fh.upper;
    if (fh.available.length) { fh.algos = new Set([...fh.algos].filter((id) => fh.available.some((item) => item.id === id))); if (!fh.algos.size) fh.algos.add(fh.available[0].id); }
    fhRenderAlgos(); fhRender();
    ucLoadSettings(settings.units);

    const m = settings.claudeMd;
    claudeMd.premisesOff = [...m.premisesOff]; cm.detail.value = m.detail; cm.includeExisting.checked = m.includeExisting;
    setClaudeLanguage(m.language); renderClaudeMd();

    window.ArcNav?.show(settings.ui.lastTool, { animate: false });
  }

  [resizeElements.percentageRange, converterElements.qualityRange].forEach(setRangeFill);
  $$('.seg').forEach(syncSeg);
  settingsState.ready = true;
  if (unavailable.length) {
    showPasteToast('Uma pasta salva não está disponível agora (disco desconectado?). Usando a pasta padrão até você escolher outra.', 'error');
  }
}

// Any change inside an options panel may alter a saved preference; saving is debounced and cheap.
for (const eventName of ['change', 'input', 'click']) {
  document.addEventListener(eventName, (event) => { if (event.target.closest?.('.tool-side')) scheduleOptionsSave(); });
}
document.addEventListener('arc:toolchange', (event) => saveSettings({ ui: { lastTool: event.detail.tool } }));

/* ───────── Prompt Gen ─────────
   The engine (prompt-engine.js) is pure and local. This block only reads the form, renders the result and
   wires copy/save. Nothing typed here leaves the computer. */
const promptGen = { style: 'plain', promptLanguage: 'pt', result: null, renderTimer: 0, draftTimer: 0 };
const PG = window.ArcPromptEngine;
const pg = {
  idea: $('#pg-idea'), type: $('#pg-type'), responseLanguage: $('#pg-response-language'), context: $('#pg-context'), material: $('#pg-material'),
  role: $('#pg-role'), audience: $('#pg-audience'), tone: $('#pg-tone'), format: $('#pg-format'), length: $('#pg-length'), fields: $('#pg-fields'),
  constraints: $('#pg-constraints'), criteria: $('#pg-criteria'), exampleIn: $('#pg-example-in'), exampleOut: $('#pg-example-out'),
  target: $('#pg-target'), clarify: $('#pg-clarify'), reasoning: $('#pg-reasoning'), grounding: $('#pg-grounding'), verify: $('#pg-verify'),
  output: $('#pg-output'), outputEmpty: $('#pg-output-empty'), outputMeta: $('#pg-output-meta'), detectText: $('#pg-detect-text'),
  score: $('#pg-score'), scoreLabel: $('#pg-score-label'), barFill: $('#pg-bar-fill'), scoreBox: $('.pg-score'), checklist: $('#pg-checklist'), alerts: $('#pg-alerts'),
  questions: $('#pg-questions'), questionsSec: $('#pg-questions-sec'), signals: $('#pg-signals'), signalsSec: $('#pg-signals-sec'),
  statsMain: $('#pg-stats-main'), statsDetail: $('#pg-stats-detail'), copy: $('#pg-copy'), restore: $('#pg-restore'),
  attach: $('#pg-attach'), attachDrop: $('#pg-attach-drop'), attachBody: $('#pg-attach-body'), attachStatsMain: $('#pg-attach-stats-main'), attachStatsDetail: $('#pg-attach-stats-detail'),
  attachList: $('#pg-attach-list'), attachNote: $('#pg-attach-note'), attachFiles: $('#pg-attach-files'), attachFolder: $('#pg-attach-folder'), attachClear: $('#pg-attach-clear'),
  fileBudget: $('#pg-file-budget'), advancedCount: $('#pg-advanced-count'), save: $('#pg-save'), clear: $('#pg-clear'),
  main: $('.pg-main'), advanced: $('#pg-advanced'), styleSeg: $('#pg-style-seg'), langSeg: $('#pg-lang-seg')
};

/* The most common way to use it: ChatGPT, plain-text message, Portuguese. "Restaurar padrão" returns here. */
const PG_DEFAULTS = { target: 'gpt', style: 'plain', promptLanguage: 'pt', responseLanguage: 'auto', clarify: 'assume', reasoning: false, grounding: true, verify: true, fileBudget: 16000 };
const PG_DRAFT_FIELDS = ['idea', 'context', 'role', 'audience', 'constraints', 'criteria', 'fields'];
const PG_CONFIDENCE = { high: 'alta', medium: 'média', low: 'baixa' };
const PG_STATUS_ICON = { ok: 'check', auto: 'sparkles', warn: 'alert', missing: 'x' };
const PG_STATUS_TEXT = { ok: 'ok', auto: 'automático', warn: 'atenção', missing: 'falta' };
const PG_FOCUS_TARGET = {
  idea: 'idea', context: 'context', material: 'material', format: 'format', constraints: 'constraints', criteria: 'criteria',
  audience: 'audience', tone: 'tone', length: 'length', fields: 'fields', role: 'role'
};

/* ───── Attached files and folders ─────
   Picked or dropped by the user, read by the main process, analysed by the engine. Never saved to disk by the app. */
const attachments = { items: [], key: 0, skipped: new Set(), limitReached: false };
const ATTACH_MAX = 400;

function formatCount(value) {
  return value >= 10000 ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : value.toLocaleString('pt-BR');
}

function attachmentStatus(entry, report) {
  if (entry.kind === 'secret') return { text: 'Não lido (segredos)', tone: 'blocked' };
  if (entry.kind === 'ignored') return { text: entry.reason ? `Ignorado: ${entry.reason}` : 'Ignorado', tone: '' };
  if (entry.kind === 'binary') return { text: 'Binário', tone: '' };
  if (entry.kind === 'image') return { text: 'Imagem', tone: '' };
  const item = report?.[entry.id];
  if (!item) return { text: entry.truncated ? 'Arquivo grande' : 'Pronto', tone: '' };
  if (item.status === 'full') return { text: 'No prompt', tone: 'full' };
  if (item.status === 'truncated') return { text: 'Truncado', tone: 'truncated' };
  return { text: 'Só listado', tone: 'listed' };
}

function attachmentIcon(entry) {
  return entry.kind === 'secret' ? 'lock' : entry.kind === 'image' ? 'image' : entry.kind === 'text' ? 'file-text' : 'file';
}

function attachmentMeta(entry) {
  const parts = [formatBytes(entry.size)];
  if (entry.kind === 'text') {
    parts.push(`${entry.lines.toLocaleString('pt-BR')} linhas`);
    const language = PG.languageOf(entry);
    if (language) parts.push(language);
  } else if (entry.kind === 'image' && entry.width) parts.push(`${entry.width}×${entry.height}`);
  return parts.join(' · ');
}

function renderAttachments() {
  const has = attachments.items.length > 0;
  pg.attachBody.classList.toggle('hidden', !has);
  if (!has) return;
  const analysis = PG.analyzeFiles(attachments.items, attachments.key);
  const report = promptGen.result?.files?.report;
  const readable = analysis.readable.length;
  pg.attachStatsMain.textContent = `${analysis.count.toLocaleString('pt-BR')} ${analysis.count === 1 ? 'item' : 'itens'} · ${formatCount(analysis.totalLines)} linhas de texto · ${formatBytes(analysis.totalBytes)}`;
  const languages = analysis.byLanguage.slice(0, 3).map((item) => `${item.name} ${item.count}`).join(', ');
  const stack = analysis.stack.slice(0, 4).join(', ');
  pg.attachStatsDetail.textContent = [languages, stack, readable ? '' : 'nenhum arquivo de texto'].filter(Boolean).join(' · ') || 'sem texto legível';

  const shown = attachments.items.slice(0, 200);
  pg.attachList.innerHTML = shown.map((entry) => {
    const state = attachmentStatus(entry, report);
    return `<li class="pg-attach-row"><svg class="i" aria-hidden="true"><use href="#i-${attachmentIcon(entry)}"/></svg>`
      + `<span class="pg-attach-name" title="${escapeHtml(entry.path || entry.relativePath)}"><strong>${escapeHtml(entry.relativePath)}</strong><small>${escapeHtml(attachmentMeta(entry))}</small></span>`
      + `<span class="pg-attach-state ${state.tone}">${escapeHtml(state.text)}</span>`
      + `<button type="button" class="pg-attach-remove" data-attach-remove="${escapeHtml(entry.id)}" aria-label="Remover ${escapeHtml(entry.relativePath)}" title="Remover"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></li>`;
  }).join('') + (attachments.items.length > shown.length ? `<li class="pg-attach-note">e mais ${(attachments.items.length - shown.length).toLocaleString('pt-BR')} itens (todos entram na análise)</li>` : '');

  const notes = [];
  if (attachments.skipped.size) notes.push(`Pastas ignoradas por serem de dependências ou build: ${[...attachments.skipped].slice(0, 8).join(', ')}.`);
  if (attachments.limitReached) notes.push(`Limite de ${ATTACH_MAX} arquivos atingido: o restante não foi lido.`);
  pg.attachNote.textContent = notes.join(' ');
  pg.attachNote.classList.toggle('hidden', !notes.length);
}

function mergeAttachments(result) {
  if (!result?.entries?.length) {
    if (result) showPasteToast('Nada para analisar nesse local.', 'error');
    return;
  }
  const known = new Set(attachments.items.map((entry) => String(entry.path).toLowerCase()));
  let added = 0;
  for (const entry of result.entries) {
    if (attachments.items.length >= ATTACH_MAX) { attachments.limitReached = true; break; }
    if (known.has(String(entry.path).toLowerCase())) continue;
    known.add(String(entry.path).toLowerCase());
    attachments.items.push({ ...entry });
    added += 1;
  }
  for (const name of result.skippedDirectories || []) attachments.skipped.add(name);
  if (result.limitReached) attachments.limitReached = true;
  // Two different files with the same relative path (e.g. two "index.js"): keep the parent folder to tell them apart.
  const counts = new Map();
  for (const entry of attachments.items) counts.set(entry.relativePath, (counts.get(entry.relativePath) || 0) + 1);
  for (const entry of attachments.items) {
    if (counts.get(entry.relativePath) > 1) entry.relativePath = String(entry.path).split(/[\\/]/).slice(-2).join('/');
  }
  attachments.key += 1;
  renderPromptGen();
  showPasteToast(added ? `${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'} para análise.` : 'Esses arquivos já estavam na lista.', added ? 'success' : 'error');
}

async function chooseAttachments(mode) {
  try { mergeAttachments(await window.arc.selectAttachments(mode)); }
  catch (error) { showPasteToast(error?.message || 'Não foi possível ler os arquivos.', 'error'); }
}

function removeAttachment(id) {
  attachments.items = attachments.items.filter((entry) => entry.id !== id);
  attachments.key += 1;
  if (!attachments.items.length) { attachments.skipped.clear(); attachments.limitReached = false; }
  renderPromptGen();
}

function clearAttachments() {
  attachments.items = [];
  attachments.skipped.clear();
  attachments.limitReached = false;
  attachments.key += 1;
  renderPromptGen();
}

function setBudgetSelect(value) {
  const wanted = Number(value);
  let best = pg.fileBudget.options[0];
  for (const option of pg.fileBudget.options) if (Math.abs(Number(option.value) - wanted) < Math.abs(Number(best.value) - wanted)) best = option;
  pg.fileBudget.value = best.value;
}

function updateAdvancedCount() {
  const filled = [pg.role, pg.audience, pg.fields, pg.constraints, pg.criteria, pg.exampleIn, pg.exampleOut].filter((element) => element.value.trim()).length
    + [pg.tone, pg.format, pg.length].filter((element) => element.value !== 'auto').length;
  pg.advancedCount.textContent = `${filled} ${filled === 1 ? 'preenchido' : 'preenchidos'}`;
  pg.advancedCount.classList.toggle('hidden', !filled);
}

function hasFilePayload(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}

async function dropAttachments(event) {
  event.preventDefault();
  $('#prompt-gen-view').classList.remove('dragging');
  pg.attachDrop.classList.remove('dragging');
  const paths = [...event.dataTransfer.files].map((file) => window.arc.getPathForFile(file)).filter(Boolean);
  if (!paths.length) return;
  try { mergeAttachments(await window.arc.addAttachmentPaths(paths)); }
  catch (error) { showPasteToast(error?.message || 'Não foi possível ler os arquivos.', 'error'); }
}

function fillPromptSelects() {
  pg.type.innerHTML = '<option value="auto">Automático</option>' + PG.TYPE_ORDER.map((id) => `<option value="${id}">${escapeHtml(PG.TYPES[id].label)}</option>`).join('');
  pg.tone.innerHTML = '<option value="auto">Automático</option>' + Object.entries(PG.TONES).map(([id, tone]) => `<option value="${id}">${escapeHtml(tone.label)}</option>`).join('');
  pg.format.innerHTML = '<option value="auto">Automático</option>' + Object.entries(PG.FORMATS).map(([id, format]) => `<option value="${id}">${escapeHtml(format.label)}</option>`).join('');
}

function readPromptInput() {
  return {
    idea: pg.idea.value, type: pg.type.value, context: pg.context.value, material: pg.material.value, role: pg.role.value,
    audience: pg.audience.value, tone: pg.tone.value, format: pg.format.value, length: pg.length.value, fields: pg.fields.value,
    constraints: pg.constraints.value, criteria: pg.criteria.value, exampleIn: pg.exampleIn.value, exampleOut: pg.exampleOut.value,
    style: promptGen.style, target: pg.target.value, promptLanguage: promptGen.promptLanguage, responseLanguage: pg.responseLanguage.value,
    reasoning: pg.reasoning.checked, clarify: pg.clarify.value, verify: pg.verify.checked, grounding: pg.grounding.checked,
    files: attachments.items, filesKey: attachments.key, fileBudget: Number(pg.fileBudget.value)
  };
}

function renderPromptOutput(prompt) {
  const fragment = document.createDocumentFragment();
  for (const line of prompt.split('\n')) {
    const span = document.createElement('span');
    if (/^<\/?[a-z_]+>$/.test(line) || /^## /.test(line) || /^[A-ZÀ-ÚÇ ]+:$/.test(line)) span.className = 'pg-tag';
    span.textContent = line;
    fragment.append(span, '\n');
  }
  pg.output.replaceChildren(fragment);
}

function describeLength(length) {
  if (!length) return '';
  const words = { max: `até ${length.amount}`, min: `pelo menos ${length.amount}`, approx: `cerca de ${length.amount}`, exact: `${length.amount}`, range: `${length.from}–${length.to}` }[length.kind];
  return `${words} ${length.unit}`;
}

function renderPromptSignals(result) {
  const chips = [];
  const { signals, type, applied } = result;
  chips.push(`Tipo: ${type.label}${type.auto ? ` · confiança ${PG_CONFIDENCE[type.confidence]}` : ' · definido por você'}`);
  if (applied.formatSource === 'detected' && applied.format) chips.push(`Formato: ${PG.FORMATS[applied.format].label}`);
  if (signals.length) chips.push(`Tamanho: ${describeLength(signals.length)}`);
  else if (signals.brevity) chips.push(`Tamanho: ${signals.brevity === 'short' ? 'curto' : 'detalhado'}`);
  if (signals.audience) chips.push(`Público: ${signals.audience}`);
  if (signals.tone) chips.push(`Tom: ${PG.TONES[signals.tone].label.toLowerCase()}`);
  if (signals.responseLanguage) chips.push(`Responder em: ${PG.RESPONSE_LANGUAGES[signals.responseLanguage].label}`);
  if (signals.targetLanguage) chips.push(`Idioma de destino: ${signals.targetLanguage}`);
  if (signals.programmingLanguages.length) chips.push(`Tecnologia: ${signals.programmingLanguages.join(', ')}`);
  const hasIdea = Boolean(pg.idea.value.trim());
  pg.signalsSec.classList.toggle('hidden', !hasIdea);
  pg.signals.innerHTML = chips.map((text) => `<span class="chip chip-accent">${escapeHtml(text)}</span>`).join('');
}

function renderPromptAnalysis(result) {
  const { analysis } = result;
  const level = analysis.label === 'Vazio' ? 'empty' : analysis.score >= 85 ? 'great' : analysis.score >= 70 ? 'good' : analysis.score >= 50 ? 'fair' : 'low';
  pg.scoreBox.dataset.level = level;
  pg.score.textContent = String(analysis.score);
  pg.scoreLabel.textContent = analysis.label;
  pg.barFill.style.width = `${analysis.score}%`;

  const hasIdea = Boolean(pg.idea.value.trim());
  pg.checklist.innerHTML = hasIdea ? analysis.items.map((item) => `<li><button type="button" class="pg-check ${item.status}" data-pg-focus="${escapeHtml(item.field)}" title="${escapeHtml(item.detail)}">`
    + `<span class="pg-check-icon"><svg class="i i-xs" aria-hidden="true"><use href="#i-${PG_STATUS_ICON[item.status]}"/></svg></span>`
    + `<span class="pg-check-copy"><strong>${escapeHtml(item.label)}</strong>${item.status === 'ok' ? '' : `<small>${escapeHtml(item.detail)}</small>`}</span>`
    + `<em>${PG_STATUS_TEXT[item.status]}</em></button></li>`).join('')
    : '<li class="pg-check-empty">Escreva seu pedido para ver a avaliação.</li>';

  pg.alerts.innerHTML = analysis.alerts.map((alert) => `<div class="callout ${alert.level === 'warn' ? 'callout-warn' : ''}"><svg class="i" aria-hidden="true"><use href="#i-${alert.level === 'warn' ? 'alert' : 'info'}"/></svg><span>${escapeHtml(alert.text)}</span></div>`).join('');

  pg.questionsSec.classList.toggle('hidden', !hasIdea || !analysis.questions.length);
  pg.questions.innerHTML = analysis.questions.map((question) => `<li><button type="button" data-pg-focus="${escapeHtml(question.field)}"><svg class="i i-xs" aria-hidden="true"><use href="#i-arrow-right"/></svg><span>${escapeHtml(question.text)}</span></button></li>`).join('');
}

function renderPromptGen() {
  promptGen.result = PG.generate(readPromptInput());
  const result = promptGen.result;
  const hasPrompt = Boolean(result.prompt);

  pg.output.classList.toggle('hidden', !hasPrompt);
  pg.outputEmpty.classList.toggle('hidden', hasPrompt);
  if (hasPrompt) renderPromptOutput(result.prompt); else pg.output.replaceChildren();
  pg.copy.disabled = !hasPrompt;
  pg.save.disabled = !hasPrompt;
  pg.restore.disabled = isPromptDefault();

  const detected = result.type;
  pg.type.options[0].textContent = hasPrompt && detected.auto ? `Automático · ${detected.label}` : 'Automático';
  if (!hasPrompt) pg.detectText.textContent = 'Digite seu pedido: o tipo de tarefa é detectado automaticamente.';
  else {
    const also = detected.auto && detected.confidence === 'low' && detected.alternatives.length ? ` Talvez: ${detected.alternatives.map((item) => item.label).join(' ou ')}.` : '';
    pg.detectText.textContent = detected.auto ? `Detectado: ${detected.label} (confiança ${PG_CONFIDENCE[detected.confidence]}).${also}` : `Tipo definido por você: ${detected.label}.`;
  }

  pg.outputMeta.textContent = hasPrompt ? `${result.sections.length} seções · ≈ ${result.stats.tokens.toLocaleString('pt-BR')} tokens` : 'aguardando pedido';
  const styleName = { xml: 'XML', markdown: 'Markdown', plain: 'Texto' }[result.applied.style];
  const targetName = { universal: 'Universal', claude: 'Claude', gpt: 'ChatGPT', gemini: 'Gemini' }[result.applied.target];
  pg.statsMain.textContent = hasPrompt ? `≈ ${result.stats.tokens.toLocaleString('pt-BR')} tokens · ${result.stats.words.toLocaleString('pt-BR')} palavras` : 'Nenhum prompt ainda';
  pg.statsDetail.textContent = hasPrompt ? `${styleName} · ${targetName} · ${result.applied.lang === 'en' ? 'English' : 'Português'} · qualidade ${result.analysis.score}/100` : 'Escreva o que você quer pedir';

  renderPromptSignals(result);
  renderPromptAnalysis(result);
  renderAttachments();
  updateAdvancedCount();
}

function schedulePromptRender() {
  clearTimeout(promptGen.renderTimer);
  promptGen.renderTimer = setTimeout(renderPromptGen, 90);
}

function scheduleDraftSave() {
  if (!settingsState.ready) return;
  clearTimeout(promptGen.draftTimer);
  promptGen.draftTimer = setTimeout(() => {
    saveSettings({ promptDraft: Object.fromEntries(PG_DRAFT_FIELDS.map((key) => [key, pg[key].value])) });
  }, 700);
}

function syncPromptSegments() {
  for (const button of pg.styleSeg.querySelectorAll('[data-pg-style]')) button.classList.toggle('active', button.dataset.pgStyle === promptGen.style);
  for (const button of pg.langSeg.querySelectorAll('[data-pg-lang]')) button.classList.toggle('active', button.dataset.pgLang === promptGen.promptLanguage);
  syncSeg(pg.styleSeg); syncSeg(pg.langSeg);
}

function isPromptDefault() {
  const d = PG_DEFAULTS;
  return pg.target.value === d.target && promptGen.style === d.style && promptGen.promptLanguage === d.promptLanguage
    && pg.responseLanguage.value === d.responseLanguage && pg.clarify.value === d.clarify
    && pg.reasoning.checked === d.reasoning && pg.grounding.checked === d.grounding && pg.verify.checked === d.verify
    && Number(pg.fileBudget.value) === d.fileBudget;
}

/* Resets only the strategy options. What you typed (request, context, material…) is left alone. */
function restorePromptDefaults() {
  const d = PG_DEFAULTS;
  pg.target.value = d.target; pg.responseLanguage.value = d.responseLanguage; pg.clarify.value = d.clarify;
  pg.reasoning.checked = d.reasoning; pg.grounding.checked = d.grounding; pg.verify.checked = d.verify;
  promptGen.style = d.style; promptGen.promptLanguage = d.promptLanguage;
  setBudgetSelect(d.fileBudget);
  syncPromptSegments();
  renderPromptGen();
  scheduleOptionsSave();
  showPasteToast('Configurações restauradas: ChatGPT, mensagem de texto simples, em português.');
}

function setPromptPane(pane) {
  pg.main.dataset.pane = pane;
  $$('[data-pg-pane]').forEach((button) => button.classList.toggle('active', button.dataset.pgPane === pane));
  syncSeg($('.pg-tabs'));
}

function focusPromptField(name) {
  const element = name === 'files' ? pg.attachDrop : pg[PG_FOCUS_TARGET[name] || 'idea'];
  if (!element) return;
  setPromptPane('form');
  if (pg.advanced.contains(element)) pg.advanced.open = true;
  element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

function promptFileName() {
  const type = promptGen.result?.type.label || 'prompt';
  const slug = type.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prompt';
  return `prompt-${slug}.${promptGen.style === 'markdown' ? 'md' : 'txt'}`;
}

async function copyPrompt() {
  const text = promptGen.result?.prompt;
  if (!text) return;
  let copied = false;
  try { copied = await window.arc.writeClipboardText(text); } catch { copied = false; }
  showPasteToast(copied ? 'Prompt copiado para a área de transferência.' : 'Não foi possível copiar o prompt.', copied ? 'success' : 'error');
  if (!copied) return;
  const label = pg.copy.querySelector('span');
  label.textContent = 'Copiado';
  setTimeout(() => { label.textContent = 'Copiar prompt'; }, 1600);
}

async function savePromptFile() {
  const text = promptGen.result?.prompt;
  if (!text) return;
  try {
    const savedPath = await window.arc.savePromptFile({ text, suggestedName: promptFileName() });
    if (savedPath) showPasteToast(`Prompt salvo em ${savedPath}`);
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível salvar o arquivo.', 'error');
  }
}

function clearPromptForm() {
  const filled = [...PG_DRAFT_FIELDS, 'material', 'exampleIn', 'exampleOut'].some((key) => pg[key].value.trim()) || attachments.items.length > 0;
  if (filled && !window.confirm('Limpar todos os campos e arquivos do Prompt Gen?')) return;
  clearAttachments();
  for (const key of [...PG_DRAFT_FIELDS, 'material', 'exampleIn', 'exampleOut']) pg[key].value = '';
  for (const key of ['type', 'tone', 'format', 'length']) pg[key].value = 'auto';
  scheduleDraftSave();
  renderPromptGen();
  pg.idea.focus();
}

fillPromptSelects();
for (const element of [pg.idea, pg.type, pg.responseLanguage, pg.context, pg.material, pg.role, pg.audience, pg.tone, pg.format, pg.length, pg.fields, pg.constraints, pg.criteria, pg.exampleIn, pg.exampleOut, pg.clarify, pg.reasoning, pg.grounding, pg.verify]) {
  element.addEventListener('input', () => { schedulePromptRender(); scheduleDraftSave(); scheduleOptionsSave(); });
  element.addEventListener('change', () => { schedulePromptRender(); scheduleDraftSave(); scheduleOptionsSave(); });
}
pg.target.addEventListener('change', () => {
  promptGen.style = PG.STYLE_BY_TARGET[pg.target.value] || 'xml';
  syncPromptSegments(); renderPromptGen(); scheduleOptionsSave();
});
pg.styleSeg.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pg-style]');
  if (button) { promptGen.style = button.dataset.pgStyle; syncPromptSegments(); renderPromptGen(); scheduleOptionsSave(); }
});
pg.langSeg.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pg-lang]');
  if (button) { promptGen.promptLanguage = button.dataset.pgLang; syncPromptSegments(); renderPromptGen(); scheduleOptionsSave(); }
});
$$('[data-pg-pane]').forEach((button) => button.addEventListener('click', () => setPromptPane(button.dataset.pgPane)));
document.addEventListener('click', (event) => {
  const trigger = event.target.closest?.('[data-pg-focus]');
  if (trigger) focusPromptField(trigger.dataset.pgFocus);
});
pg.copy.addEventListener('click', copyPrompt);
pg.save.addEventListener('click', savePromptFile);
pg.clear.addEventListener('click', clearPromptForm);
pg.attachFiles.addEventListener('click', () => chooseAttachments('files'));
pg.attachFolder.addEventListener('click', () => chooseAttachments('folder'));
pg.attachClear.addEventListener('click', clearAttachments);
pg.fileBudget.addEventListener('change', () => { renderPromptGen(); scheduleOptionsSave(); });
pg.attachList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-attach-remove]');
  if (button) removeAttachment(button.dataset.attachRemove);
});
pg.attachDrop.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseAttachments('files'); } });
{
  const view = $('#prompt-gen-view');
  for (const name of ['dragenter', 'dragover']) view.addEventListener(name, (event) => { if (hasFilePayload(event)) { event.preventDefault(); view.classList.add('dragging'); } });
  view.addEventListener('dragleave', (event) => { if (!view.contains(event.relatedTarget)) view.classList.remove('dragging'); });
  view.addEventListener('drop', (event) => { if (hasFilePayload(event)) dropAttachments(event); });
}
pg.restore.addEventListener('click', restorePromptDefaults);
renderPromptGen();
// Ctrl + Enter copies the prompt from anywhere inside the tool.
$('#prompt-gen-view').addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); copyPrompt(); }
});

/* ───────── CLAUDE.md generator ─────────
   The project folder is analysed by the main process (read-only, local); the engine (claude-md-engine.js) builds the
   document from those facts + what the user typed. Only the options are saved; project text stays in memory. */
const claudeMd = { facts: null, folder: '', result: null, language: 'pt', premisesOff: [], timer: 0 };
const CM = window.ArcClaudeMd;
const cm = {
  main: $('#cm-main'), drop: $('#cm-drop'), pick: $('#cm-pick'), card: $('#cm-card'), projectName: $('#cm-project-name'), projectPath: $('#cm-project-path'), stack: $('#cm-stack'),
  cardStats: $('#cm-card-stats'), reanalyze: $('#cm-reanalyze'), forget: $('#cm-forget'), hint: $('#cm-hint'),
  name: $('#cm-name'), audience: $('#cm-audience'), purpose: $('#cm-purpose'), prohibitions: $('#cm-prohibitions'), rules: $('#cm-rules'),
  commands: $('#cm-commands'), gotchas: $('#cm-gotchas'), architecture: $('#cm-architecture'), workflow: $('#cm-workflow'), workPreferences: $('#cm-work-preferences'),
  more: $('#cm-more'), moreCount: $('#cm-more-count'), premises: $('#cm-premises'), premisesCount: $('#cm-premises-count'),
  output: $('#cm-output'), outputMeta: $('#cm-output-meta'), score: $('#cm-score'), scoreLabel: $('#cm-score-label'), barFill: $('#cm-bar-fill'), scoreBox: $('#cm-score-box'),
  checklist: $('#cm-checklist'), alerts: $('#cm-alerts'), questionsSec: $('#cm-questions-sec'), questions: $('#cm-questions'), sections: $('#cm-sections'),
  langSeg: $('#cm-lang-seg'), detail: $('#cm-detail'), existingRow: $('#cm-existing-row'), includeExisting: $('#cm-include-existing'),
  statsMain: $('#cm-stats-main'), statsDetail: $('#cm-stats-detail'), clear: $('#cm-clear'), save: $('#cm-save'), copy: $('#cm-copy')
};
const CM_TEXT_FIELDS = ['name', 'audience', 'purpose', 'prohibitions', 'rules', 'commands', 'gotchas', 'architecture', 'workflow', 'workPreferences'];
const CM_SOURCE_LABEL = { detected: 'detectado', user: 'informado', mixed: 'misto', default: 'premissa' };
const CM_FOCUS = { purpose: 'purpose', prohibitions: 'prohibitions', gotchas: 'gotchas', commands: 'commands', rules: 'rules', project: 'drop' };

function readClaudeInput() {
  return {
    ...Object.fromEntries(CM_TEXT_FIELDS.map((key) => [key, cm[key].value])),
    language: claudeMd.language, detail: cm.detail.value, includeExisting: cm.includeExisting.checked, premisesOff: claudeMd.premisesOff
  };
}

function renderPremises() {
  const premises = CM.PREMISES;
  cm.premises.innerHTML = premises.map((premise) => `<label class="cm-premise"><input type="checkbox" data-premise="${premise.id}"${claudeMd.premisesOff.includes(premise.id) ? '' : ' checked'}><span class="cm-check"><svg class="i i-xs" aria-hidden="true"><use href="#i-check"/></svg></span><span>${escapeHtml(premise[claudeMd.language])}</span></label>`).join('');
  const on = premises.length - claudeMd.premisesOff.length;
  cm.premisesCount.textContent = `${on} de ${premises.length}`;
}

function renderClaudeMd() {
  const result = CM.generate(claudeMd.facts, readClaudeInput());
  claudeMd.result = result;

  const fragment = document.createDocumentFragment();
  let inFence = false;
  for (const line of result.markdown.split('\n')) {
    const span = document.createElement('span');
    if (/^```/.test(line)) { inFence = !inFence; span.className = 'pg-tag'; } else if (!inFence && /^#{1,6} /.test(line)) span.className = 'pg-tag';
    span.textContent = line;
    fragment.append(span, '\n');
  }
  cm.output.replaceChildren(fragment);
  cm.outputMeta.textContent = `${result.stats.lines} linhas · ≈ ${result.stats.tokens.toLocaleString('pt-BR')} tokens`;
  cm.statsMain.textContent = `${result.stats.lines} linhas · ≈ ${result.stats.tokens.toLocaleString('pt-BR')} tokens`;
  cm.statsDetail.textContent = `${claudeMd.facts ? claudeMd.facts.name : 'sem projeto'} · ${claudeMd.language === 'en' ? 'English' : 'Português'} · completude ${result.analysis.score}/100`;
  cm.copy.disabled = false;
  cm.save.disabled = false;

  const { analysis } = result;
  const level = analysis.score >= 85 ? 'great' : analysis.score >= 70 ? 'good' : analysis.score >= 50 ? 'fair' : 'low';
  cm.scoreBox.dataset.level = level;
  cm.score.textContent = String(analysis.score);
  cm.scoreLabel.textContent = analysis.label;
  cm.barFill.style.width = `${analysis.score}%`;
  cm.checklist.innerHTML = analysis.items.map((item) => `<li><button type="button" class="pg-check ${item.status}" data-cm-focus="${escapeHtml(item.field)}" title="${escapeHtml(item.detail)}">`
    + `<span class="pg-check-icon"><svg class="i i-xs" aria-hidden="true"><use href="#i-${PG_STATUS_ICON[item.status]}"/></svg></span>`
    + `<span class="pg-check-copy"><strong>${escapeHtml(item.label)}</strong>${item.status === 'ok' ? '' : `<small>${escapeHtml(item.detail)}</small>`}</span><em>${PG_STATUS_TEXT[item.status]}</em></button></li>`).join('');
  cm.alerts.innerHTML = analysis.alerts.map((alert) => `<div class="callout ${alert.level === 'warn' ? 'callout-warn' : ''}"><svg class="i" aria-hidden="true"><use href="#i-${alert.level === 'warn' ? 'alert' : 'info'}"/></svg><span>${escapeHtml(alert.text)}</span></div>`).join('');
  cm.questionsSec.classList.toggle('hidden', !analysis.questions.length);
  cm.questions.innerHTML = analysis.questions.map((question) => `<li><button type="button" data-cm-focus="${escapeHtml(question.field)}"><svg class="i i-xs" aria-hidden="true"><use href="#i-arrow-right"/></svg><span>${escapeHtml(question.text)}</span></button></li>`).join('');
  cm.sections.innerHTML = result.sections.map((section) => `<li><span>${escapeHtml(section.title)}</span><span class="cm-src ${section.source}">${CM_SOURCE_LABEL[section.source]}</span></li>`).join('');
  cm.existingRow.classList.toggle('hidden', !result.existing.claude && !(claudeMd.facts?.existing?.claude));
  updateClaudeMoreCount();
}

function updateClaudeMoreCount() {
  const filled = ['commands', 'gotchas', 'architecture', 'workflow', 'workPreferences'].filter((key) => cm[key].value.trim()).length;
  cm.moreCount.textContent = `${filled} ${filled === 1 ? 'preenchido' : 'preenchidos'}`;
  cm.moreCount.classList.toggle('hidden', !filled);
}

function renderProjectCard() {
  const facts = claudeMd.facts;
  cm.card.classList.toggle('hidden', !facts);
  cm.drop.classList.toggle('hidden', Boolean(facts));
  if (!facts) return;
  cm.projectName.textContent = facts.name;
  cm.projectPath.textContent = facts.root;
  cm.projectPath.title = facts.root;
  const chips = unique3([...facts.ecosystems.filter((item) => item.id !== 'make').map((item) => item.name), ...facts.frameworks]).slice(0, 8);
  cm.stack.innerHTML = chips.map((text) => `<span class="chip chip-accent">${escapeHtml(text)}</span>`).join('');
  const lines = facts.languages.reduce((sum, item) => sum + item.lines, 0);
  const parts = [`${facts.scanned.toLocaleString('pt-BR')} arquivos lidos`, `${formatCount(lines)} linhas de código`];
  if (facts.skippedDirectories.length) parts.push(`ignoradas: ${facts.skippedDirectories.slice(0, 4).join(', ')}`);
  if (facts.existing?.claude) parts.push('já tem CLAUDE.md');
  cm.cardStats.textContent = `${parts.join(' · ')}.`;
}

function unique3(items) { return [...new Set(items)]; }

function scheduleClaudeRender() {
  clearTimeout(claudeMd.timer);
  claudeMd.timer = setTimeout(renderClaudeMd, 90);
}

async function loadProject(promise) {
  try {
    const facts = await promise;
    if (!facts) return;
    claudeMd.facts = facts;
    claudeMd.folder = facts.root;
    renderProjectCard();
    renderClaudeMd();
    showPasteToast(`Projeto analisado: ${facts.name}.`);
  } catch (error) {
    showPasteToast(error?.message || 'Não foi possível analisar a pasta.', 'error');
  }
}

function setClaudeLanguage(language) {
  claudeMd.language = language;
  for (const button of cm.langSeg.querySelectorAll('[data-cm-lang]')) button.classList.toggle('active', button.dataset.cmLang === language);
  syncSeg(cm.langSeg);
  renderPremises();
}

async function copyClaudeMd() {
  const text = claudeMd.result?.markdown;
  if (!text) return;
  let copied = false;
  try { copied = await window.arc.writeClipboardText(text); } catch { copied = false; }
  showPasteToast(copied ? 'CLAUDE.md copiado para a área de transferência.' : 'Não foi possível copiar.', copied ? 'success' : 'error');
  if (copied) { const label = cm.copy.querySelector('span'); label.textContent = 'Copiado'; setTimeout(() => { label.textContent = 'Copiar'; }, 1600); }
}

async function saveClaudeMd() {
  const text = claudeMd.result?.markdown;
  if (!text) return;
  try {
    const savedPath = await window.arc.saveClaudeMd({ text, directory: claudeMd.folder });
    if (savedPath) showPasteToast(`CLAUDE.md salvo em ${savedPath}`);
  } catch (error) { showPasteToast(error?.message || 'Não foi possível salvar.', 'error'); }
}

function clearClaudeForm() {
  const filled = CM_TEXT_FIELDS.some((key) => cm[key].value.trim()) || claudeMd.facts;
  if (filled && !window.confirm('Limpar os campos e o projeto analisado?')) return;
  for (const key of CM_TEXT_FIELDS) cm[key].value = '';
  claudeMd.facts = null; claudeMd.folder = '';
  renderProjectCard(); renderClaudeMd();
}

function setClaudePane(pane) {
  cm.main.dataset.pane = pane;
  $$('[data-cm-pane]').forEach((button) => button.classList.toggle('active', button.dataset.cmPane === pane));
  syncSeg($('#cm-main .pg-tabs'));
}

function focusClaudeField(name) {
  const key = CM_FOCUS[name] || 'purpose';
  const element = key === 'drop' ? cm.drop : cm[key];
  if (!element) return;
  setClaudePane('form');
  if (cm.more.contains(element)) cm.more.open = true;
  element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

for (const key of CM_TEXT_FIELDS) {
  cm[key].addEventListener('input', scheduleClaudeRender);
}
cm.detail.addEventListener('change', () => { renderClaudeMd(); scheduleOptionsSave(); });
cm.includeExisting.addEventListener('change', renderClaudeMd);
cm.langSeg.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cm-lang]');
  if (button) { setClaudeLanguage(button.dataset.cmLang); renderClaudeMd(); scheduleOptionsSave(); }
});
cm.premises.addEventListener('change', (event) => {
  const box = event.target.closest('[data-premise]');
  if (!box) return;
  claudeMd.premisesOff = box.checked ? claudeMd.premisesOff.filter((id) => id !== box.dataset.premise) : [...new Set([...claudeMd.premisesOff, box.dataset.premise])];
  renderPremises(); renderClaudeMd(); scheduleOptionsSave();
});
cm.pick.addEventListener('click', () => loadProject(window.arc.selectProject()));
cm.drop.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); loadProject(window.arc.selectProject()); } });
cm.reanalyze.addEventListener('click', () => { if (claudeMd.folder) loadProject(window.arc.analyzeProject(claudeMd.folder)); });
cm.forget.addEventListener('click', () => { claudeMd.facts = null; claudeMd.folder = ''; renderProjectCard(); renderClaudeMd(); });
cm.copy.addEventListener('click', copyClaudeMd);
cm.save.addEventListener('click', saveClaudeMd);
cm.clear.addEventListener('click', clearClaudeForm);
$$('[data-cm-pane]').forEach((button) => button.addEventListener('click', () => setClaudePane(button.dataset.cmPane)));
document.addEventListener('click', (event) => { const trigger = event.target.closest?.('[data-cm-focus]'); if (trigger) focusClaudeField(trigger.dataset.cmFocus); });
{
  const view = $('#claude-md-view');
  for (const name of ['dragenter', 'dragover']) view.addEventListener(name, (event) => { if (hasFilePayload(event)) { event.preventDefault(); view.classList.add('dragging'); } });
  view.addEventListener('dragleave', (event) => { if (!view.contains(event.relatedTarget)) view.classList.remove('dragging'); });
  view.addEventListener('drop', (event) => {
    if (!hasFilePayload(event)) return;
    event.preventDefault(); view.classList.remove('dragging');
    const [file] = [...event.dataTransfer.files];
    const folder = file && window.arc.getPathForFile(file);
    if (folder) loadProject(window.arc.analyzeProject(folder));
  });
  view.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); copyClaudeMd(); } });
}
renderPremises();
renderClaudeMd();

/* ───────── QR Code generator ─────────
   Engines: qr-payload.js (what the code says), qr-render.js (how it looks, one SVG), qr-templates.js (presets).
   The matrix, files and the real scan check live in the main process (src/qr.mjs). Only the visual design is saved;
   what the code says (Wi-Fi passwords, phone numbers…) stays in memory. */
const qrR = window.ArcQrRender;
const qrP = window.ArcQrPayload;
const qrT = window.ArcQrTemplates;
const qr = {
  design: qrR.sanitizeDesign({}), fields: {}, info: null, sample: null, usingSample: true, payload: { text: '', errors: [], warnings: [], empty: true }, matrixError: '',
  assets: { art: {}, inter: '', logoImage: '', logoName: '', artDirectory: '' }, history: [], future: [], lastPush: 0, lastGroup: '', custom: [],
  tab: 'templates', render: null, renderTimer: 0, verifyTimer: 0, verifySeq: 0, renderSeq: 0, matrixCache: new Map(), controls: [],
  exportFormat: 'png', exportWidth: 2048, printMm: 0, verify: { state: 'idle', text: '' }, galleries: { templates: '', layouts: '' }, ready: false
};
const qrEl = {
  view: $('#qr-generator-view'), main: $('#qr-main'), tabs: $('#qr-tabs'), panels: $('#qr-panels'), preview: $('#qr-preview'), stage: $('#qr-stage'), stageNote: $('#qr-stage-note'),
  status: $('#qr-status'), undo: $('#qr-undo'), redo: $('#qr-redo'), checks: $('#qr-checks'), info: $('#qr-info'), formatSeg: $('#qr-format-seg'), width: $('#qr-export-width'),
  widthField: $('#qr-width-field'), printMm: $('#qr-print-mm'), exportNote: $('#qr-export-note'), reset: $('#qr-reset'), statsMain: $('#qr-stats-main'), statsDetail: $('#qr-stats-detail'),
  verifyBtn: $('#qr-verify'), copy: $('#qr-copy'), save: $('#qr-save'), paneTabs: $('#qr-pane-tabs')
};

const QR_TAB_ORDER = ['templates', 'content', 'code', 'logo', 'frame', 'texts'];
const QR_ECL_OPTIONS = [['auto', 'Automática (recomendado)'], ['L', 'L · 7% (código mais simples)'], ['M', 'M · 15%'], ['Q', 'Q · 25%'], ['H', 'H · 30% (ideal com logo)']];
const QR_MASK_OPTIONS = [['auto', 'Automática (recomendado)'], ...[0, 1, 2, 3, 4, 5, 6, 7].map((value) => [String(value), `Padrão ${value}`])];
const QR_ROLE_LABEL = { title: 'Título', subtitle: 'Subtítulo', cta: 'Chamada (botão)', footer: 'Rodapé' };
const QR_WEIGHT_OPTIONS = [['400', 'Normal'], ['600', 'Seminegrito'], ['700', 'Negrito'], ['800', 'Extranegrito']];
const QR_TYPE_NAMES = Object.fromEntries(qrP.TYPES.map((type) => [type.id, type.label]));

const qrShown = (path, kind) => (design) => {
  const value = qrR.getPath(design, path);
  return Array.isArray(kind) ? kind.includes(value) : value === kind;
};
const qrOptions = (list) => list.map((item) => (Array.isArray(item) ? item : [item.id, item.name]));

/* Every control below maps to one leaf of the design schema (ArcQrRender.SPEC). */
const QR_CODE_SECTIONS = [
  { title: 'Módulos (os quadradinhos)', controls: [
    { path: 'modules.shape', label: 'Formato', kind: 'select', options: qrOptions(qrR.SHAPES) },
    { path: 'modules.scale', label: 'Tamanho dentro da célula', kind: 'range', min: 40, max: 100, unit: '%', hint: 'Menos de 90% deixa o código leve, mas mais difícil de ler.' }
  ] },
  { title: 'Olhos (os três cantos)', controls: [
    { path: 'eyes.outer', label: 'Moldura do olho', kind: 'select', options: qrOptions(qrR.EYE_OUTER) },
    { path: 'eyes.inner', label: 'Centro do olho', kind: 'select', options: qrOptions(qrR.EYE_INNER) },
    { path: 'eyes.custom', label: 'Cores próprias nos olhos', kind: 'switch' },
    { path: 'eyes.outerColor', label: 'Cor da moldura', kind: 'color', showIf: qrShown('eyes.custom', true) },
    { path: 'eyes.innerColor', label: 'Cor do centro', kind: 'color', showIf: qrShown('eyes.custom', true) }
  ] },
  { title: 'Cor do código', controls: [
    { path: 'fill.mode', label: 'Tipo', kind: 'seg', options: [['solid', 'Sólida'], ['linear', 'Degradê'], ['radial', 'Radial']] },
    { path: 'fill.c1', label: 'Cor 1', kind: 'color' },
    { path: 'fill.c2', label: 'Cor 2', kind: 'color', showIf: qrShown('fill.mode', ['linear', 'radial']) },
    { path: 'fill.angle', label: 'Ângulo do degradê', kind: 'range', min: 0, max: 360, unit: '°', showIf: qrShown('fill.mode', 'linear') }
  ] },
  { title: 'Fundo do código', controls: [
    { path: 'background.mode', label: 'Tipo', kind: 'seg', options: [['solid', 'Sólido'], ['linear', 'Degradê'], ['transparent', 'Transparente']] },
    { path: 'background.c1', label: 'Cor 1', kind: 'color', showIf: qrShown('background.mode', ['solid', 'linear']) },
    { path: 'background.c2', label: 'Cor 2', kind: 'color', showIf: qrShown('background.mode', 'linear') },
    { path: 'background.angle', label: 'Ângulo', kind: 'range', min: 0, max: 360, unit: '°', showIf: qrShown('background.mode', 'linear') },
    { action: 'invert', label: 'Inverter cores (claro sobre escuro)', kind: 'button' }
  ] },
  { title: 'Margem e placa', controls: [
    { path: 'margin', label: 'Margem (zona silenciosa)', kind: 'range', min: 0, max: 12, unit: ' módulos', hint: 'O padrão do QR Code é 4. Menos que isso pode impedir a leitura.' },
    { path: 'block.radius', label: 'Cantos da placa', kind: 'range', min: 0, max: 25, unit: '%' },
    { path: 'block.borderWidth', label: 'Borda da placa', kind: 'range', min: 0, max: 24, unit: '' },
    { path: 'block.borderColor', label: 'Cor da borda', kind: 'color', showIf: (design) => design.block.borderWidth > 0 },
    { path: 'block.shadow', label: 'Sombra sob a placa', kind: 'switch' }
  ] },
  { title: 'Avançado do QR', controls: [
    { path: 'ecl', label: 'Correção de erros', kind: 'select', options: QR_ECL_OPTIONS, hint: 'Mais correção suporta mais dano e logo, mas gera um código mais denso.' },
    { path: 'mask', label: 'Padrão de máscara', kind: 'select', options: QR_MASK_OPTIONS },
    { path: 'version', label: 'Versão mínima (0 = automática)', kind: 'range', min: 0, max: 40, unit: '' }
  ] }
];

const QR_LOGO_CONTROLS = [
  { path: 'logo.kind', label: 'Tipo de logo', kind: 'seg', options: [['none', 'Nenhum'], ['icon', 'Ícone'], ['text', 'Texto'], ['image', 'Imagem']] },
  { path: 'logo.icon', label: 'Ícone', kind: 'select', options: Object.keys(qrR.ICONS).map((id) => [id, qrR.ICON_NAMES[id] || id]), showIf: qrShown('logo.kind', 'icon') },
  { path: 'logo.text', label: 'Texto (até 6 letras)', kind: 'text', max: 6, showIf: qrShown('logo.kind', 'text') },
  { action: 'logo-image', label: 'Escolher imagem do logo…', kind: 'button', showIf: qrShown('logo.kind', 'image') },
  { path: 'logo.size', label: 'Tamanho do logo', kind: 'range', min: 8, max: 32, unit: '%', showIf: (design) => design.logo.kind !== 'none' },
  { path: 'logo.shape', label: 'Formato da placa', kind: 'seg', options: [['circle', 'Círculo'], ['rounded', 'Arredondada'], ['square', 'Quadrada']], showIf: (design) => design.logo.kind !== 'none' },
  { path: 'logo.plate', label: 'Placa atrás do logo', kind: 'switch', showIf: (design) => design.logo.kind !== 'none' },
  { path: 'logo.plateColor', label: 'Cor da placa', kind: 'color', showIf: (design) => design.logo.kind !== 'none' && design.logo.plate },
  { path: 'logo.color', label: 'Cor do ícone/texto', kind: 'color', showIf: qrShown('logo.kind', ['icon', 'text']) },
  { path: 'logo.padding', label: 'Respiro interno', kind: 'range', min: 0, max: 40, unit: '%', showIf: (design) => design.logo.kind !== 'none' },
  { path: 'logo.borderWidth', label: 'Borda da placa', kind: 'range', min: 0, max: 12, unit: '', showIf: (design) => design.logo.kind !== 'none' },
  { path: 'logo.borderColor', label: 'Cor da borda', kind: 'color', showIf: (design) => design.logo.kind !== 'none' && design.logo.borderWidth > 0 },
  { path: 'logo.clear', label: 'Apagar os módulos sob o logo', kind: 'switch', hint: 'Desligado: o logo fica por cima e depende só da correção de erros.', showIf: (design) => design.logo.kind !== 'none' }
];

const qrHasLayout = (design) => design.layout.id !== 'plain';
const QR_FRAME_CONTROLS = [
  { path: 'layout.radius', label: 'Cantos arredondados do cartão', kind: 'range', min: 0, max: 30, unit: '%', showIf: qrHasLayout },
  { title: 'Fundo do cartão', showIf: qrHasLayout },
  { path: 'layout.bg.mode', label: 'Tipo', kind: 'seg', options: [['solid', 'Sólido'], ['linear', 'Degradê'], ['radial', 'Radial'], ['transparent', 'Nenhum']], showIf: qrHasLayout },
  { path: 'layout.bg.c1', label: 'Cor 1', kind: 'color', showIf: (design) => qrHasLayout(design) && design.layout.bg.mode !== 'transparent' },
  { path: 'layout.bg.c2', label: 'Cor 2', kind: 'color', showIf: (design) => qrHasLayout(design) && ['linear', 'radial'].includes(design.layout.bg.mode) },
  { path: 'layout.bg.angle', label: 'Ângulo', kind: 'range', min: 0, max: 360, unit: '°', showIf: (design) => qrHasLayout(design) && design.layout.bg.mode === 'linear' },
  { title: 'Imagem de fundo', showIf: qrHasLayout },
  { path: 'layout.bg.art', label: 'Arte', kind: 'art', artKind: 'bg', showIf: qrHasLayout },
  { action: 'bg-import', label: 'Importar imagem de fundo…', kind: 'button', showIf: qrHasLayout },
  { path: 'layout.bg.artFit', label: 'Ajuste', kind: 'seg', options: [['cover', 'Preencher'], ['contain', 'Conter']], showIf: (design) => qrHasLayout(design) && Boolean(design.layout.bg.art) },
  { path: 'layout.bg.artOpacity', label: 'Opacidade da arte', kind: 'range', min: 0, max: 100, unit: '%', showIf: (design) => qrHasLayout(design) && Boolean(design.layout.bg.art) },
  { path: 'layout.bg.overlay', label: 'Película escura/clara por cima', kind: 'range', min: 0, max: 90, unit: '%', showIf: qrHasLayout },
  { path: 'layout.bg.overlayColor', label: 'Cor da película', kind: 'color', showIf: (design) => qrHasLayout(design) && design.layout.bg.overlay > 0 },
  { title: 'Decoração vetorial', showIf: qrHasLayout },
  { path: 'layout.deco', label: 'Padrão (some quando há imagem de fundo)', kind: 'select', options: qrOptions(qrR.DECOS), showIf: qrHasLayout },
  { path: 'layout.decoColor', label: 'Cor do padrão', kind: 'color', showIf: (design) => qrHasLayout(design) && design.layout.deco !== 'none' },
  { path: 'layout.decoOpacity', label: 'Intensidade', kind: 'range', min: 0, max: 100, unit: '%', showIf: (design) => qrHasLayout(design) && design.layout.deco !== 'none' },
  { title: 'Ornamento (imagem com transparência)', showIf: qrHasLayout },
  { path: 'layout.ornament', label: 'Ornamento', kind: 'art', artKind: 'orn', showIf: qrHasLayout },
  { action: 'orn-import', label: 'Importar ornamento…', kind: 'button', showIf: qrHasLayout },
  { path: 'layout.ornamentPos', label: 'Posição', kind: 'select', options: [['corners', 'Cantos opostos'], ['tl', 'Canto superior esquerdo'], ['tr', 'Canto superior direito'], ['bl', 'Canto inferior esquerdo'], ['br', 'Canto inferior direito'], ['top', 'Topo'], ['bottom', 'Base'], ['center', 'Centro (molduras)']], showIf: (design) => qrHasLayout(design) && Boolean(design.layout.ornament) },
  { path: 'layout.ornamentScale', label: 'Tamanho (molduras: 100%)', kind: 'range', min: 8, max: 110, unit: '%', showIf: (design) => qrHasLayout(design) && Boolean(design.layout.ornament) },
  { path: 'layout.ornamentOpacity', label: 'Opacidade', kind: 'range', min: 0, max: 100, unit: '%', showIf: (design) => qrHasLayout(design) && Boolean(design.layout.ornament) }
];

/* ───────── helpers ───────── */
const qrErrorText = (error) => String(error?.message || error || 'Erro desconhecido').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
const qrSvgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const qrAssetsForRender = () => ({ art: qr.assets.art, logoImage: qr.assets.logoImage, fonts: { inter: qr.assets.inter } });
const qrFieldsOf = (type) => (qr.fields[type] ||= qrP.defaultFields(type));
const qrSnapshot = () => JSON.stringify(qr.design);

function qrTemplateDesign(template) {
  const merged = qrR.mergeDeep(qrR.clone(qrR.DEFAULT_DESIGN), template.patch || template.design || {});
  const design = qrR.sanitizeDesign(merged);
  design.type = qr.design.type;
  return design;
}

/* ───────── controls ───────── */
function qrBuildControl(spec) {
  if (spec.title) { const heading = document.createElement('h4'); heading.className = 'qr-sub'; heading.textContent = spec.title; qr.controls.push({ el: heading, showIf: spec.showIf, kind: 'heading' }); return heading; }
  const entry = { spec, showIf: spec.showIf, kind: spec.kind };
  let wrapper;
  if (spec.kind === 'button') {
    wrapper = document.createElement('button');
    wrapper.type = 'button'; wrapper.className = 'btn btn-sm qr-action'; wrapper.textContent = spec.label;
    wrapper.addEventListener('click', () => qrAction(spec.action));
  } else if (spec.kind === 'switch') {
    wrapper = document.createElement('label'); wrapper.className = 'switch-row';
    wrapper.innerHTML = `<span class="switch-copy"><strong></strong>${spec.hint ? '<small></small>' : ''}</span><input type="checkbox"><span class="switch"></span>`;
    wrapper.querySelector('strong').textContent = spec.label;
    if (spec.hint) wrapper.querySelector('small').textContent = spec.hint;
    entry.input = wrapper.querySelector('input');
    entry.input.addEventListener('change', () => qrChange(spec.path, entry.input.checked));
  } else {
    wrapper = document.createElement('div'); wrapper.className = 'field qr-ctl';
    const label = document.createElement('span'); label.textContent = spec.label; wrapper.append(label);
    if (spec.kind === 'select' || spec.kind === 'art') {
      entry.input = document.createElement('select'); wrapper.append(entry.input);
      if (spec.kind === 'select') entry.input.append(...spec.options.map(([value, text]) => new Option(text, value)));
      entry.input.addEventListener('change', () => qrChange(spec.path, entry.input.value));
    } else if (spec.kind === 'range') {
      const row = document.createElement('div'); row.className = 'qr-range';
      entry.input = document.createElement('input'); entry.input.type = 'range'; entry.input.min = spec.min; entry.input.max = spec.max; entry.input.step = spec.step || 1;
      entry.output = document.createElement('output'); entry.output.className = 'num';
      row.append(entry.input, entry.output); wrapper.append(row);
      entry.input.addEventListener('input', () => { entry.output.textContent = `${entry.input.value}${spec.unit || ''}`; setRangeFill(entry.input); qrChange(spec.path, Number(entry.input.value), spec.path); });
    } else if (spec.kind === 'color') {
      const row = document.createElement('div'); row.className = 'qr-color';
      entry.input = document.createElement('input'); entry.input.type = 'color'; entry.input.setAttribute('aria-label', spec.label);
      entry.hex = document.createElement('input'); entry.hex.type = 'text'; entry.hex.maxLength = 7; entry.hex.spellcheck = false; entry.hex.className = 'pg-mono'; entry.hex.setAttribute('aria-label', `${spec.label} (hexadecimal)`);
      row.append(entry.input, entry.hex); wrapper.append(row);
      entry.input.addEventListener('input', () => { entry.hex.value = entry.input.value; qrChange(spec.path, entry.input.value, spec.path); });
      entry.hex.addEventListener('input', () => { const value = entry.hex.value.trim().startsWith('#') ? entry.hex.value.trim() : `#${entry.hex.value.trim()}`; if (/^#[0-9a-f]{6}$/i.test(value)) { entry.input.value = value.toLowerCase(); qrChange(spec.path, value.toLowerCase(), spec.path); } });
      entry.hex.addEventListener('blur', () => { entry.hex.value = qrR.getPath(qr.design, spec.path); });
    } else if (spec.kind === 'seg') {
      entry.input = document.createElement('div'); entry.input.className = 'seg seg-block'; entry.input.setAttribute('role', 'group'); entry.input.setAttribute('aria-label', spec.label);
      entry.input.innerHTML = '<span class="seg-thumb" aria-hidden="true"></span>';
      for (const [value, text] of spec.options) { const button = document.createElement('button'); button.type = 'button'; button.className = 'seg-item'; button.dataset.value = value; button.textContent = text; entry.input.append(button); }
      wrapper.append(entry.input); segObserver.observe(entry.input);
      entry.input.addEventListener('click', (event) => { const button = event.target.closest('.seg-item'); if (button) qrChange(spec.path, button.dataset.value); });
    } else {
      entry.input = document.createElement('input'); entry.input.type = 'text'; if (spec.max) entry.input.maxLength = spec.max; entry.input.spellcheck = false; wrapper.append(entry.input);
      entry.input.addEventListener('input', () => qrChange(spec.path, entry.input.value, spec.path));
    }
    if (spec.hint) { const hint = document.createElement('small'); hint.className = 'qr-hint'; hint.textContent = spec.hint; wrapper.append(hint); }
  }
  entry.el = wrapper;
  qr.controls.push(entry);
  return wrapper;
}

function qrSyncControl(entry) {
  const { spec } = entry;
  if (!spec || !spec.path) return;
  const value = qrR.getPath(qr.design, spec.path);
  if (spec.kind === 'switch') entry.input.checked = Boolean(value);
  else if (spec.kind === 'range') { entry.input.value = value; entry.output.textContent = `${value}${spec.unit || ''}`; setRangeFill(entry.input); }
  else if (spec.kind === 'color') { entry.input.value = value; if (document.activeElement !== entry.hex) entry.hex.value = value; }
  else if (spec.kind === 'seg') { for (const button of entry.input.querySelectorAll('.seg-item')) button.classList.toggle('active', button.dataset.value === String(value)); syncSeg(entry.input); }
  else if (spec.kind === 'art') qrFillArtSelect(entry, value);
  else if (document.activeElement !== entry.input) entry.input.value = value;
}

function qrFillArtSelect(entry, current) {
  const wanted = entry.spec.artKind;
  const options = [['', 'Nenhuma']];
  for (const art of Object.values(qr.assets.art)) {
    const known = qrT.ART.find((item) => item.id === art.id);
    const kind = known ? known.kind : art.id.startsWith('custom-orn') ? 'orn' : art.id.startsWith('custom-bg') ? 'bg' : art.id.startsWith('bg-') ? 'bg' : (art.id.startsWith('orn-') || art.id.startsWith('frame-')) ? 'orn' : 'any';
    if (kind === 'any' || kind === wanted || (wanted === 'orn' && kind === 'frame')) options.push([art.id, known ? known.name : art.id.startsWith('custom') ? art.name || 'Minha imagem' : art.id]);
  }
  if (current && !options.some(([value]) => value === current)) options.push([current, `${current} (arquivo ausente)`]);
  const signature = JSON.stringify(options);
  if (entry.signature !== signature) { entry.signature = signature; entry.input.replaceChildren(...options.map(([value, text]) => new Option(text, value))); }
  entry.input.value = current;
}

function qrUpdateVisibility() {
  for (const entry of qr.controls) if (entry.showIf) entry.el.classList.toggle('hidden', !entry.showIf(qr.design));
}
function qrSyncAllControls() {
  for (const entry of qr.controls) qrSyncControl(entry);
  qrUpdateVisibility();
  for (const entry of qr.controls) if (entry.kind === 'seg' && !entry.el.classList.contains('hidden')) syncSeg(entry.input);
}

/* ───────── design changes (with undo) ───────── */
function qrPushHistory(group) {
  const now = Date.now();
  const snapshot = qrSnapshot();
  if (qr.history.length && qr.history[qr.history.length - 1] === snapshot) return;
  if (group && group === qr.lastGroup && now - qr.lastPush < 900 && qr.history.length > 1) qr.history[qr.history.length - 1] = snapshot;
  else qr.history.push(snapshot);
  if (qr.history.length > 80) qr.history.shift();
  qr.lastPush = now; qr.lastGroup = group || '';
  qr.future = [];
  qrUpdateHistoryButtons();
}
function qrUpdateHistoryButtons() {
  qrEl.undo.disabled = qr.history.length < 2;
  qrEl.redo.disabled = qr.future.length === 0;
}
function qrRestore(snapshot) {
  qr.design = qrR.sanitizeDesign(JSON.parse(snapshot));
  qrSyncAll();
}
function qrUndo() { if (qr.history.length < 2) return; qr.future.push(qr.history.pop()); qrRestore(qr.history[qr.history.length - 1]); qrUpdateHistoryButtons(); }
function qrRedo() { if (!qr.future.length) return; const snapshot = qr.future.pop(); qr.history.push(snapshot); qrRestore(snapshot); qrUpdateHistoryButtons(); }

function qrChange(path, value, group) {
  qrR.setPath(qr.design, path, value);
  qr.design = qrR.sanitizeDesign(qr.design);
  qrPushHistory(group || path);
  qrSyncAllControls(); // keeps segmented buttons, visibility and linked values in step with the design
  qrAfterDesign(path);
}
function qrAfterDesign(path = '') {
  if (path.startsWith('layout.id') || path.startsWith('layout.')) qr.galleries.layouts = '';
  qr.galleries.templates = '';
  qrScheduleRender();
  qrScheduleSave();
  if (path === 'logo.kind' || path === 'layout.id') qrRefreshTextsPanel();
}
function qrSyncAll() {
  qrSyncAllControls();
  qrRefreshContentPanel();
  qrRefreshTextsPanel();
  qrRenderGalleriesIfVisible();
  qrScheduleRender();
  qrScheduleSave();
}

function qrAction(action) {
  if (action === 'invert') {
    const { fill, background } = qr.design;
    const swap = fill.c1;
    qr.design.fill.c1 = background.c1; qr.design.background.c1 = swap;
    qr.design.background.mode = qr.design.background.mode === 'transparent' ? 'solid' : qr.design.background.mode;
    qrPushHistory('invert'); qrSyncAllControls(); qrAfterDesign('fill.c1');
  } else if (action === 'logo-image') qrImportImage('logo');
  else if (action === 'bg-import') qrImportImage('bg');
  else if (action === 'orn-import') qrImportImage('orn');
}

async function qrImportImage(purpose) {
  try {
    const image = await window.arc.qrImportImage(purpose === 'logo' ? 'logo' : 'image');
    if (!image) return;
    if (purpose === 'logo') { qr.assets.logoImage = image.dataUrl; qr.assets.logoName = image.name; qr.design.logo.kind = 'image'; }
    else {
      const id = purpose === 'bg' ? 'custom-bg' : 'custom-orn';
      qr.assets.art[id] = { id, name: image.name, dataUrl: image.dataUrl, width: image.width, height: image.height, hasAlpha: image.hasAlpha };
      if (purpose === 'bg') qr.design.layout.bg.art = id; else qr.design.layout.ornament = id;
    }
    qrPushHistory('import'); qrSyncAllControls(); qrAfterDesign('logo.kind');
    showPasteToast(`${purpose === 'logo' ? 'Logo' : 'Imagem'} carregado: ${image.name}`);
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}

/* ───────── content (type + fields) ───────── */
const qrContent = {};
function qrBuildContentPanel(panel) {
  const grid = document.createElement('div'); grid.className = 'qr-types'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Tipo de conteúdo');
  for (const type of qrP.TYPES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'qr-type'; button.dataset.type = type.id;
    button.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${type.icon}"/></svg><span></span>`;
    button.querySelector('span').textContent = type.label;
    button.addEventListener('click', () => { qr.design.type = type.id; qrPushHistory('type'); qrRefreshContentPanel(); qrScheduleRender(); qrScheduleSave(); });
    grid.append(button);
  }
  qrContent.grid = grid;
  qrContent.hint = document.createElement('p'); qrContent.hint.className = 'pg-attach-note';
  qrContent.form = document.createElement('div'); qrContent.form.className = 'qr-fields';
  qrContent.messages = document.createElement('div'); qrContent.messages.className = 'qr-messages';
  const actions = document.createElement('div'); actions.className = 'qr-row-actions';
  const sample = document.createElement('button'); sample.type = 'button'; sample.className = 'btn btn-sm btn-ghost'; sample.textContent = 'Preencher exemplo';
  sample.addEventListener('click', qrFillSample);
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn btn-sm btn-ghost btn-danger'; clear.textContent = 'Limpar conteúdo';
  clear.addEventListener('click', () => { qr.fields[qr.design.type] = qrP.defaultFields(qr.design.type); qrRenderFields(); qrScheduleRender(); });
  actions.append(sample, clear);
  panel.append(grid, qrContent.hint, qrContent.form, qrContent.messages, actions);
}
const QR_SAMPLES = {
  url: { url: 'https://arcxp.online' }, text: { text: 'Olá! Este texto está dentro de um QR Code.' },
  wifi: { ssid: 'MinhaRede', password: 'senha-segura-123', security: 'WPA', hidden: false },
  vcard: { first: 'Maria', last: 'Silva', org: 'Studio Silva', title: 'Designer', mobile: '+55 11 99999-9999', email: 'maria@exemplo.com', website: 'exemplo.com.br', city: 'São Paulo', state: 'SP', country: 'Brasil' },
  whatsapp: { number: '5511999999999', message: 'Olá! Vim pelo QR Code.' }, email: { to: 'contato@exemplo.com', subject: 'Contato pelo QR Code', body: 'Olá!' },
  phone: { number: '+55 11 99999-9999' }, sms: { number: '+55 11 99999-9999', message: 'Olá!' },
  geo: { lat: '-23.5505', lon: '-46.6333', label: 'Praça da Sé', mode: 'maps' },
  event: { title: 'Festa de aniversário', location: 'Salão de festas', start: '2027-03-20T20:00', end: '2027-03-21T00:00', allDay: false, description: 'Confirme presença!' },
  pix: { key: 'exemplo@email.com', name: 'LOJA EXEMPLO', city: 'SAO PAULO', amount: '25,90', txid: 'LOJA2027', description: 'Pedido' },
  social: { network: 'instagram', user: 'arcanoxp' }
};
function qrFillSample() {
  qr.fields[qr.design.type] = { ...qrP.defaultFields(qr.design.type), ...(QR_SAMPLES[qr.design.type] || {}) };
  qrRenderFields(); qrScheduleRender();
}
function qrRefreshContentPanel() {
  if (!qrContent.grid) return;
  for (const button of qrContent.grid.children) button.classList.toggle('active', button.dataset.type === qr.design.type);
  qrContent.hint.textContent = qrP.typeById(qr.design.type).hint;
  qrRenderFields();
}
function qrRenderFields() {
  const type = qrP.typeById(qr.design.type);
  const values = qrFieldsOf(type.id);
  qrContent.form.replaceChildren();
  for (const field of type.fields) {
    let control;
    if (field.kind === 'checkbox') {
      control = document.createElement('label'); control.className = 'switch-row';
      control.innerHTML = '<span class="switch-copy"><strong></strong></span><input type="checkbox"><span class="switch"></span>';
      control.querySelector('strong').textContent = field.label;
      const input = control.querySelector('input'); input.checked = Boolean(values[field.key]);
      input.addEventListener('change', () => { values[field.key] = input.checked; qrScheduleRender(); });
    } else {
      control = document.createElement('label'); control.className = 'field';
      const label = document.createElement('span'); label.textContent = field.label;
      if (field.required) { const mark = document.createElement('small'); mark.textContent = 'obrigatório'; label.append(mark); }
      let input;
      if (field.kind === 'textarea') { input = document.createElement('textarea'); input.rows = field.rows || 3; }
      else if (field.kind === 'select') { input = document.createElement('select'); input.append(...field.options.map(([value, text]) => new Option(text, value))); }
      else { input = document.createElement('input'); input.type = field.kind === 'datetime' ? 'datetime-local' : 'text'; }
      if (field.max && field.kind !== 'select') input.maxLength = field.max;
      if (field.placeholder) input.placeholder = field.placeholder;
      input.spellcheck = false;
      input.value = values[field.key] === '' && field.kind === 'select' ? field.value || '' : values[field.key];
      if (field.kind === 'select' && !values[field.key]) values[field.key] = input.value;
      input.addEventListener(field.kind === 'select' ? 'change' : 'input', () => { values[field.key] = input.value; qrScheduleRender(); });
      control.append(label, input);
    }
    qrContent.form.append(control);
  }
}

/* ───────── texts panel ───────── */
const qrTextsBox = {};
function qrBuildTextsPanel(panel) {
  qrTextsBox.note = document.createElement('p'); qrTextsBox.note.className = 'pg-attach-note';
  qrTextsBox.body = document.createElement('div'); qrTextsBox.body.className = 'qr-text-blocks';
  panel.append(qrTextsBox.note, qrTextsBox.body);
  for (const role of ['title', 'subtitle', 'cta', 'footer']) {
    const block = document.createElement('section'); block.className = 'qr-block'; block.dataset.role = role;
    const head = document.createElement('h4'); head.className = 'qr-sub'; head.textContent = QR_ROLE_LABEL[role];
    block.append(head);
    const specs = [
      { path: `layout.texts.${role}.on`, label: 'Mostrar', kind: 'switch' },
      { path: `layout.texts.${role}.text`, label: 'Texto', kind: 'text', max: 120 },
      { path: `layout.texts.${role}.color`, label: 'Cor do texto', kind: 'color' },
      { path: `layout.texts.${role}.font`, label: 'Fonte', kind: 'select', options: qrOptions(qrR.FONTS) },
      { path: `layout.texts.${role}.weight`, label: 'Peso', kind: 'select', options: QR_WEIGHT_OPTIONS },
      { path: `layout.texts.${role}.size`, label: 'Tamanho', kind: 'range', min: 40, max: 220, unit: '%' },
      { path: `layout.texts.${role}.caps`, label: 'Tudo em maiúsculas', kind: 'switch' }
    ];
    if (role === 'cta') specs.push({ path: 'layout.texts.cta.pill', label: 'Botão', kind: 'seg', options: [['pill', 'Preenchido'], ['outline', 'Contorno'], ['none', 'Só texto']] }, { path: 'layout.texts.cta.pillColor', label: 'Cor do botão', kind: 'color', showIf: (design) => design.layout.texts.cta.pill !== 'none' });
    for (const spec of specs) block.append(qrBuildControl(spec));
    qrTextsBox.body.append(block);
  }
}
function qrRefreshTextsPanel() {
  if (!qrTextsBox.note) return;
  const layout = qrR.LAYOUTS.find((item) => item.id === qr.design.layout.id) || qrR.LAYOUTS[0];
  qrTextsBox.note.textContent = layout.roles.length ? `Moldura atual: ${layout.name}. Textos que ela não usa ficam desativados.` : 'A moldura "Só o código" não tem textos. Escolha outra na aba Moldura para usar títulos e chamadas.';
  for (const block of qrTextsBox.body.children) block.classList.toggle('qr-off', !layout.roles.includes(block.dataset.role));
}

/* ───────── galleries (templates and layouts) ───────── */
function qrThumb(design, title, caption, active, onClick) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `qr-tile${active ? ' active' : ''}`; button.title = title;
  const picture = document.createElement('span'); picture.className = 'qr-tile-img';
  const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.decoding = 'async';
  try { image.src = qrSvgUrl(qrR.render(design, qr.sample || qr.info, qrAssetsForRender()).svg); } catch { image.alt = 'Prévia indisponível'; }
  picture.append(image);
  const label = document.createElement('span'); label.className = 'qr-tile-name'; label.textContent = caption;
  button.append(picture, label);
  button.addEventListener('click', onClick);
  return button;
}

function qrApplyTemplate(template) {
  const keepEmptyType = qr.payload.empty && template.type;
  const design = qrTemplateDesign(template);
  if (keepEmptyType) design.type = template.type;
  qr.design = design;
  qrPushHistory('template');
  qrSyncAll();
  showPasteToast(`Modelo aplicado: ${template.name}.`);
}

function qrRenderTemplates(panel) {
  const signature = `${Object.keys(qr.assets.art).length}|${qr.custom.length}|${qr.sample ? 1 : 0}`;
  if (qr.galleries.templates === signature && panel.childElementCount) return;
  qr.galleries.templates = signature;
  panel.replaceChildren();
  const save = document.createElement('div'); save.className = 'qr-save-template';
  const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40; name.placeholder = 'Nome do meu modelo'; name.setAttribute('aria-label', 'Nome do modelo');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-sm'; button.textContent = 'Salvar o visual atual como modelo';
  button.addEventListener('click', () => {
    const title = name.value.trim() || `Meu modelo ${qr.custom.length + 1}`;
    const design = qrR.clone(qr.design); delete design.type;
    qr.custom.push({ id: `meu-${Date.now().toString(36)}`, name: title.slice(0, 40), design });
    qr.custom = qr.custom.slice(-40);
    name.value = ''; qr.galleries.templates = ''; qrRenderGalleriesIfVisible(); qrScheduleSave();
    showPasteToast(`Modelo salvo: ${title}.`);
  });
  save.append(name, button);
  panel.append(save);

  if (qr.custom.length) {
    const group = document.createElement('section'); const heading = document.createElement('h4'); heading.className = 'qr-sub'; heading.textContent = 'Meus modelos';
    const grid = document.createElement('div'); grid.className = 'qr-grid';
    for (const item of qr.custom) {
      const tile = qrThumb(qrTemplateDesign(item), item.name, item.name, false, () => qrApplyTemplate(item));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'qr-tile-x'; remove.title = `Excluir "${item.name}"`; remove.setAttribute('aria-label', `Excluir ${item.name}`); remove.innerHTML = '<svg class="i i-xs" aria-hidden="true"><use href="#i-x"/></svg>';
      remove.addEventListener('click', (event) => { event.stopPropagation(); qr.custom = qr.custom.filter((candidate) => candidate.id !== item.id); qr.galleries.templates = ''; qrRenderGalleriesIfVisible(); qrScheduleSave(); });
      const cell = document.createElement('div'); cell.className = 'qr-cell'; cell.append(tile, remove); grid.append(cell);
    }
    group.append(heading, grid); panel.append(group);
  }
  for (const [categoryId, categoryName] of qrT.CATEGORIES) {
    const items = qrT.TEMPLATES.filter((template) => template.cat === categoryId);
    if (!items.length) continue;
    const group = document.createElement('section'); const heading = document.createElement('h4'); heading.className = 'qr-sub'; heading.textContent = categoryName;
    const grid = document.createElement('div'); grid.className = 'qr-grid';
    for (const template of items) grid.append(qrThumb(qrTemplateDesign(template), template.desc, template.name, false, () => qrApplyTemplate(template)));
    group.append(heading, grid); panel.append(group);
  }
}

function qrRenderLayouts(panel) {
  const signature = `${JSON.stringify(qr.design)}|${Object.keys(qr.assets.art).length}`;
  if (qr.galleries.layouts === signature) return;
  qr.galleries.layouts = signature;
  const grid = panel.querySelector('.qr-layout-grid');
  grid.replaceChildren();
  for (const layout of qrR.LAYOUTS) {
    const design = qrR.clone(qr.design);
    design.layout.id = layout.id;
    const texts = design.layout.texts;
    const samples = { title: 'Título', subtitle: 'Subtítulo da chamada', cta: texts.cta.text || 'ESCANEIE', footer: 'rodapé' };
    for (const role of layout.roles) { texts[role].on = true; if (!texts[role].text.trim()) texts[role].text = samples[role]; }
    grid.append(qrThumb(qrR.sanitizeDesign(design), layout.desc, layout.name, layout.id === qr.design.layout.id, () => { qr.design.layout.id = layout.id; qrPushHistory('layout'); qrSyncAllControls(); qrAfterDesign('layout.id'); qr.galleries.layouts = ''; qrRenderGalleriesIfVisible(); }));
  }
}

function qrRenderGalleriesIfVisible() {
  const panels = qr.panelEls || {};
  if (qr.tab === 'templates' && panels.templates) qrRenderTemplates(panels.templates);
  if (qr.tab === 'frame' && panels.frame) qrRenderLayouts(panels.frame);
}

/* ───────── panels ───────── */
function qrBuildPanels() {
  qr.panelEls = {};
  for (const id of QR_TAB_ORDER) { const panel = document.createElement('div'); panel.className = `qr-panel${id === qr.tab ? '' : ' hidden'}`; panel.dataset.panel = id; qr.panelEls[id] = panel; qrEl.panels.append(panel); }
  qrBuildContentPanel(qr.panelEls.content);
  for (const section of QR_CODE_SECTIONS) {
    const box = document.createElement('section'); box.className = 'qr-section';
    const heading = document.createElement('h4'); heading.className = 'qr-sub'; heading.textContent = section.title; box.append(heading);
    for (const control of section.controls) box.append(qrBuildControl(control));
    qr.panelEls.code.append(box);
  }
  for (const control of QR_LOGO_CONTROLS) qr.panelEls.logo.append(qrBuildControl(control));
  const logoNote = document.createElement('p'); logoNote.className = 'pg-attach-note'; logoNote.textContent = 'O logo cobre o centro do código. Com logo, a correção de erros sobe para H automaticamente (se estiver em "Automática").';
  qr.panelEls.logo.prepend(logoNote);
  const layoutGrid = document.createElement('div'); layoutGrid.className = 'qr-grid qr-layout-grid';
  const layoutHead = document.createElement('h4'); layoutHead.className = 'qr-sub'; layoutHead.textContent = 'Escolha a moldura';
  qr.panelEls.frame.append(layoutHead, layoutGrid);
  const artNote = document.createElement('p'); artNote.className = 'pg-attach-note qr-art-note';
  qrEl.artNote = artNote;
  const artButtons = document.createElement('div'); artButtons.className = 'qr-row-actions';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'btn btn-sm btn-ghost'; open.textContent = 'Abrir pasta de artes';
  open.addEventListener('click', () => window.arc.qrOpenArtFolder().catch((error) => showPasteToast(qrErrorText(error), 'error')));
  const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'btn btn-sm btn-ghost'; reload.textContent = 'Recarregar artes';
  reload.addEventListener('click', () => qrLoadAssets(true));
  artButtons.append(open, reload);
  qr.panelEls.frame.append(artNote, artButtons);
  for (const control of QR_FRAME_CONTROLS) qr.panelEls.frame.append(qrBuildControl(control));
  qrBuildTextsPanel(qr.panelEls.texts);
}

function qrShowTab(id) {
  qr.tab = id;
  for (const [key, panel] of Object.entries(qr.panelEls)) panel.classList.toggle('hidden', key !== id);
  for (const button of qrEl.tabs.querySelectorAll('[data-qr-tab]')) button.classList.toggle('active', button.dataset.qrTab === id);
  syncSeg(qrEl.tabs);
  qrRenderGalleriesIfVisible();
  qrSyncAllControls();
}

/* ───────── rendering ───────── */
async function qrMatrixFor(text, design) {
  const ecl = qrR.chooseEcl(design);
  const request = { text, ecl, mask: design.mask === 'auto' ? 'auto' : Number(design.mask), version: design.version > 0 ? design.version : 'auto' };
  const key = JSON.stringify(request);
  if (qr.matrixCache.has(key)) return qr.matrixCache.get(key);
  const info = await window.arc.qrMatrix(request);
  qr.matrixCache.set(key, info);
  if (qr.matrixCache.size > 24) qr.matrixCache.delete(qr.matrixCache.keys().next().value);
  return info;
}

function qrScheduleRender() {
  clearTimeout(qr.renderTimer);
  qr.renderTimer = setTimeout(qrRender, 50);
}

async function qrRender() {
  const seq = ++qr.renderSeq;
  const type = qr.design.type;
  qr.payload = qrP.buildPayload(type, qrFieldsOf(type));
  qr.matrixError = '';
  let info = null;
  qr.usingSample = !qr.payload.text;
  if (!qr.sample) {
    try { qr.sample = await window.arc.qrMatrix({ text: 'https://arcxp.online', ecl: 'H' }); qr.galleries = { templates: '', layouts: '' }; qrRenderGalleriesIfVisible(); } catch { /* the main process is unavailable */ }
  }
  try {
    info = qr.payload.text ? await qrMatrixFor(qr.payload.text, qr.design) : qr.sample;
  } catch (error) {
    qr.matrixError = qrErrorText(error);
    info = qr.sample; qr.usingSample = true;
  }
  if (seq !== qr.renderSeq || !info) return;
  qr.info = info;
  let result;
  try { result = qrR.render(qr.design, info, qrAssetsForRender()); } catch (error) { qrEl.status.textContent = 'erro ao desenhar'; qrEl.status.className = 'chip chip-err'; console.error(error); return; }
  qr.render = result;
  qrEl.preview.src = qrSvgUrl(result.svg);
  qrEl.stage.classList.toggle('transparent', qr.design.layout.id === 'plain' ? qr.design.background.mode === 'transparent' : qr.design.layout.bg.mode === 'transparent');
  qrEl.copy.disabled = qrEl.save.disabled = !qr.payload.text || Boolean(qr.matrixError);
  qrUpdateSide();
  qrScheduleVerify();
  if (qr.tab === 'frame') { clearTimeout(qr.galleryTimer); qr.galleryTimer = setTimeout(qrRenderGalleriesIfVisible, 350); }
}

function qrExportPx() { return qr.exportFormat === 'svg' ? 0 : qr.exportWidth; }
function qrPrintWidthMm() { return qr.printMm > 0 ? qr.printMm : (qr.render ? qr.render.mm[0] : 0); }

function qrUpdateSide() {
  const { payload, info, render } = qr;
  const items = [];
  if (qr.matrixError) items.push({ level: 'bad', text: qr.matrixError });
  for (const message of payload.errors) items.push({ level: payload.empty ? 'info' : 'bad', text: message });
  if (qr.usingSample && !qr.matrixError) items.push({ level: 'info', text: 'A prévia mostra um código de exemplo. Preencha o conteúdo para gerar o seu.' });
  const verifyItem = { idle: null, testing: { level: 'info', text: 'Testando a leitura…' }, ok: { level: 'ok', text: qr.usingSample ? 'O código de exemplo lê normalmente com este visual.' : 'Lido com sucesso: o texto decodificado é idêntico ao conteúdo.' }, different: { level: 'bad', text: `Lê, mas devolve outro texto: "${qr.verify.text.slice(0, 80)}". Revise o conteúdo.` }, fail: { level: 'bad', text: 'Não consegui ler este código. Aumente o contraste, a margem ou volte para formas mais simples.' } }[qr.verify.state];
  if (verifyItem) items.push(verifyItem);
  for (const entry of qrR.assess(qr.design, info, { exportPx: qr.exportFormat === 'svg' ? 2048 : qr.exportWidth, moduleCanvas: render.module.size, canvasWidth: render.width, printMm: qrPrintWidthMm() })) items.push(entry);
  for (const message of payload.warnings) items.push({ level: 'warn', text: message });
  qrEl.checks.replaceChildren(...items.map((item) => {
    const li = document.createElement('li'); li.className = `qr-check ${item.level}`;
    const icon = document.createElement('span'); icon.className = 'qr-check-icon';
    icon.innerHTML = `<svg class="i i-xs" aria-hidden="true"><use href="#i-${item.level === 'ok' ? 'check' : item.level === 'info' ? 'info' : 'alert'}"/></svg>`;
    const text = document.createElement('span'); text.textContent = item.text;
    li.append(icon, text); return li;
  }));
  const rows = [
    ['Tipo', QR_TYPE_NAMES[qr.design.type]], ['Versão', `${info.version} (${info.size}×${info.size} módulos)`], ['Correção de erros', `${info.ecl} · ${{ L: '7%', M: '15%', Q: '25%', H: '30%' }[info.ecl]}`],
    ['Máscara', String(info.mask)], ['Conteúdo', `${qr.payload.text ? info.bytes : 0} bytes`], ['Tela', `${render.width} × ${render.height}`]
  ];
  qrEl.info.replaceChildren(...rows.flatMap(([term, value]) => { const dt = document.createElement('dt'); dt.textContent = term; const dd = document.createElement('dd'); dd.className = 'num'; dd.textContent = value; return [dt, dd]; }));
  qrEl.statsMain.textContent = qr.usingSample ? 'Exemplo' : `Versão ${info.version} · ${info.size}×${info.size}`;
  qrEl.statsDetail.textContent = qr.usingSample ? 'Preencha o conteúdo na aba Conteúdo' : `${QR_TYPE_NAMES[qr.design.type]} · correção ${info.ecl} · ${qr.payload.text.length} caracteres`;
  qrEl.exportNote.textContent = qr.exportFormat === 'svg' ? 'SVG é vetorial: nenhuma resolução a escolher. A fonte Inter vai embutida; outras fontes dependem do computador que abrir o arquivo.'
    : qr.exportFormat === 'pdf' ? `PDF com a página em ${qrPrintWidthMm()} × ${Math.round(qrPrintWidthMm() * render.height / render.width)} mm e a arte em ${qr.exportWidth} px.` : `${qr.exportWidth} × ${Math.round(qr.exportWidth * render.height / render.width)} px, ${qr.design.layout.id === 'plain' && qr.design.background.mode === 'transparent' ? 'com fundo transparente' : 'com o fundo do desenho'}.`;
  qrEl.widthField.classList.toggle('hidden', qr.exportFormat === 'svg');
  qrUpdateStatusChip();
}

function qrUpdateStatusChip() {
  const state = qr.verify.state;
  const map = { idle: ['chip', qr.usingSample ? 'exemplo' : 'pronto'], testing: ['chip chip-accent', 'testando leitura…'], ok: ['chip chip-ok', qr.usingSample ? 'exemplo · lê' : '✓ lê corretamente'], different: ['chip chip-err', 'texto divergente'], fail: ['chip chip-err', '✗ não consegui ler'] };
  const [className, text] = qr.matrixError ? ['chip chip-err', 'conteúdo grande demais'] : map[state];
  qrEl.status.className = className; qrEl.status.textContent = text;
}

/* ───────── raster, verify, export ───────── */
async function qrRaster(width) {
  const { svg, width: baseW, height: baseH } = qr.render;
  const limit = 8192;
  let scale = width / baseW;
  if (baseH * scale > limit) scale = limit / baseH;
  const outW = Math.max(16, Math.round(baseW * scale));
  const outH = Math.max(16, Math.round(baseH * scale));
  const image = new Image();
  image.src = qrSvgUrl(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  canvas.getContext('2d').drawImage(image, 0, 0, outW, outH);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a imagem. Tente um tamanho menor.');
  return new Uint8Array(await blob.arrayBuffer());
}

function qrScheduleVerify() {
  clearTimeout(qr.verifyTimer);
  qr.verify = { state: qr.matrixError ? 'idle' : 'testing', text: '' };
  qrUpdateStatusChip();
  qr.verifyTimer = setTimeout(qrVerify, 550);
}
async function qrVerify(explicit) {
  if (!qr.render || qr.matrixError) return;
  const seq = ++qr.verifySeq;
  const expected = qr.usingSample ? 'https://arcxp.online' : qr.payload.text;
  try {
    const bytes = await qrRaster(900);
    const result = await window.arc.qrVerify(bytes);
    if (seq !== qr.verifySeq) return;
    const same = (value) => String(value).replace(/\r\n/g, '\n') === String(expected).replace(/\r\n/g, '\n');
    qr.verify = result.ok ? (same(result.text) ? { state: 'ok', text: result.text } : { state: 'different', text: result.text }) : { state: 'fail', text: '' };
  } catch (error) {
    if (seq !== qr.verifySeq) return;
    qr.verify = { state: 'idle', text: '' };
    if (explicit) showPasteToast(qrErrorText(error), 'error');
  }
  qrUpdateSide();
  if (explicit === true) showPasteToast(qr.verify.state === 'ok' ? 'Leitura confirmada: o código lê e devolve o conteúdo certo.' : 'A leitura falhou ou divergiu. Veja os avisos ao lado.', qr.verify.state === 'ok' ? 'success' : 'error');
}

async function qrSave() {
  if (!qr.payload.text || !qr.render) return;
  const format = qr.exportFormat;
  const baseName = `qrcode-${qr.design.type}`;
  try {
    let saved = null;
    if (format === 'svg') saved = await window.arc.qrSave({ format, data: qr.render.svg, suggestedName: baseName });
    else {
      const bytes = await qrRaster(format === 'pdf' ? Math.min(qr.exportWidth, 4096) : qr.exportWidth);
      const widthMm = qrPrintWidthMm();
      const background = qr.design.layout.id === 'plain' ? qr.design.background.c1 : qr.design.layout.bg.c1;
      saved = await window.arc.qrSave({ format, data: bytes, suggestedName: baseName, widthMm, heightMm: widthMm * qr.render.height / qr.render.width, background });
    }
    if (saved) showPasteToast(`QR Code salvo em ${saved}`);
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}
async function qrCopy() {
  if (!qr.payload.text || !qr.render) return;
  try {
    const ok = await window.arc.qrCopyImage(await qrRaster(Math.min(qr.exportWidth, 2048)));
    showPasteToast(ok ? 'Imagem copiada: cole em qualquer lugar.' : 'Não foi possível copiar a imagem.', ok ? 'success' : 'error');
    if (ok) { const label = qrEl.copy.querySelector('span'); label.textContent = 'Copiado'; setTimeout(() => { label.textContent = 'Copiar imagem'; }, 1600); }
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}

/* ───────── assets ───────── */
async function qrLoadAssets(announce) {
  try {
    const loaded = await window.arc.qrAssets();
    const keep = Object.fromEntries(Object.entries(qr.assets.art).filter(([id]) => id.startsWith('custom-')));
    qr.assets.art = { ...Object.fromEntries(loaded.art.map((item) => [item.id, item])), ...keep };
    qr.assets.inter = loaded.inter || '';
    qr.assets.artDirectory = loaded.artDirectory || '';
    const have = loaded.art.length;
    if (qrEl.artNote) qrEl.artNote.textContent = have ? `${have} de ${qrT.ART.length} artes encontradas. Coloque novos arquivos PNG/WebP/JPG (nome = id da arte) na pasta de artes e clique em "Recarregar artes". Veja docs/QR-CREATIVOS.md.` : `Nenhuma arte encontrada ainda (0 de ${qrT.ART.length}). Os modelos usam decoração vetorial até você adicionar as imagens: veja docs/QR-CREATIVOS.md.`;
    qr.galleries = { templates: '', layouts: '' };
    qrSyncAllControls(); qrRenderGalleriesIfVisible(); qrScheduleRender();
    if (announce) showPasteToast(have ? `${have} artes carregadas.` : 'Nenhuma arte encontrada na pasta.');
  } catch (error) { if (announce) showPasteToast(qrErrorText(error), 'error'); }
}

/* ───────── persistence ───────── */
let qrSaveTimer = 0;
function qrScheduleSave() { clearTimeout(qrSaveTimer); qrSaveTimer = setTimeout(() => { if (settingsState.ready) scheduleOptionsSave(); }, 300); }
function qrCollectSettings() {
  const design = qrR.clone(qr.design);
  return { design: JSON.stringify(design), templates: JSON.stringify(qr.custom), exportFormat: qr.exportFormat, exportWidth: qr.exportWidth, printMm: qr.printMm };
}
function qrLoadSettings(saved) {
  if (!saved) return;
  try { if (saved.design) qr.design = qrR.sanitizeDesign(JSON.parse(saved.design)); } catch { /* corrupt design: keep defaults */ }
  try {
    const list = JSON.parse(saved.templates || '[]');
    qr.custom = Array.isArray(list) ? list.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string').slice(-40).map((item) => ({ id: item.id.slice(0, 40), name: item.name.slice(0, 40), design: qrR.sanitizeDesign(item.design) })) : [];
  } catch { qr.custom = []; }
  qr.exportFormat = saved.exportFormat; qr.exportWidth = saved.exportWidth; qr.printMm = saved.printMm;
  qrEl.width.value = String([...qrEl.width.options].some((option) => Number(option.value) === qr.exportWidth) ? qr.exportWidth : 2048);
  qrEl.printMm.value = qr.printMm > 0 ? String(qr.printMm) : '';
  for (const button of qrEl.formatSeg.querySelectorAll('[data-qr-format]')) button.classList.toggle('active', button.dataset.qrFormat === qr.exportFormat);
  syncSeg(qrEl.formatSeg);
  qr.history = [qrSnapshot()]; qr.future = [];
  qrUpdateHistoryButtons();
  qr.galleries = { templates: '', layouts: '' };
  qrSyncAll();
}

/* ───────── wiring ───────── */
qrBuildPanels();
qrEl.tabs.addEventListener('click', (event) => { const button = event.target.closest('[data-qr-tab]'); if (button) qrShowTab(button.dataset.qrTab); });
qrEl.paneTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-qr-pane]');
  if (!button) return;
  qrEl.main.dataset.pane = button.dataset.qrPane === 'stage' ? 'output' : 'form';
  for (const item of qrEl.paneTabs.querySelectorAll('[data-qr-pane]')) item.classList.toggle('active', item === button);
  syncSeg(qrEl.paneTabs);
});
qrEl.formatSeg.addEventListener('click', (event) => {
  const button = event.target.closest('[data-qr-format]');
  if (!button) return;
  qr.exportFormat = button.dataset.qrFormat;
  for (const item of qrEl.formatSeg.querySelectorAll('[data-qr-format]')) item.classList.toggle('active', item === button);
  syncSeg(qrEl.formatSeg);
  if (qr.render) qrUpdateSide();
  qrScheduleSave();
});
qrEl.width.addEventListener('change', () => { qr.exportWidth = Number(qrEl.width.value); if (qr.render) qrUpdateSide(); qrScheduleSave(); });
qrEl.printMm.addEventListener('input', () => { const value = Math.round(Number(qrEl.printMm.value)); qr.printMm = Number.isFinite(value) && value > 0 ? Math.min(2000, value) : 0; if (qr.render) qrUpdateSide(); qrScheduleSave(); });
qrEl.undo.addEventListener('click', qrUndo);
qrEl.redo.addEventListener('click', qrRedo);
qrEl.verifyBtn.addEventListener('click', () => { qr.verify = { state: 'testing', text: '' }; qrUpdateStatusChip(); qrVerify(true); });
qrEl.copy.addEventListener('click', qrCopy);
qrEl.save.addEventListener('click', qrSave);
qrEl.reset.addEventListener('click', () => {
  const type = qr.design.type;
  qr.design = qrR.sanitizeDesign({ type });
  qrPushHistory('reset'); qr.galleries = { templates: '', layouts: '' }; qrSyncAll();
  showPasteToast('Estilo restaurado ao padrão.');
});
qrEl.view.addEventListener('keydown', (event) => {
  const tag = event.target?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if ((event.ctrlKey || event.metaKey) && !typing && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) qrRedo(); else qrUndo(); }
  else if ((event.ctrlKey || event.metaKey) && !typing && event.key.toLowerCase() === 'y') { event.preventDefault(); qrRedo(); }
  else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); qrCopy(); }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); qrSave(); }
});
qr.history = [qrSnapshot()];
qrSyncAll();
qrRefreshContentPanel();
qrShowTab('templates');
qrLoadAssets(false);
qr.ready = true;

/* ───────── File hashes ─────────
   Streaming and algorithms live in the main process (src/hasher.mjs). This block lists files, shows progress, compares with an
   expected hash or a checksum file, spots identical files and writes checksum files. Only the algorithm choice is saved. */
const fh = {
  files: [], algos: new Set(['sha256']), available: [], mode: 'files', running: false, upper: false, expected: '', sums: null, order: [], nextId: 1,
  textTimer: 0, textSeq: 0, textBytes: 0, textHashes: null, progressFrame: 0, rows: new Map(), done: 0
};
const fhEl = {
  view: $('#file-hash-view'), modeSeg: $('#fh-mode-seg'), note: $('#fh-note'), filesPane: $('#fh-files-pane'), textPane: $('#fh-text-pane'), drop: $('#fh-drop'), list: $('#fh-list'),
  pickFiles: $('#fh-pick-files'), pickFolder: $('#fh-pick-folder'), text: $('#fh-text'), textOut: $('#fh-text-out'), algos: $('#fh-algos'), expected: $('#fh-expected'), compare: $('#fh-compare-result'),
  verifySums: $('#fh-verify-sums'), clearSums: $('#fh-clear-sums'), sumsNote: $('#fh-sums-note'), saveAlgo: $('#fh-save-algo'), saveSums: $('#fh-save-sums'), upper: $('#fh-upper'),
  statsMain: $('#fh-stats-main'), statsDetail: $('#fh-stats-detail'), clear: $('#fh-clear'), copy: $('#fh-copy'), cancel: $('#fh-cancel'), run: $('#fh-run')
};
const FH_RENDER_LIMIT = 400;
const FH_LENGTH_TO_ALGO = { 8: 'crc32', 32: 'md5', 40: 'sha1', 64: 'sha256', 96: 'sha384', 128: 'sha512' };
const FH_PREFERENCE = ['sha256', 'sha512', 'sha384', 'sha1', 'md5', 'crc32'];
const fhLabel = (id) => (fh.available.find((item) => item.id === id) || { label: id.toUpperCase() }).label;
const fhShow = (hex) => (fh.upper ? hex.toUpperCase() : hex);
const fhNormalize = (value) => String(value || '').trim().replace(/^0x/i, '').replace(/[\s:_-]/g, '').toLowerCase();

function fhAddCollected(result) {
  if (!result) return;
  const have = new Set(fh.files.map((file) => file.path.toLowerCase()));
  let added = 0;
  for (const file of result.files) {
    if (have.has(file.path.toLowerCase())) continue;
    fh.files.push({ id: fh.nextId++, path: file.path, name: file.name, relative: file.relative, size: file.size, status: 'idle', progress: 0, hashes: null, error: '', expectedCheck: '', sumsCheck: '', dup: 0 });
    added += 1;
  }
  const notes = [];
  if (!added && result.files.length) notes.push('Esses arquivos já estavam na lista.');
  if (result.skipped.length) notes.push(`${result.skipped.length} item(ns) ignorado(s): ${[...new Set(result.skipped.map((item) => item.reason))].join('; ')}.`);
  if (result.truncated) notes.push('A pasta tem arquivos demais: só os primeiros 50.000 foram listados.');
  fhEl.note.textContent = notes.join(' ');
  fhEvaluate();
  fhRender();
}

/* ───── checks: expected hash, checksum file, identical files ───── */
function fhEvaluate() {
  for (const file of fh.files) { file.expectedCheck = ''; file.sumsCheck = ''; file.dup = 0; }
  // expected hash
  const hex = fhNormalize(fh.expected);
  let message = '';
  let tone = '';
  if (hex) {
    const algo = FH_LENGTH_TO_ALGO[hex.length];
    if (!/^[0-9a-f]+$/.test(hex) || !algo) { message = 'Isso não parece um hash. Aceito CRC32 (8), MD5 (32), SHA-1 (40), SHA-256 (64), SHA-384 (96) e SHA-512 (128 dígitos).'; tone = 'warn'; }
    else {
      const computed = fh.files.filter((file) => file.hashes && file.hashes[algo]);
      if (!computed.length) { message = fh.algos.has(algo) ? `É um hash ${fhLabel(algo)}. Calcule os hashes para comparar.` : `É um hash ${fhLabel(algo)}: marque esse algoritmo ao lado e calcule.`; tone = 'info'; }
      else {
        let matches = 0;
        for (const file of computed) { const ok = file.hashes[algo] === hex; file.expectedCheck = ok ? 'match' : 'mismatch'; if (ok) matches += 1; }
        if (matches) for (const file of computed) if (file.expectedCheck === 'mismatch') file.expectedCheck = ''; // only the odd one out matters when something matches
        if (matches) { message =`✓ Confere (${fhLabel(algo)}): ${computed.filter((file) => file.expectedCheck === 'match').slice(0, 3).map((file) => file.name).join(', ')}${matches > 3 ? ` e mais ${matches - 3}` : ''}.`; tone = 'ok'; }
        else { message = `✗ Nenhum arquivo confere com esse hash ${fhLabel(algo)}. O arquivo pode estar corrompido, incompleto ou ser outro.`; tone = 'bad'; }
      }
    }
  }
  fhEl.compare.textContent = message;
  fhEl.compare.className = `fh-compare ${tone}`;

  // checksum file
  if (fh.sums) {
    const byPath = new Map();
    const byName = new Map();
    for (const entry of fh.sums.entries) {
      const key = entry.name.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
      byPath.set(key, entry);
      byName.set(key.split('/').pop(), entry);
    }
    const used = new Set();
    let ok = 0; let bad = 0; let none = 0; let pending = 0;
    for (const file of fh.files) {
      const entry = byPath.get(file.relative.toLowerCase()) || byName.get(file.name.toLowerCase());
      if (!entry) { file.sumsCheck = 'nosum'; none += 1; continue; }
      used.add(entry);
      if (!file.hashes || !file.hashes[entry.algorithm]) { pending += 1; continue; }
      file.sumsCheck = file.hashes[entry.algorithm] === entry.hash ? 'match' : 'mismatch';
      if (file.sumsCheck === 'match') ok += 1; else bad += 1;
    }
    const unmatched = fh.sums.entries.filter((entry) => !used.has(entry)).length;
    const parts = [`${fh.sums.name}: ${fh.sums.entries.length} entrada(s)`];
    if (fh.files.length) parts.push(`${ok} confere(m)`, `${bad} diferente(s)`, `${none} sem entrada`, `${unmatched} entrada(s) sem arquivo na lista`);
    if (pending) parts.push(`${pending} aguardando cálculo`);
    fhEl.sumsNote.textContent = `${parts.join(' · ')}.`;
    fhEl.sumsNote.className = `pg-attach-note ${bad ? 'fh-bad' : ok && !pending && !bad ? 'fh-ok' : ''}`;
  } else {
    fhEl.sumsNote.textContent = 'Aceita SHA256SUMS, .md5, .sha1 e formatos parecidos.';
    fhEl.sumsNote.className = 'pg-attach-note';
  }
  fhEl.clearSums.classList.toggle('hidden', !fh.sums);

  // identical files (same size and digest with the strongest algorithm every finished file shares)
  const done = fh.files.filter((file) => file.hashes);
  const shared = FH_PREFERENCE.find((id) => done.length > 1 && done.every((file) => file.hashes[id]));
  if (shared) {
    const groups = new Map();
    for (const file of done) { const key = `${file.size}:${file.hashes[shared]}`; (groups.get(key) || groups.set(key, []).get(key)).push(file); }
    for (const group of groups.values()) if (group.length > 1) for (const file of group) file.dup = group.length - 1;
  }
}

/* ───── list ───── */
function fhRowEl(file) {
  const row = document.createElement('div');
  row.className = `fh-row ${file.status}`; row.dataset.id = String(file.id); row.setAttribute('role', 'listitem');
  const top = document.createElement('div'); top.className = 'fh-row-top';
  const title = document.createElement('div'); title.className = 'fh-row-title';
  const name = document.createElement('strong'); name.textContent = file.name; name.title = file.path;
  const where = document.createElement('small'); where.textContent = file.relative.includes('/') ? file.relative : file.path; where.title = file.path;
  title.append(name, where);
  const size = document.createElement('span'); size.className = 'fh-size num'; size.textContent = formatBytes(file.size);
  const chips = document.createElement('div'); chips.className = 'fh-chips';
  const chip = (text, tone, title) => { const element = document.createElement('span'); element.className = `chip ${tone}`; element.textContent = text; if (title) element.title = title; chips.append(element); };
  if (file.status === 'running') chip(`${Math.round(file.progress * 100)}%`, 'chip-accent');
  else if (file.status === 'queued') chip('na fila', '');
  else if (file.status === 'error') chip(file.error || 'erro', 'chip-err');
  if (file.expectedCheck === 'match') chip('✓ confere com o hash informado', 'chip-ok');
  if (file.expectedCheck === 'mismatch') chip('não confere com o hash informado', 'chip-err');
  if (file.sumsCheck === 'match') chip('✓ confere com o arquivo de checksums', 'chip-ok');
  if (file.sumsCheck === 'mismatch') chip('✗ diferente do arquivo de checksums', 'chip-err');
  if (file.sumsCheck === 'nosum') chip('sem entrada no checksums', 'chip-warn');
  if (file.dup) chip(`idêntico a ${file.dup} outro${file.dup > 1 ? 's' : ''}`, 'chip-accent', 'Mesmo tamanho e mesmo hash: o conteúdo é igual');
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'fh-remove'; remove.title = 'Tirar da lista'; remove.setAttribute('aria-label', `Tirar ${file.name} da lista`); remove.innerHTML = '<svg class="i i-xs" aria-hidden="true"><use href="#i-x"/></svg>';
  remove.disabled = fh.running;
  top.append(title, size, remove);
  row.append(top);
  if (chips.childElementCount) row.append(chips);
  if (file.status === 'running' || file.status === 'queued') {
    const bar = document.createElement('div'); bar.className = 'fh-bar'; const fill = document.createElement('i'); fill.dataset.percent = String(Math.round(file.progress * 100)); fill.style.width = `${Math.round(file.progress * 100)}%`; bar.append(fill); row.append(bar);
  }
  if (file.hashes) {
    const list = document.createElement('div'); list.className = 'fh-hashes';
    for (const id of FH_PREFERENCE.slice().reverse()) {
      if (!file.hashes[id]) continue;
      const line = document.createElement('button'); line.type = 'button'; line.className = 'fh-hash'; line.dataset.copy = fhShow(file.hashes[id]); line.title = 'Clique para copiar';
      const label = document.createElement('span'); label.textContent = fhLabel(id);
      const code = document.createElement('code'); code.textContent = fhShow(file.hashes[id]);
      line.append(label, code); list.append(line);
    }
    row.append(list);
  }
  return row;
}
function fhRender() {
  const fragment = document.createDocumentFragment();
  fh.rows.clear();
  if (!fh.files.length) {
    const empty = document.createElement('div'); empty.className = 'fh-empty';
    empty.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-hash"/></svg><strong>Nenhum arquivo ainda</strong><span>Arraste arquivos ou uma pasta inteira para cá, marque os algoritmos ao lado e clique em "Calcular hashes".</span>';
    fragment.append(empty);
  } else {
    for (const file of fh.files.slice(0, FH_RENDER_LIMIT)) { const row = fhRowEl(file); fh.rows.set(file.id, row); fragment.append(row); }
    if (fh.files.length > FH_RENDER_LIMIT) { const more = document.createElement('p'); more.className = 'fh-more'; more.textContent = `+ ${fh.files.length - FH_RENDER_LIMIT} arquivos não exibidos aqui (todos são calculados e entram em "Copiar tudo" e no arquivo de checksums).`; fragment.append(more); }
  }
  fhEl.list.replaceChildren(fragment);
  fhUpdateDock();
}
function fhReplaceRow(file) {
  const row = fh.rows.get(file.id);
  if (!row) return;
  const next = fhRowEl(file);
  row.replaceWith(next);
  fh.rows.set(file.id, next);
}

function fhNeeds(file) { return !file.hashes || [...fh.algos].some((id) => !file.hashes[id]); }
function fhUpdateDock() {
  const total = fh.files.length;
  const bytes = fh.files.reduce((sum, file) => sum + file.size, 0);
  const finished = fh.files.filter((file) => file.hashes).length;
  const failed = fh.files.filter((file) => file.status === 'error').length;
  const inText = fh.mode === 'text';
  fhEl.run.classList.toggle('hidden', inText || fh.running);
  fhEl.cancel.classList.toggle('hidden', inText || !fh.running);
  fhEl.clear.classList.toggle('hidden', inText);
  fhEl.clear.disabled = fh.running;
  fhEl.run.disabled = !fh.files.some(fhNeeds) || fh.running;
  fhEl.run.querySelector('span').textContent = fh.files.some((file) => file.hashes) && fh.files.some(fhNeeds) ? 'Calcular o que falta' : 'Calcular hashes';
  fhEl.copy.disabled = inText ? !fh.textHashes : finished === 0;
  fhEl.saveSums.disabled = finished === 0 || fh.running;
  if (inText) {
    fhEl.statsMain.textContent = fh.textHashes ? `${fh.textBytes} byte${fh.textBytes === 1 ? '' : 's'}` : 'Texto';
    fhEl.statsDetail.textContent = fh.textHashes ? `${Object.keys(fh.textHashes).length} hash(es) calculado(s)` : 'Digite para calcular';
    return;
  }
  if (fh.running) {
    const active = fh.order.filter((file) => file.status === 'done' || file.status === 'error').length;
    const current = fh.order.find((file) => file.status === 'running');
    fhEl.statsMain.textContent = `Calculando ${Math.min(fh.order.length, active + 1)} de ${fh.order.length}`;
    fhEl.statsDetail.textContent = current ? `${current.name} · ${Math.round(current.progress * 100)}%` : 'Preparando…';
  } else {
    fhEl.statsMain.textContent = total ? `${total.toLocaleString('pt-BR')} arquivo${total === 1 ? '' : 's'} · ${formatBytes(bytes)}` : 'Nenhum arquivo';
    fhEl.statsDetail.textContent = total ? `${finished} calculado${finished === 1 ? '' : 's'}${failed ? ` · ${failed} com erro` : ''}` : 'Arraste arquivos ou escolha uma pasta';
  }
  const options = [...new Set(fh.files.flatMap((file) => (file.hashes ? Object.keys(file.hashes) : [])))].sort((a, b) => FH_PREFERENCE.indexOf(a) - FH_PREFERENCE.indexOf(b));
  const previous = fhEl.saveAlgo.value;
  fhEl.saveAlgo.replaceChildren(...options.map((id) => new Option(fhLabel(id), id)));
  if (options.includes(previous)) fhEl.saveAlgo.value = previous;
}

/* ───── running ───── */
async function fhRun() {
  const todo = fh.files.filter(fhNeeds);
  if (!todo.length || fh.running) return;
  fh.running = true; fh.order = todo;
  for (const file of todo) { file.status = 'queued'; file.progress = 0; file.error = ''; }
  fhRender();
  try {
    await window.arc.hashStart({ files: todo.map((file) => file.path), algorithms: [...fh.algos] });
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
  fh.running = false;
  for (const file of todo) if (file.status === 'queued' || file.status === 'running') file.status = file.hashes ? 'done' : 'idle';
  fhEvaluate(); fhRender();
}
function fhOnEvent(event) {
  const file = fh.order[event.index];
  if (event.type === 'done') { showPasteToast(event.cancelled ? 'Cálculo cancelado.' : `Pronto: ${event.done} arquivo(s) calculado(s)${event.failed ? `, ${event.failed} com erro` : ''}.`, event.failed ? 'error' : 'success'); return; }
  if (!file) return;
  if (event.type === 'file-start') { file.status = 'running'; file.progress = 0; fhReplaceRow(file); fhUpdateDock(); }
  else if (event.type === 'progress') {
    file.progress = event.total ? event.read / event.total : 1;
    if (!fh.progressFrame) fh.progressFrame = requestAnimationFrame(() => {
      fh.progressFrame = 0;
      for (const item of fh.order) {
        if (item.status !== 'running') continue;
        const row = fh.rows.get(item.id);
        const fill = row?.querySelector('.fh-bar i');
        const percent = Math.round(item.progress * 100);
        if (fill) { fill.style.width = `${percent}%`; fill.dataset.percent = String(percent); }
        const chip = row?.querySelector('.fh-chips .chip'); if (chip) chip.textContent = `${percent}%`;
      }
      fhUpdateDock();
    });
  } else if (event.type === 'file-done') {
    file.status = 'done'; file.progress = 1; file.size = event.size; file.hashes = { ...(file.hashes || {}), ...event.hashes };
    fhEvaluate(); fhReplaceRow(file); fhUpdateDock();
    for (const other of fh.order) if (other !== file && other.status === 'done') fhReplaceRow(other);
  } else if (event.type === 'file-error') { file.status = 'error'; file.error = event.error; fhReplaceRow(file); fhUpdateDock(); }
  else if (event.type === 'file-cancelled') { file.status = 'idle'; fhReplaceRow(file); }
}

/* ───── algorithms panel ───── */
function fhRenderAlgos() {
  fhEl.algos.replaceChildren(...fh.available.map((algo) => {
    const row = document.createElement('label'); row.className = 'switch-row';
    row.innerHTML = '<span class="switch-copy"><strong></strong><small></small></span><input type="checkbox"><span class="switch"></span>';
    row.querySelector('strong').textContent = algo.label;
    row.querySelector('small').textContent = `${algo.length} dígitos hexadecimais${algo.id === 'sha256' ? ' · recomendado' : algo.id === 'crc32' ? ' · só detecta erros, não é seguro' : ''}`;
    const input = row.querySelector('input'); input.checked = fh.algos.has(algo.id); input.dataset.algo = algo.id;
    input.addEventListener('change', () => {
      if (input.checked) fh.algos.add(algo.id); else if (fh.algos.size > 1) fh.algos.delete(algo.id); else { input.checked = true; showPasteToast('Deixe pelo menos um algoritmo marcado.', 'error'); return; }
      fhEvaluate(); fhRender(); fhTextSchedule(); scheduleOptionsSave();
    });
    return row;
  }));
}

/* ───── text mode ───── */
function fhTextSchedule() {
  clearTimeout(fh.textTimer);
  fh.textTimer = setTimeout(fhTextCompute, 130);
}
async function fhTextCompute() {
  const seq = ++fh.textSeq;
  const text = fhEl.text.value;
  try {
    const result = await window.arc.hashText({ text, algorithms: [...fh.algos] });
    if (seq !== fh.textSeq) return;
    fh.textBytes = result.bytes; fh.textHashes = result.hashes;
  } catch (error) { if (seq !== fh.textSeq) return; fh.textBytes = 0; fh.textHashes = null; showPasteToast(qrErrorText(error), 'error'); }
  fhRenderText();
}
function fhRenderText() {
  fhEl.textOut.replaceChildren();
  if (fh.textHashes) {
    for (const id of FH_PREFERENCE.slice().reverse()) {
      if (!fh.textHashes[id]) continue;
      const line = document.createElement('button'); line.type = 'button'; line.className = 'fh-hash'; line.dataset.copy = fhShow(fh.textHashes[id]); line.title = 'Clique para copiar';
      const label = document.createElement('span'); label.textContent = fhLabel(id);
      const code = document.createElement('code'); code.textContent = fhShow(fh.textHashes[id]);
      line.append(label, code); fhEl.textOut.append(line);
    }
  }
  const hex = fhNormalize(fh.expected);
  if (fh.mode === 'text' && hex && fh.textHashes) {
    const algo = FH_LENGTH_TO_ALGO[hex.length];
    if (algo && fh.textHashes[algo]) { fhEl.compare.textContent = fh.textHashes[algo] === hex ? `✓ Confere (${fhLabel(algo)}) com o texto.` : `✗ Não confere com o texto (${fhLabel(algo)}).`; fhEl.compare.className = `fh-compare ${fh.textHashes[algo] === hex ? 'ok' : 'bad'}`; }
  }
  fhUpdateDock();
}

function fhSetMode(mode) {
  fh.mode = mode;
  for (const button of fhEl.modeSeg.querySelectorAll('[data-fh-mode]')) button.classList.toggle('active', button.dataset.fhMode === mode);
  syncSeg(fhEl.modeSeg);
  fhEl.filesPane.classList.toggle('hidden', mode !== 'files');
  fhEl.textPane.classList.toggle('hidden', mode !== 'text');
  if (mode === 'text') { fhTextCompute(); } else { fhEvaluate(); }
  fhUpdateDock();
}

/* ───── actions ───── */
async function fhCopyText(text, message) {
  let ok = false;
  try { ok = await window.arc.writeClipboardText(text); } catch { ok = false; }
  showPasteToast(ok ? message : 'Não foi possível copiar.', ok ? 'success' : 'error');
}
function fhAllAsText() {
  if (fh.mode === 'text') return Object.entries(fh.textHashes || {}).sort((a, b) => FH_PREFERENCE.indexOf(a[0]) - FH_PREFERENCE.indexOf(b[0])).map(([id, hash]) => `${fhLabel(id)}: ${fhShow(hash)}`).join('\n');
  return fh.files.filter((file) => file.hashes).map((file) => `${file.relative}\n${Object.keys(file.hashes).sort((a, b) => FH_PREFERENCE.indexOf(a) - FH_PREFERENCE.indexOf(b)).map((id) => `  ${fhLabel(id)}: ${fhShow(file.hashes[id])}`).join('\n')}`).join('\n\n');
}
async function fhPick(mode) {
  try { fhAddCollected(await window.arc.hashSelect(mode)); } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}
async function fhVerifySums() {
  try {
    const sums = await window.arc.hashReadSums();
    if (!sums) return;
    fh.sums = sums;
    const needed = [...new Set(sums.entries.map((entry) => entry.algorithm))].filter((id) => fh.available.some((item) => item.id === id));
    const added = needed.filter((id) => !fh.algos.has(id));
    for (const id of added) fh.algos.add(id);
    if (added.length) { fhRenderAlgos(); scheduleOptionsSave(); showPasteToast(`Marquei ${added.map(fhLabel).join(', ')} para bater com o arquivo. Clique em "Calcular".`); }
    fhEvaluate(); fhRender();
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}
async function fhSaveSums() {
  const algorithm = fhEl.saveAlgo.value;
  if (!algorithm) return;
  try {
    const rows = fh.files.filter((file) => file.hashes && file.hashes[algorithm]).map((file) => ({ relative: file.relative, name: file.name, hashes: { [algorithm]: file.hashes[algorithm] } }));
    const saved = await window.arc.hashSaveSums({ rows, algorithm });
    if (saved) showPasteToast(`Checksums salvos em ${saved}`);
  } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
}
function fhClear() {
  if (fh.running) return;
  fh.files = []; fh.sums = null; fh.expected = ''; fhEl.expected.value = ''; fhEl.note.textContent = '';
  fhEvaluate(); fhRender();
}

/* ───── wiring ───── */
fhEl.modeSeg.addEventListener('click', (event) => { const button = event.target.closest('[data-fh-mode]'); if (button) fhSetMode(button.dataset.fhMode); });
fhEl.pickFiles.addEventListener('click', () => fhPick('files'));
fhEl.pickFolder.addEventListener('click', () => fhPick('folder'));
fhEl.drop.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fhPick('files'); } });
fhEl.run.addEventListener('click', fhRun);
fhEl.cancel.addEventListener('click', () => { window.arc.hashCancel(); fhEl.cancel.disabled = true; setTimeout(() => { fhEl.cancel.disabled = false; }, 800); });
fhEl.clear.addEventListener('click', fhClear);
fhEl.copy.addEventListener('click', () => { const text = fhAllAsText(); if (text) fhCopyText(text, 'Hashes copiados.'); });
fhEl.text.addEventListener('input', fhTextSchedule);
fhEl.expected.addEventListener('input', () => { fh.expected = fhEl.expected.value; fhEvaluate(); if (fh.mode === 'text') fhRenderText(); else fhRender(); });
fhEl.verifySums.addEventListener('click', fhVerifySums);
fhEl.clearSums.addEventListener('click', () => { fh.sums = null; fhEvaluate(); fhRender(); });
fhEl.saveSums.addEventListener('click', fhSaveSums);
fhEl.upper.addEventListener('change', () => { fh.upper = fhEl.upper.checked; fhRender(); fhRenderText(); scheduleOptionsSave(); });
fhEl.view.addEventListener('click', (event) => {
  const line = event.target.closest('.fh-hash');
  if (line) { fhCopyText(line.dataset.copy, 'Hash copiado.'); return; }
  const remove = event.target.closest('.fh-remove');
  if (remove && !fh.running) { const id = Number(remove.closest('.fh-row')?.dataset.id); fh.files = fh.files.filter((file) => file.id !== id); fhEvaluate(); fhRender(); }
});
for (const name of ['dragenter', 'dragover']) fhEl.view.addEventListener(name, (event) => { if (hasFilePayload(event) && fh.mode === 'files') { event.preventDefault(); fhEl.view.classList.add('dragging'); } });
fhEl.view.addEventListener('dragleave', (event) => { if (!fhEl.view.contains(event.relatedTarget)) fhEl.view.classList.remove('dragging'); });
fhEl.view.addEventListener('drop', async (event) => {
  if (!hasFilePayload(event) || fh.mode !== 'files') return;
  event.preventDefault(); fhEl.view.classList.remove('dragging');
  const paths = [...event.dataTransfer.files].map((file) => window.arc.getPathForFile(file)).filter(Boolean);
  if (!paths.length) return;
  try { fhAddCollected(await window.arc.hashFromPaths(paths)); } catch (error) { showPasteToast(qrErrorText(error), 'error'); }
});
fhEl.view.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (fh.mode === 'files') fhRun(); } });
window.arc.onHashEvent(fhOnEvent);
(async () => {
  try { fh.available = await window.arc.hashAlgorithms(); } catch { fh.available = []; }
  fh.algos = new Set([...fh.algos].filter((id) => fh.available.some((item) => item.id === id)));
  if (!fh.algos.size && fh.available.length) fh.algos.add(fh.available[0].id);
  fhRenderAlgos(); fhRender();
})();

/* ───────── Unit converter ───────── */
const UC = window.ArcUnits;
const uc = { touched: false, category: 'length', pairs: {}, text: '1', precision: 10, notation: 'auto', places: 4, history: [], historyTimer: 0, last: null, ready: false };
const ucEl = {
  view: $('#unit-converter-view'), cats: $('#uc-cats'), input: $('#uc-input'), valueLabel: $('#uc-value-label'), from: $('#uc-from'), to: $('#uc-to'), swap: $('#uc-swap'), error: $('#uc-error'),
  result: $('#uc-result'), resultUnit: $('#uc-result-unit'), explain: $('#uc-explain'), table: $('#uc-table'), notation: $('#uc-notation'), precision: $('#uc-precision'), precisionOut: $('#uc-precision-out'),
  precisionField: $('#uc-precision-field'), places: $('#uc-places'), placesOut: $('#uc-places-out'), placesField: $('#uc-places-field'), history: $('#uc-history'), historyClear: $('#uc-history-clear'),
  statsMain: $('#uc-stats-main'), statsDetail: $('#uc-stats-detail'), copy: $('#uc-copy'), copyPlain: $('#uc-copy-plain'), copyTable: $('#uc-copy-table')
};
const ucFormat = (value) => UC.formatNumber(value, { precision: uc.precision, notation: uc.notation, places: uc.places });
const ucGroupBits = (text, radix) => { if (radix !== 2) return text; const negative = text.startsWith('-'); const digits = negative ? text.slice(1) : text; return (negative ? '-' : '') + digits.replace(/\B(?=(\d{4})+(?!\d))/g, ' '); };

function ucBuildCats() {
  ucEl.cats.replaceChildren(...UC.CATEGORIES.map((category) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'uc-cat'; button.dataset.cat = category.id; button.setAttribute('role', 'tab'); button.textContent = category.label;
    button.addEventListener('click', () => ucSetCategory(category.id));
    return button;
  }));
}
function ucFillUnits() {
  const category = UC.categoryById(uc.category);
  const pair = uc.pairs[category.id] || [category.from, category.to];
  const options = category.units.map((unit) => [unit.id, `${unit.label} (${unit.symbol})`]);
  for (const select of [ucEl.from, ucEl.to]) select.replaceChildren(...options.map(([value, text]) => new Option(text, value)));
  ucEl.from.value = category.units.some((unit) => unit.id === pair[0]) ? pair[0] : category.from;
  ucEl.to.value = category.units.some((unit) => unit.id === pair[1]) ? pair[1] : category.to;
  for (const button of ucEl.cats.children) button.classList.toggle('active', button.dataset.cat === category.id);
  ucEl.valueLabel.innerHTML = category.special ? 'Número <small>na base escolhida em "De"</small>' : 'Valor <small>aceita expressões: 2 * (3 + 4,5)</small>';
  ucEl.input.inputMode = category.special ? 'text' : 'decimal';
}
function ucSetCategory(id) {
  uc.touched = true;
  const previous = UC.categoryById(uc.category);
  uc.pairs[previous.id] = [ucEl.from.value, ucEl.to.value];
  uc.category = id;
  const category = UC.categoryById(id);
  if (category.special && !UC.parseInteger(uc.text, 10).ok) uc.text = '255';
  if (!category.special && !UC.parseInput(uc.text).ok) uc.text = '1';
  ucEl.input.value = uc.text;
  ucFillUnits(); ucRender(); ucScheduleSave();
}

function ucCompute() {
  const category = UC.categoryById(uc.category);
  const from = UC.unitOf(category, ucEl.from.value);
  const to = UC.unitOf(category, ucEl.to.value);
  if (category.special) {
    const parsed = UC.parseInteger(uc.text, from.radix);
    if (!parsed.ok) return { category, from, to, parsed };
    return { category, from, to, parsed, rows: category.units.map((unit) => ({ unit, text: UC.formatInteger(parsed.value, unit.radix) })), main: UC.formatInteger(parsed.value, to.radix) };
  }
  const parsed = UC.parseInput(uc.text);
  if (!parsed.ok) return { category, from, to, parsed };
  const rows = UC.convertAll(category.id, parsed.value, from.id).map((entry) => ({ unit: UC.unitOf(category, entry.id), value: entry.value }));
  return { category, from, to, parsed, rows, value: UC.convert(category.id, parsed.value, from.id, to.id) };
}
function ucRender() {
  const state = ucCompute();
  uc.last = state;
  const { category, from, to, parsed } = state;
  ucEl.error.classList.toggle('hidden', parsed.ok || parsed.empty);
  ucEl.error.textContent = parsed.ok || parsed.empty ? '' : parsed.error;
  ucEl.input.classList.toggle('invalid', !parsed.ok && !parsed.empty);
  ucEl.table.replaceChildren();
  if (!parsed.ok) {
    ucEl.result.textContent = '—'; ucEl.resultUnit.textContent = ''; ucEl.explain.textContent = parsed.empty ? 'Digite um valor para converter.' : '';
    ucEl.statsMain.textContent = '—'; ucEl.statsDetail.textContent = '';
    return;
  }
  if (category.special) {
    ucEl.result.textContent = ucGroupBits(state.main, to.radix); ucEl.resultUnit.textContent = to.symbol;
    ucEl.explain.textContent = `${uc.text.trim()} (base ${from.radix}) = ${ucGroupBits(state.main, to.radix)} (base ${to.radix})${from.radix !== 10 && to.radix !== 10 ? ` = ${UC.formatInteger(parsed.value, 10)} (base 10)` : ''}`;
    ucEl.statsMain.textContent = `${uc.text.trim()}${from.symbol} = ${ucGroupBits(state.main, to.radix)}${to.symbol}`; ucEl.statsDetail.textContent = category.label;
    for (const row of state.rows) ucEl.table.append(ucTableRow(row.unit, ucGroupBits(row.text, row.unit.radix), row.unit.id === from.id, row.unit.id === to.id, row.text));
  } else {
    const text = ucFormat(state.value);
    ucEl.result.textContent = text; ucEl.resultUnit.textContent = to.symbol;
    const isExpression = !/^-?[\d.]*,?\d*(?:e[+-]?\d+)?$/i.test(uc.text.trim().replace(/\s/g, ''));
    const one = UC.convert(category.id, 1, from.id, to.id);
    ucEl.explain.textContent = `${isExpression ? `${uc.text.trim()} = ${ucFormat(parsed.value)} ${from.symbol} · ` : ''}${category.id === 'temperature' || category.id === 'fuel' ? `${ucFormat(parsed.value)} ${from.symbol} → ${text} ${to.symbol}` : `1 ${from.symbol} = ${ucFormat(one)} ${to.symbol}`}`;
    ucEl.statsMain.textContent = `${ucFormat(parsed.value)} ${from.symbol} = ${text} ${to.symbol}`; ucEl.statsDetail.textContent = category.label;
    for (const row of state.rows) ucEl.table.append(ucTableRow(row.unit, ucFormat(row.value), row.unit.id === from.id, row.unit.id === to.id, UC.plainNumber(row.value)));
  }
  ucScheduleHistory();
}
function ucTableRow(unit, text, isFrom, isTo, copyValue) {
  const row = document.createElement('button'); row.type = 'button'; row.className = `uc-row-item${isFrom ? ' from' : ''}${isTo ? ' to' : ''}`; row.dataset.copy = copyValue; row.dataset.unit = unit.id; row.setAttribute('role', 'listitem');
  const name = document.createElement('span'); name.className = 'uc-unit-name'; name.textContent = unit.label;
  const value = document.createElement('span'); value.className = 'uc-unit-value num'; value.textContent = `${text} ${unit.symbol}`;
  row.append(name, value);
  return row;
}

/* history + persistence */
function ucScheduleHistory() {
  clearTimeout(uc.historyTimer);
  if (!uc.touched) return;
  uc.historyTimer = setTimeout(ucPushHistory, 1600);
}
function ucPushHistory() {
  const state = uc.last;
  if (!uc.touched || !state || !state.parsed.ok) return;
  const text = state.category.special ? ucGroupBits(state.main, state.to.radix) : ucFormat(state.value);
  const entry = { cat: state.category.id, text: uc.text.trim(), from: state.from.id, to: state.to.id, result: `${text} ${state.to.symbol}`, fromSymbol: state.from.symbol };
  const key = (item) => `${item.cat}|${item.text}|${item.from}|${item.to}`;
  uc.history = [entry, ...uc.history.filter((item) => key(item) !== key(entry))].slice(0, 12);
  ucRenderHistory();
}
function ucRenderHistory() {
  ucEl.history.replaceChildren(...uc.history.map((entry, index) => {
    const li = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.dataset.index = String(index);
    const left = document.createElement('span'); left.textContent = `${entry.text} ${entry.fromSymbol}`; const right = document.createElement('strong'); right.className = 'num'; right.textContent = `= ${entry.result}`;
    button.append(left, right); li.append(button); return li;
  }));
  if (!uc.history.length) { const li = document.createElement('li'); li.className = 'uc-history-empty'; li.textContent = 'As conversões que você faz aparecem aqui.'; ucEl.history.append(li); }
}
let ucSaveTimer = 0;
function ucScheduleSave() { clearTimeout(ucSaveTimer); ucSaveTimer = setTimeout(() => { if (settingsState.ready) scheduleOptionsSave(); }, 300); }
function ucCollectSettings() {
  const pairs = { ...uc.pairs, [uc.category]: [ucEl.from.value, ucEl.to.value] };
  return { category: uc.category, precision: uc.precision, notation: uc.notation, places: uc.places, pairs: JSON.stringify(pairs) };
}
function ucLoadSettings(saved) {
  if (!saved) return;
  uc.category = UC.categoryById(saved.category).id;
  uc.precision = saved.precision; uc.notation = saved.notation; uc.places = saved.places;
  try { const pairs = JSON.parse(saved.pairs || '{}'); uc.pairs = pairs && typeof pairs === 'object' ? pairs : {}; } catch { uc.pairs = {}; }
  uc.text = UC.categoryById(uc.category).special ? '255' : '1'; ucEl.input.value = uc.text;
  ucSyncOptions(); ucFillUnits(); ucRender();
}
function ucSyncOptions() {
  ucEl.precision.value = uc.precision; ucEl.precisionOut.textContent = String(uc.precision); setRangeFill(ucEl.precision);
  ucEl.places.value = uc.places; ucEl.placesOut.textContent = String(uc.places); setRangeFill(ucEl.places);
  for (const button of ucEl.notation.querySelectorAll('[data-notation]')) button.classList.toggle('active', button.dataset.notation === uc.notation);
  syncSeg(ucEl.notation);
  ucEl.precisionField.classList.toggle('hidden', uc.notation === 'fixed');
  ucEl.placesField.classList.toggle('hidden', uc.notation !== 'fixed');
}

/* actions */
function ucResultText(plain) {
  const state = uc.last;
  if (!state || !state.parsed.ok) return '';
  if (state.category.special) return plain ? state.main : `${ucGroupBits(state.main, state.to.radix)} ${state.to.symbol}`;
  return plain ? UC.plainNumber(state.value) : `${ucFormat(state.value)} ${state.to.symbol}`;
}
async function ucCopy(text, message) {
  if (!text) { showPasteToast('Não há resultado para copiar.', 'error'); return; }
  let ok = false;
  try { ok = await window.arc.writeClipboardText(text); } catch { ok = false; }
  showPasteToast(ok ? message : 'Não foi possível copiar.', ok ? 'success' : 'error');
}
ucBuildCats();
ucEl.input.addEventListener('input', () => { uc.touched = true; uc.text = ucEl.input.value; ucRender(); });
ucEl.input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); ucPushHistory(); if (event.ctrlKey || event.metaKey) ucCopy(ucResultText(false), 'Resultado copiado.'); } });
ucEl.input.addEventListener('blur', ucPushHistory);
for (const select of [ucEl.from, ucEl.to]) select.addEventListener('change', () => { uc.touched = true; uc.pairs[uc.category] = [ucEl.from.value, ucEl.to.value]; ucRender(); ucScheduleSave(); });
ucEl.swap.addEventListener('click', () => {
  uc.touched = true;
  const state = uc.last;
  const from = ucEl.from.value; ucEl.from.value = ucEl.to.value; ucEl.to.value = from;
  if (state && state.parsed.ok && !state.category.special) { const swapped = UC.plainNumber(state.value, 12); if (swapped) { uc.text = swapped.replace('.', ','); ucEl.input.value = uc.text; } }
  else if (state && state.parsed.ok && state.category.special) { uc.text = state.main; ucEl.input.value = uc.text; }
  uc.pairs[uc.category] = [ucEl.from.value, ucEl.to.value]; ucRender(); ucScheduleSave();
});
ucEl.notation.addEventListener('click', (event) => { const button = event.target.closest('[data-notation]'); if (!button) return; uc.notation = button.dataset.notation; ucSyncOptions(); ucRender(); ucScheduleSave(); });
ucEl.precision.addEventListener('input', () => { uc.precision = Number(ucEl.precision.value); ucEl.precisionOut.textContent = String(uc.precision); setRangeFill(ucEl.precision); ucRender(); ucScheduleSave(); });
ucEl.places.addEventListener('input', () => { uc.places = Number(ucEl.places.value); ucEl.placesOut.textContent = String(uc.places); setRangeFill(ucEl.places); ucRender(); ucScheduleSave(); });
ucEl.table.addEventListener('click', (event) => { const row = event.target.closest('.uc-row-item'); if (row) ucCopy(row.dataset.copy, 'Valor copiado.'); });
ucEl.history.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]'); const entry = button && uc.history[Number(button.dataset.index)];
  if (!entry) return;
  uc.category = entry.cat; uc.pairs[entry.cat] = [entry.from, entry.to]; uc.text = entry.text; ucEl.input.value = entry.text;
  ucFillUnits(); ucRender(); ucScheduleSave();
});
ucEl.historyClear.addEventListener('click', () => { uc.history = []; ucRenderHistory(); });
ucEl.copy.addEventListener('click', () => ucCopy(ucResultText(false), 'Resultado copiado.'));
ucEl.copyPlain.addEventListener('click', () => ucCopy(ucResultText(true), 'Número copiado (sem formatação).'));
ucEl.copyTable.addEventListener('click', () => {
  const state = uc.last;
  if (!state || !state.parsed.ok) { showPasteToast('Não há tabela para copiar.', 'error'); return; }
  const lines = state.category.special ? state.rows.map((row) => `${row.unit.label}: ${row.text}`) : state.rows.map((row) => `${row.unit.label} (${row.unit.symbol}): ${ucFormat(row.value)}`);
  ucCopy(`${uc.text.trim()} ${state.from.symbol} =\n${lines.join('\n')}`, 'Tabela copiada.');
});
ucFillUnits(); ucSyncOptions(); ucRender(); ucRenderHistory();
uc.ready = true;


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
window.arc.onSenderEvent(handleSenderEvent);

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
  if (outputPath) { receiver.destinationRoot = outputPath; receiverElements.outputPath.value = outputPath; saveSettings({ paths: { receiver: outputPath } }); }
});
receiverElements.openOutput.addEventListener('click', () => window.arc.showOutput(receiver.destinationRoot));
receiverElements.copyUrl.addEventListener('click', async () => {
  if (await window.arc.copyReceiverUrl()) showPasteToast('Endereço copiado.');
});

senderElements.selectFiles.addEventListener('click', chooseSenderFiles);
senderElements.selectFilesMain.addEventListener('click', chooseSenderFiles);
senderElements.start.addEventListener('click', startSenderSession);
senderElements.stop.addEventListener('click', stopSenderSession);
senderElements.clear.addEventListener('click', () => { sender.items = []; renderSenderSelection(); });
senderElements.copyUrl.addEventListener('click', async () => {
  if (await window.arc.copySenderUrl()) showPasteToast('Endereço copiado.');
});
senderElements.selectedList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sender-remove]');
  if (!button || sender.running) return;
  sender.items.splice(Number(button.dataset.senderRemove), 1);
  renderSenderSelection();
});
wireDropZone(senderElements.dropZone, addSenderItems, (paths) => window.arc.addSenderPaths(paths));

loadSettings();
window.arc.getUpdateState().then(renderUpdateState);
window.arc.getReceiverState().then(renderReceiverState);
window.arc.getSenderState().then(renderSenderState);
metadataElements.colorProfile.classList.add('active');
converterElements.colorProfile.classList.add('active');
renderPresets(); updateResizeTarget(); updateConverterControls(); updateRenamerControls(); refreshRenamePreview(); updateCompressorSummary();
[resizeElements.percentageRange, converterElements.qualityRange].forEach(setRangeFill);
initSegments();
