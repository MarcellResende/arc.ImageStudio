import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from 'electron';
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import updaterPackage from 'electron-updater';
import QRCode from 'qrcode';
import { createBatchDirectory, isSupportedImage, optimizeImage } from './optimizer.mjs';
import { imageMetadata, imagePreview, resizeImage, resizePreview } from './resizer.mjs';
import { cleanMetadataImage, inspectImageMetadata } from './metadata-cleaner.mjs';
import { convertImage, conversionPreview, isSupportedConversionInput } from './converter.mjs';
import { saveClipboardImageItems } from './clipboard-image.mjs';
import { buildRenamePreview, isSupportedRenameInput, renameBatch } from './renamer.mjs';
import { WifiReceiver, sanitizeFileName } from './wifi-receiver.mjs';
import { WifiSender } from './wifi-sender.mjs';
import { SettingsStore } from './settings.mjs';
import { collectAttachments } from './attachments.mjs';
import { analyzeProject } from './project-analyzer.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const { autoUpdater } = updaterPackage;

/* Identity. The product is arc.Studio; the legacy name is kept only to find files from older versions. */
const PRODUCT_NAME = 'arc.Studio';
const LEGACY_PRODUCT_NAME = 'ARC Image Studio';
app.setName(PRODUCT_NAME);
// Preferences live in userData (outside the install folder), so updates and reinstalls never replace them.
// ARC_STUDIO_USER_DATA lets automated tests use a throw-away profile instead of the real one.
app.setPath('userData', process.env.ARC_STUDIO_USER_DATA || path.join(app.getPath('appData'), PRODUCT_NAME));

const settings = new SettingsStore({
  filePath: path.join(app.getPath('userData'), 'settings.json'),
  onError: (error) => console.error('[settings]', error?.message || error)
});
const settingsLoad = settings.load();

// One instance only: two copies would fight over the settings file, the receiver folder and the network sessions.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: '',
  percent: 0,
  transferred: 0,
  total: 0,
  message: '',
  showNotice: false
};
let manualUpdateCheck = false;
let installAfterDownload = false;
let clipboardSessionDirectory = '';
let receiverQrDataUrl = '';
let senderQrDataUrl = '';

const wifiReceiver = new WifiReceiver({
  onEvent: (data) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('receiver:event', data);
    }
  }
});

const wifiSender = new WifiSender({
  onEvent: (data) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('sender:event', data);
    }
  }
});

/* New installs save to Pictures/arc.Studio. If the user already has the old "ARC Image Studio" folder
   (and no new one yet) keep using it, so existing batches are not split across two folders. */
function defaultOutputRoot() {
  const pictures = app.getPath('pictures');
  const current = path.join(pictures, PRODUCT_NAME);
  const legacy = path.join(pictures, LEGACY_PRODUCT_NAME);
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}

function defaultReceiverOutput() {
  return path.join(defaultOutputRoot(), 'Recebidos');
}

function savedReceiverOutput() {
  const saved = settings.get().paths.receiver;
  return saved && folderIsUsable(saved) ? saved : defaultReceiverOutput();
}

function publicReceiverState() {
  const state = wifiReceiver.publicState();
  return {
    ...state,
    destinationRoot: state.destinationRoot || savedReceiverOutput(),
    qrDataUrl: state.running ? receiverQrDataUrl : ''
  };
}

function publicSenderState() {
  const state = wifiSender.publicState();
  return { ...state, qrDataUrl: state.running ? senderQrDataUrl : '' };
}

function publicUpdateState() {
  return { ...updateState };
}

function sendUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:state', publicUpdateState());
  }
  return publicUpdateState();
}

function friendlyUpdateError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Falha desconhecida');
  if (/net::|network|internet|ENOTFOUND|ECONN/i.test(message)) return 'Não foi possível acessar o GitHub. Confira sua conexão e tente novamente.';
  if (/404|latest\.yml/i.test(message)) return 'O release mais recente ainda não possui os arquivos de atualização.';
  return 'Não foi possível concluir a atualização. Tente novamente em alguns minutos.';
}

async function checkForUpdates({ manual = false } = {}) {
  manualUpdateCheck = manual;
  if (!app.isPackaged) {
    return sendUpdateState({
      status: 'development',
      message: 'A verificação automática funciona na versão instalada.',
      showNotice: manual
    });
  }
  if (['downloading', 'installing'].includes(updateState.status)) return publicUpdateState();
  sendUpdateState({ status: 'checking', message: 'Procurando uma versão mais recente…', showNotice: manual, percent: 0 });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: manual });
  }
  return publicUpdateState();
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateState({ status: 'checking', message: 'Procurando uma versão mais recente…', showNotice: manualUpdateCheck });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateState({
      status: 'available',
      availableVersion: info.version,
      message: `A versão ${info.version} está pronta para baixar.`,
      showNotice: true,
      percent: 0
    });
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateState({
      status: 'up-to-date',
      availableVersion: '',
      message: 'Você já está usando a versão mais recente.',
      showNotice: manualUpdateCheck,
      percent: 0
    });
    manualUpdateCheck = false;
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateState({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent || 0)),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      message: 'Baixando a atualização com segurança…',
      showNotice: true
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateState({
      status: 'installing',
      availableVersion: info.version,
      percent: 100,
      message: 'Download concluído. Reiniciando para instalar…',
      showNotice: true
    });
    if (installAfterDownload) setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
  });
  autoUpdater.on('error', (error) => {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: manualUpdateCheck || installAfterDownload });
    installAfterDownload = false;
    manualUpdateCheck = false;
  });

  setTimeout(() => checkForUpdates(), 5000);
  setInterval(() => checkForUpdates(), 6 * 60 * 60 * 1000).unref();
}

function createWindow() {
  const saved = settings.get().window;
  const window = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#0d1119',
    title: PRODUCT_NAME,
    icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico'),
    autoHideMenuBar: true,
    // Integrated title bar: the app toolbar doubles as the drag region; native caption buttons stay.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d1119', symbolColor: '#a8b3c3', height: 52 },
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (saved.maximized) window.maximize();
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (window.isDestroyed() || window.isMinimized() || window.isFullScreen()) return;
      const { width, height } = window.getNormalBounds();
      settings.update({ window: { width, height, maximized: window.isMaximized() } });
    }, 400);
  };
  for (const eventName of ['resize', 'maximize', 'unmaximize']) window.on(eventName, rememberBounds);
  // Windows is shutting down or the user is logging off: no async work is guaranteed to finish.
  window.on('session-end', () => { wifiReceiver.emergencyCleanup(); settings.flushSync(); });

  window.loadFile(path.join(currentDirectory, 'renderer', 'index.html'));
}

async function fileEntry(filePath, relativePath = path.basename(filePath)) {
  const info = await stat(filePath);
  return {
    id: `${filePath}:${info.size}:${info.mtimeMs}`,
    path: filePath,
    name: path.basename(filePath),
    relativePath,
    size: info.size
  };
}

async function scanDirectory(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      images.push(...await scanDirectory(root, fullPath));
    } else if (entry.isFile() && isSupportedImage(fullPath)) {
      images.push(await fileEntry(fullPath, path.relative(root, fullPath)));
    }
  }
  return images;
}

async function scanConversionDirectory(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) images.push(...await scanConversionDirectory(root, fullPath));
    else if (entry.isFile() && isSupportedConversionInput(fullPath)) images.push(await fileEntry(fullPath, path.relative(root, fullPath)));
  }
  return images;
}

async function scanRenameDirectory(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) images.push(...await scanRenameDirectory(root, fullPath));
    else if (entry.isFile() && isSupportedRenameInput(fullPath)) images.push(await fileEntry(fullPath, path.relative(root, fullPath)));
  }
  return images;
}

async function scanAllFiles(root, directory = root, files = []) {
  if (files.length >= 10000) return files;
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (files.length >= 10000) break;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await scanAllFiles(root, fullPath, files);
    else if (entry.isFile()) files.push(await fileEntry(fullPath, path.relative(root, fullPath)));
  }
  return files;
}

async function cleanupLegacyClipboardFiles() {
  for (const productName of [PRODUCT_NAME, LEGACY_PRODUCT_NAME]) {
    const clipboardRoot = path.join(app.getPath('temp'), productName, 'clipboard');
    const entries = await readdir(clipboardRoot, { withFileTypes: true }).catch(() => []);
    await Promise.all(entries
      .filter((entry) => entry.isFile() && /^Imagem colada .+\.png$/i.test(entry.name))
      .map((entry) => rm(path.join(clipboardRoot, entry.name), { force: true })));
  }
}

ipcMain.handle('clipboard:images', async () => {
  const clipboardItems = await clipboard.read();
  if (!clipboardSessionDirectory) {
    clipboardSessionDirectory = path.join(app.getPath('temp'), PRODUCT_NAME, 'clipboard', `session-${process.pid}-${Date.now()}`);
  }
  const savedPaths = await saveClipboardImageItems(clipboardItems, clipboardSessionDirectory);
  return Promise.all(savedPaths.map((filePath) => fileEntry(filePath)));
});

ipcMain.handle('files:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione as imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens compatíveis', extensions: ['jpg', 'jpeg', 'png'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map((filePath) => fileEntry(filePath)));
});

ipcMain.handle('folder:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione a pasta com as imagens',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return [];
  return scanDirectory(result.filePaths[0]);
});

ipcMain.handle('conversion:files-select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione as imagens para converter',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens compatíveis', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'svg'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.filter(isSupportedConversionInput).map((filePath) => fileEntry(filePath)));
});

ipcMain.handle('conversion:folder-select', async () => {
  const result = await dialog.showOpenDialog({ title: 'Selecione a pasta com as imagens', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return [];
  return scanConversionDirectory(result.filePaths[0]);
});

ipcMain.handle('rename:files-select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione as imagens para renomear',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens compatíveis', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'svg'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.filter(isSupportedRenameInput).map((filePath) => fileEntry(filePath)));
});

ipcMain.handle('rename:folder-select', async () => {
  const result = await dialog.showOpenDialog({ title: 'Selecione a pasta com as imagens', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return [];
  return scanRenameDirectory(result.filePaths[0]);
});

ipcMain.handle('rename:from-paths', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 10000) return [];
  const images = [];
  for (const candidate of paths) {
    if (typeof candidate !== 'string' || !candidate) continue;
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) images.push(...await scanRenameDirectory(candidate));
    else if (info?.isFile() && isSupportedRenameInput(candidate)) images.push(await fileEntry(candidate));
    if (images.length >= 10000) break;
  }
  return images.slice(0, 10000);
});

ipcMain.handle('rename:preview', async (_event, items, options) => {
  if (!Array.isArray(items) || items.length > 10000) return [];
  return buildRenamePreview(items, options);
});

ipcMain.handle('conversion:from-paths', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 10000) return [];
  const images = [];
  for (const candidate of paths) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) images.push(...await scanConversionDirectory(candidate));
      else if (info.isFile() && isSupportedConversionInput(candidate)) images.push(await fileEntry(candidate));
    } catch {
      // Ignore items removed while they are being added.
    }
  }
  return images.slice(0, 10000);
});

ipcMain.handle('files:from-paths', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 10000) return [];
  const images = [];
  for (const candidate of paths) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) images.push(...await scanDirectory(candidate));
      else if (info.isFile() && isSupportedImage(candidate)) images.push(await fileEntry(candidate));
    } catch {
      // A dragged item may disappear before it is inspected; skip it safely.
    }
  }
  return images.slice(0, 10000);
});

ipcMain.handle('output:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione onde salvar os lotes do arc.Studio',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('output:default', () => defaultOutputRoot());

/* A saved folder is usable if it exists or can be created (its parent exists). If it sits on a disk that is
   not connected, the default is used for now and the saved choice is kept, so it returns with the disk. */
function folderIsUsable(folder) {
  return existsSync(folder) || existsSync(path.dirname(folder));
}

ipcMain.handle('settings:get', () => {
  const saved = settings.get();
  const defaults = { output: defaultOutputRoot(), receiverOutput: defaultReceiverOutput() };
  const effectivePaths = {};
  const unavailable = [];
  for (const [key, folder] of Object.entries(saved.paths)) {
    if (!folder) continue;
    if (folderIsUsable(folder)) effectivePaths[key] = folder;
    else unavailable.push(key);
  }
  return { settings: saved, effectivePaths, unavailable, firstRun: settingsLoad.firstRun, defaults };
});
ipcMain.handle('settings:update', (_event, patch) => settings.update(patch));

/* Prompt Gen: files and folders to analyse. Only what the user picks or drops is read, locally. */
ipcMain.handle('attachments:select', async (event, mode) => {
  const folder = mode === 'folder';
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: folder ? 'Escolha uma pasta para analisar' : 'Escolha os arquivos para analisar',
    properties: folder ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections']
  });
  return result.canceled ? null : collectAttachments(result.filePaths);
});
ipcMain.handle('attachments:from-paths', (_event, paths) => collectAttachments(paths));

/* CLAUDE.md generator: analyse a project folder the user picked or dropped (read-only, local). */
ipcMain.handle('project:select', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showOpenDialog(owner, { title: 'Escolha a pasta do projeto', properties: ['openDirectory'] });
  return result.canceled ? null : analyzeProject(result.filePaths[0]);
});
ipcMain.handle('project:analyze', (_event, folder) => {
  if (typeof folder !== 'string' || !folder) throw new Error('Escolha uma pasta de projeto.');
  return analyzeProject(folder);
});
ipcMain.handle('claudemd:save', async (event, payload = {}) => {
  const { text, directory } = payload;
  if (typeof text !== 'string' || !text.trim() || text.length > 2 * 1024 * 1024) throw new Error('Não há CLAUDE.md para salvar.');
  const folder = typeof directory === 'string' && directory && existsSync(directory) ? directory : app.getPath('documents');
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showSaveDialog(owner, {
    title: 'Salvar CLAUDE.md',
    defaultPath: path.join(folder, 'CLAUDE.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await writeFile(result.filePath, `${text.replace(/\s+$/, '')}\n`, 'utf8');
  return result.filePath;
});

/* Prompt Gen: copy and save. Text only, size-capped, written as UTF-8 without BOM. */
const MAX_PROMPT_BYTES = 2 * 1024 * 1024;
ipcMain.handle('clipboard:write-text', (_event, text) => {
  if (typeof text !== 'string' || !text || text.length > MAX_PROMPT_BYTES) return false;
  clipboard.writeText(text);
  return true;
});
ipcMain.handle('prompt:save', async (event, payload = {}) => {
  const { text, suggestedName } = payload;
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_PROMPT_BYTES) throw new Error('Não há prompt para salvar.');
  const fileName = sanitizeFileName(typeof suggestedName === 'string' && suggestedName ? suggestedName : 'prompt.md');
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showSaveDialog(owner, {
    title: 'Salvar prompt',
    defaultPath: path.join(app.getPath('documents'), fileName),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Texto', extensions: ['txt'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await writeFile(result.filePath, `${text.replace(/\s+$/, '')}\n`, 'utf8');
  return result.filePath;
});

ipcMain.handle('output:show', async (_event, outputPath) => {
  if (typeof outputPath === 'string' && outputPath) await shell.openPath(outputPath);
});

ipcMain.handle('receiver:get-state', () => publicReceiverState());
ipcMain.handle('receiver:default-output', () => defaultReceiverOutput());
ipcMain.handle('receiver:select-output', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha onde salvar os arquivos recebidos',
    defaultPath: wifiReceiver.destinationRoot || savedReceiverOutput(),
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('receiver:start', async (_event, options = {}) => {
  const destinationRoot = typeof options.destinationRoot === 'string' && options.destinationRoot.trim()
    ? options.destinationRoot
    : savedReceiverOutput();
  const state = await wifiReceiver.start({ destinationRoot });
  receiverQrDataUrl = await QRCode.toDataURL(state.url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 420,
    color: { dark: '#0A1322FF', light: '#F5F7FCFF' }
  });
  return publicReceiverState();
});
ipcMain.handle('receiver:stop', async () => {
  await wifiReceiver.stop();
  receiverQrDataUrl = '';
  return publicReceiverState();
});
ipcMain.handle('receiver:copy-url', () => {
  const { url } = wifiReceiver.publicState();
  if (url) clipboard.writeText(url);
  return Boolean(url);
});

ipcMain.handle('sender:files-select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha os arquivos para enviar',
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.slice(0, 10000).map((filePath) => fileEntry(filePath)));
});
ipcMain.handle('sender:from-paths', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 10000) return [];
  const files = [];
  for (const candidate of paths) {
    if (files.length >= 10000 || typeof candidate !== 'string' || !candidate) break;
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) await scanAllFiles(candidate, candidate, files);
    else if (info?.isFile()) files.push(await fileEntry(candidate));
  }
  return files.slice(0, 10000);
});
ipcMain.handle('sender:get-state', () => publicSenderState());
ipcMain.handle('sender:start', async (_event, options = {}) => {
  const items = Array.isArray(options.items) ? options.items.slice(0, 10000) : [];
  const state = await wifiSender.start({ items });
  senderQrDataUrl = await QRCode.toDataURL(state.url, {
    errorCorrectionLevel: 'M', margin: 2, width: 420,
    color: { dark: '#0A1322FF', light: '#F5F7FCFF' }
  });
  return publicSenderState();
});
ipcMain.handle('sender:stop', async () => {
  await wifiSender.stop();
  senderQrDataUrl = '';
  return publicSenderState();
});
ipcMain.handle('sender:copy-url', () => {
  const { url } = wifiSender.publicState();
  if (url) clipboard.writeText(url);
  return Boolean(url);
});

ipcMain.handle('update:get-state', () => publicUpdateState());
ipcMain.handle('update:check', () => checkForUpdates({ manual: true }));
ipcMain.handle('update:install', () => {
  if (updateState.status === 'installing') {
    autoUpdater.quitAndInstall(true, true);
    return publicUpdateState();
  }
  if (updateState.status !== 'available') return publicUpdateState();
  installAfterDownload = true;
  sendUpdateState({ status: 'downloading', percent: 0, message: 'Preparando o download…', showNotice: true });
  autoUpdater.downloadUpdate().catch((error) => {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: true });
    installAfterDownload = false;
  });
  return publicUpdateState();
});

ipcMain.handle('image:metadata', async (_event, sourcePath) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return imageMetadata(sourcePath);
});

ipcMain.handle('image:preview', async (_event, sourcePath, maxWidth, maxHeight) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return imagePreview(sourcePath, maxWidth, maxHeight);
});

ipcMain.handle('image:resize-preview', async (_event, sourcePath, options, maxWidth, maxHeight) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return resizePreview(sourcePath, options, maxWidth, maxHeight);
});

ipcMain.handle('conversion:preview', async (_event, sourcePath, maxWidth, maxHeight) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return conversionPreview(sourcePath, maxWidth, maxHeight);
});

ipcMain.handle('metadata:inspect', async (_event, items) => {
  if (!Array.isArray(items) || items.length > 10000) return [];
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;

  async function inspectNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      try {
        results[index] = { id: item.id, ok: true, ...await inspectImageMetadata(item.path) };
      } catch (error) {
        results[index] = { id: item.id, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => inspectNext()));
  return results;
});

ipcMain.handle('conversion:start', async (event, payload) => {
  const { items, outputRoot, options } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot, new Date(), 'Convertido');
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('conversion:started', { id: item.id });
      try {
        const result = await convertImage({ sourcePath: item.path, relativePath: item.relativePath, outputRoot: batchPath, options });
        results[itemIndex] = { id: item.id, ok: true, ...result };
        completed += 1;
        event.sender.send('conversion:progress', { id: item.id, index: completed - 1, total: items.length, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[itemIndex] = { id: item.id, ok: false, error: message };
        completed += 1;
        event.sender.send('conversion:progress', { id: item.id, index: completed - 1, total: items.length, ok: false, error: message });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));
  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'arc.Studio — conversão concluída',
      body: `${successful} ${successful === 1 ? 'imagem convertida' : 'imagens convertidas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }
  return { results, batchPath };
});

ipcMain.handle('rename:start', async (event, payload) => {
  const { items, outputRoot, options } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');
  for (const item of items) event.sender.send('rename:started', { id: item.id });

  const response = await renameBatch({
    items,
    outputRoot,
    options,
    onProgress: (result, index, total) => event.sender.send('rename:progress', { ...result, index, total })
  });

  if (Notification.isSupported()) {
    const successful = response.results.filter((result) => result.ok).length;
    const notification = new Notification({
      title: 'arc.Studio — nomes atualizados',
      body: response.outputMode === 'original'
        ? `${successful} ${successful === 1 ? 'arquivo renomeado' : 'arquivos renomeados'} nos locais de origem.`
        : `${successful} ${successful === 1 ? 'cópia renomeada' : 'cópias renomeadas'} em ${path.basename(response.batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    if (response.batchPath) notification.on('click', () => shell.openPath(response.batchPath));
    notification.show();
  }

  return response;
});

ipcMain.handle('optimize:start', async (event, payload) => {
  const { items, outputRoot, level } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot);
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('optimize:started', { id: item.id });

    try {
      const result = await optimizeImage({
        sourcePath: item.path,
        relativePath: item.relativePath,
        outputRoot: batchPath,
        level
      });
      results[itemIndex] = { id: item.id, ok: true, ...result };
      completed += 1;
      event.sender.send('optimize:progress', {
        id: item.id,
        index: completed - 1,
        total: items.length,
        ok: true,
        ...result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results[itemIndex] = { id: item.id, ok: false, error: message };
      completed += 1;
      event.sender.send('optimize:progress', {
        id: item.id,
        index: completed - 1,
        total: items.length,
        ok: false,
        error: message
      });
    }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'arc.Studio — concluído',
      body: `${successful} ${successful === 1 ? 'imagem pronta' : 'imagens prontas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

ipcMain.handle('resize:start', async (event, payload) => {
  const { items, outputRoot, options } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot, new Date(), 'Redimensionado');
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('resize:started', { id: item.id });

      try {
        const result = await resizeImage({
          sourcePath: item.path,
          relativePath: item.relativePath,
          outputRoot: batchPath,
          options
        });
        results[itemIndex] = { id: item.id, ok: true, ...result };
        completed += 1;
        event.sender.send('resize:progress', { id: item.id, index: completed - 1, total: items.length, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[itemIndex] = { id: item.id, ok: false, error: message };
        completed += 1;
        event.sender.send('resize:progress', { id: item.id, index: completed - 1, total: items.length, ok: false, error: message });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'arc.Studio — concluído',
      body: `${successful} ${successful === 1 ? 'imagem redimensionada' : 'imagens redimensionadas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

ipcMain.handle('metadata:start', async (event, payload) => {
  const { items, outputRoot, preserveColorProfile = true } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot, new Date(), 'Metadados removidos');
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('metadata:started', { id: item.id });
      try {
        const result = await cleanMetadataImage({
          sourcePath: item.path,
          relativePath: item.relativePath,
          outputRoot: batchPath,
          preserveColorProfile
        });
        results[itemIndex] = { id: item.id, ok: true, ...result };
        completed += 1;
        event.sender.send('metadata:progress', { id: item.id, index: completed - 1, total: items.length, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[itemIndex] = { id: item.id, ok: false, error: message };
        completed += 1;
        event.sender.send('metadata:progress', { id: item.id, index: completed - 1, total: items.length, ok: false, error: message });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'arc.Studio — metadados removidos',
      body: `${successful} ${successful === 1 ? 'imagem protegida' : 'imagens protegidas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

app.on('second-instance', () => {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

if (hasInstanceLock) {
  app.whenReady().then(() => {
    cleanupLegacyClipboardFiles().catch(() => {});
    createWindow();
    configureAutoUpdater();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* Closing the app ends the Wi-Fi sessions first: the ports close, in-flight transfers are cut and their
   partial files are deleted. quit is held back (briefly) until that is done, then resumed. */
let shutdownStarted = false;
app.on('before-quit', (event) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  event.preventDefault();
  const grace = new Promise((resolve) => setTimeout(resolve, 5000));
  Promise.race([Promise.allSettled([wifiReceiver.stop(), wifiSender.stop()]), grace]).finally(() => {
    wifiReceiver.emergencyCleanup();
    settings.flushSync();
    app.quit();
  });
});

app.on('will-quit', () => {
  settings.flushSync();
  if (!clipboardSessionDirectory) return;
  const clipboardRoot = path.resolve(app.getPath('temp'), PRODUCT_NAME, 'clipboard');
  const sessionPath = path.resolve(clipboardSessionDirectory);
  if (sessionPath.startsWith(`${clipboardRoot}${path.sep}`)) {
    try { rmSync(sessionPath, { recursive: true, force: true }); } catch {}
  }
});
