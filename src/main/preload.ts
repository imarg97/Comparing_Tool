/**
 * Secure Narrow Preload Bridge
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  CopyRequest,
  DiffxPreloadAPI,
  FolderComparisonOptions,
  SaveRequest,
  ScanProgress,
  StructuredDiffRequest,
} from '../shared/types.js';

const droppedFileCache = new Map<string, string>();

if (typeof window !== 'undefined') {
  window.addEventListener(
    'drop',
    (e: DragEvent) => {
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

const api: DiffxPreloadAPI = {
  getPathForFile: (file: File) => {
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
      return droppedFileCache.get(key) || '';
    }
    if (file.name && droppedFileCache.has(file.name)) {
      return droppedFileCache.get(file.name) || '';
    }
    return (file as any).path || '';
  },

  selectDirectory: (defaultPath?: string, side?: 'left' | 'right') =>
    ipcRenderer.invoke('dialog:select-directory', defaultPath, side),

  selectFile: (defaultPath?: string, side?: 'left' | 'right') =>
    ipcRenderer.invoke('dialog:select-file', defaultPath, side),

  showConfirmDialog: (options) =>
    ipcRenderer.invoke('dialog:confirm', options),

  compareFolders: (leftPath: string, rightPath: string, options: FolderComparisonOptions) =>
    ipcRenderer.invoke('folder:compare', leftPath, rightPath, options),

  cancelFolderComparison: () =>
    ipcRenderer.invoke('folder:cancel'),

  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => {
      callback(progress);
    };
    ipcRenderer.on('folder:scan-progress', subscription);
    return () => {
      ipcRenderer.removeListener('folder:scan-progress', subscription);
    };
  },

  readFile: (filePath: string, maxBytes?: number, side?: 'left' | 'right') =>
    ipcRenderer.invoke('file:read', filePath, maxBytes, side),

  saveFile: (request: SaveRequest) =>
    ipcRenderer.invoke('file:save', request),

  copyFile: (request: CopyRequest) =>
    ipcRenderer.invoke('file:copy', request),

  compareStructured: (request: StructuredDiffRequest) =>
    ipcRenderer.invoke('structured:compare', request),

  openInSystemExplorer: (targetPath: string) =>
    ipcRenderer.invoke('system:open-explorer', targetPath),

  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
};

contextBridge.exposeInMainWorld('diffxAPI', api);
