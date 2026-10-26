/**
 * Secure Narrow Preload Bridge (CommonJS for Electron)
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Cache dropped file paths in preload to bridge File objects across context isolation
const droppedFileCache = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener(
    'drop',
    (e) => {
      try {
        if (e.dataTransfer && e.dataTransfer.files) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
              try {
                const p = webUtils.getPathForFile(file);
                if (p) {
                  const key = `${file.name}_${file.size}_${file.lastModified}`;
                  droppedFileCache.set(key, p);
                  droppedFileCache.set(file.name, p);
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // non-fatal
      }
    },
    true
  );
}

const api = {
  getPathForFile: (file) => {
    if (!file) return '';
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        const p = webUtils.getPathForFile(file);
        if (p) return p;
      }
    } catch {
      // fallback
    }
    const key = `${file.name || ''}_${file.size || ''}_${file.lastModified || ''}`;
    if (droppedFileCache.has(key)) {
      return droppedFileCache.get(key);
    }
    if (file.name && droppedFileCache.has(file.name)) {
      return droppedFileCache.get(file.name);
    }
    return file.path || '';
  },

  selectDirectory: (defaultPath, side) =>
    ipcRenderer.invoke('dialog:select-directory', defaultPath, side),

  selectFile: (defaultPath, side) =>
    ipcRenderer.invoke('dialog:select-file', defaultPath, side),

  showConfirmDialog: (options) =>
    ipcRenderer.invoke('dialog:confirm', options),

  compareFolders: (leftPath, rightPath, options) =>
    ipcRenderer.invoke('folder:compare', leftPath, rightPath, options),

  cancelFolderComparison: () =>
    ipcRenderer.invoke('folder:cancel'),

  onScanProgress: (callback) => {
    const subscription = (_event, progress) => {
      callback(progress);
    };
    ipcRenderer.on('folder:scan-progress', subscription);
    return () => {
      ipcRenderer.removeListener('folder:scan-progress', subscription);
    };
  },

  readFile: (filePath, maxBytes, side) =>
    ipcRenderer.invoke('file:read', filePath, maxBytes, side),

  saveFile: (request) =>
    ipcRenderer.invoke('file:save', request),

  copyFile: (request) =>
    ipcRenderer.invoke('file:copy', request),

  compareStructured: (request) =>
    ipcRenderer.invoke('structured:compare', request),

  openInSystemExplorer: (targetPath) =>
    ipcRenderer.invoke('system:open-explorer', targetPath),

  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
};

contextBridge.exposeInMainWorld('diffxAPI', api);
