/**
 * Secure Narrow Preload Bridge (CommonJS for Electron)
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const api = {
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        const p = webUtils.getPathForFile(file);
        if (p) return p;
      }
    } catch {
      // fallback
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
