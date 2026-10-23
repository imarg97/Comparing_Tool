/**
 * Secure Narrow Preload Bridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  CopyRequest,
  DiffxPreloadAPI,
  FolderComparisonOptions,
  SaveRequest,
  ScanProgress,
  StructuredDiffRequest,
} from '../shared/types.js';

const api: DiffxPreloadAPI = {
  selectDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:select-directory', defaultPath),

  selectFile: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:select-file', defaultPath),

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

  readFile: (filePath: string, maxBytes?: number) =>
    ipcRenderer.invoke('file:read', filePath, maxBytes),

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
