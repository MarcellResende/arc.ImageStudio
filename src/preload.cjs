const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('arc', {
  selectFiles: () => ipcRenderer.invoke('files:select'),
  selectFolder: () => ipcRenderer.invoke('folder:select'),
  addPaths: (paths) => ipcRenderer.invoke('files:from-paths', paths),
  selectConversionFiles: () => ipcRenderer.invoke('conversion:files-select'),
  selectConversionFolder: () => ipcRenderer.invoke('conversion:folder-select'),
  addConversionPaths: (paths) => ipcRenderer.invoke('conversion:from-paths', paths),
  pasteClipboardImages: () => ipcRenderer.invoke('clipboard:images'),
  selectRenameFiles: () => ipcRenderer.invoke('rename:files-select'),
  selectRenameFolder: () => ipcRenderer.invoke('rename:folder-select'),
  addRenamePaths: (paths) => ipcRenderer.invoke('rename:from-paths', paths),
  renamePreview: (items, options) => ipcRenderer.invoke('rename:preview', items, options),
  selectOutput: () => ipcRenderer.invoke('output:select'),
  defaultOutput: () => ipcRenderer.invoke('output:default'),
  showOutput: (outputPath) => ipcRenderer.invoke('output:show', outputPath),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  selectAttachments: (mode) => ipcRenderer.invoke('attachments:select', mode),
  addAttachmentPaths: (paths) => ipcRenderer.invoke('attachments:from-paths', paths),
  selectProject: () => ipcRenderer.invoke('project:select'),
  analyzeProject: (folder) => ipcRenderer.invoke('project:analyze', folder),
  saveClaudeMd: (payload) => ipcRenderer.invoke('claudemd:save', payload),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  savePromptFile: (payload) => ipcRenderer.invoke('prompt:save', payload),
  getReceiverState: () => ipcRenderer.invoke('receiver:get-state'),
  defaultReceiverOutput: () => ipcRenderer.invoke('receiver:default-output'),
  selectReceiverOutput: () => ipcRenderer.invoke('receiver:select-output'),
  startReceiver: (options) => ipcRenderer.invoke('receiver:start', options),
  stopReceiver: () => ipcRenderer.invoke('receiver:stop'),
  copyReceiverUrl: () => ipcRenderer.invoke('receiver:copy-url'),
  selectSenderFiles: () => ipcRenderer.invoke('sender:files-select'),
  addSenderPaths: (paths) => ipcRenderer.invoke('sender:from-paths', paths),
  getSenderState: () => ipcRenderer.invoke('sender:get-state'),
  startSender: (options) => ipcRenderer.invoke('sender:start', options),
  stopSender: () => ipcRenderer.invoke('sender:stop'),
  copySenderUrl: () => ipcRenderer.invoke('sender:copy-url'),
  imageMetadata: (sourcePath) => ipcRenderer.invoke('image:metadata', sourcePath),
  imagePreview: (sourcePath, maxWidth, maxHeight) => ipcRenderer.invoke('image:preview', sourcePath, maxWidth, maxHeight),
  resizePreview: (sourcePath, options, maxWidth, maxHeight) => ipcRenderer.invoke('image:resize-preview', sourcePath, options, maxWidth, maxHeight),
  conversionPreview: (sourcePath, maxWidth, maxHeight) => ipcRenderer.invoke('conversion:preview', sourcePath, maxWidth, maxHeight),
  inspectMetadata: (items) => ipcRenderer.invoke('metadata:inspect', items),
  optimize: (payload) => ipcRenderer.invoke('optimize:start', payload),
  resize: (payload) => ipcRenderer.invoke('resize:start', payload),
  cleanMetadata: (payload) => ipcRenderer.invoke('metadata:start', payload),
  convert: (payload) => ipcRenderer.invoke('conversion:start', payload),
  renameImages: (payload) => ipcRenderer.invoke('rename:start', payload),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
  onReceiverEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('receiver:event', listener);
    return () => ipcRenderer.removeListener('receiver:event', listener);
  },
  onSenderEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('sender:event', listener);
    return () => ipcRenderer.removeListener('sender:event', listener);
  },
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('optimize:progress', listener);
    return () => ipcRenderer.removeListener('optimize:progress', listener);
  },
  onStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('optimize:started', listener);
    return () => ipcRenderer.removeListener('optimize:started', listener);
  },
  onResizeProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('resize:progress', listener);
    return () => ipcRenderer.removeListener('resize:progress', listener);
  },
  onResizeStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('resize:started', listener);
    return () => ipcRenderer.removeListener('resize:started', listener);
  },
  onMetadataProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('metadata:progress', listener);
    return () => ipcRenderer.removeListener('metadata:progress', listener);
  },
  onMetadataStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('metadata:started', listener);
    return () => ipcRenderer.removeListener('metadata:started', listener);
  },
  onConversionProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('conversion:progress', listener);
    return () => ipcRenderer.removeListener('conversion:progress', listener);
  },
  onConversionStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('conversion:started', listener);
    return () => ipcRenderer.removeListener('conversion:started', listener);
  },
  onRenameProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('rename:progress', listener);
    return () => ipcRenderer.removeListener('rename:progress', listener);
  },
  onRenameStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('rename:started', listener);
    return () => ipcRenderer.removeListener('rename:started', listener);
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
