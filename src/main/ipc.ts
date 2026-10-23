/**
 * IPC Handler Registration & Dispatcher (Main Process)
 */

import { dialog, ipcMain, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import {
  CopyRequest,
  FolderComparisonOptions,
  FolderComparisonResult,
  SaveRequest,
  ScanProgress,
  StructuredDiffRequest,
} from '../shared/types.js';
import { scanDirectory, ScanContext } from './fs-engine/scanner.js';
import { matchEntries } from '../shared/comparison-engine/matcher.js';
import { copySafeFile, readSafeFile, saveSafeFile } from './fs-engine/safe-fs.js';
import { compareStructuredData } from '../shared/comparison-engine/structured.js';

let activeScanContext: ScanContext | null = null;

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Folder Selection
  ipcMain.handle('dialog:select-directory', async (_event, defaultPath?: string, side?: string) => {
    const title = side ? `Select ${side.toUpperCase()} Directory to Compare` : 'Select Directory to Compare';
    const result = await dialog.showOpenDialog(mainWindow, {
      title,
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // File Selection
  ipcMain.handle('dialog:select-file', async (_event, defaultPath?: string, side?: string) => {
    const title = side ? `Select ${side.toUpperCase()} File to Compare` : 'Select File to Compare';
    const result = await dialog.showOpenDialog(mainWindow, {
      title,
      defaultPath: defaultPath || undefined,
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Confirmation Modal
  ipcMain.handle('dialog:confirm', async (_event, options) => {
    const response = await dialog.showMessageBox(mainWindow, {
      type: options.type || 'question',
      buttons: ['Confirm', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: options.title,
      message: options.message,
      detail: options.detail,
    });
    return response.response === 0;
  });

  // Folder Compare
  ipcMain.handle(
    'folder:compare',
    async (
      _event,
      leftPath: string,
      rightPath: string,
      options: FolderComparisonOptions
    ): Promise<FolderComparisonResult> => {
      const startTime = Date.now();

      // Reset any previous scan
      if (activeScanContext) {
        activeScanContext.isCancelled = true;
      }

      activeScanContext = {
        isCancelled: false,
        onProgress: (progress: ScanProgress) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('folder:scan-progress', progress);
          }
        },
      };

      const leftItems = await scanDirectory(leftPath, options, activeScanContext, 'scanning-left');
      const rightItems = await scanDirectory(rightPath, options, activeScanContext, 'scanning-right');

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('folder:scan-progress', {
          currentPath: 'Reconciling comparison entries...',
          scannedCount: leftItems.size + rightItems.size,
          phase: 'comparing',
        });
      }

      const { flatList, tree, summary } = matchEntries(leftItems, rightItems, options);
      summary.scanDurationMs = Date.now() - startTime;

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('folder:scan-progress', {
          currentPath: 'Complete',
          scannedCount: summary.total,
          phase: 'complete',
        });
      }

      activeScanContext = null;

      return {
        leftRoot: path.resolve(leftPath),
        rightRoot: path.resolve(rightPath),
        options,
        summary,
        tree,
        flatList,
        timestamp: Date.now(),
      };
    }
  );

  ipcMain.handle('folder:cancel', async () => {
    if (activeScanContext) {
      activeScanContext.isCancelled = true;
      activeScanContext = null;
    }
    return true;
  });

  // Safe File Read
  ipcMain.handle('file:read', async (_event, filePath: string, maxBytes?: number) => {
    return await readSafeFile(filePath, maxBytes);
  });

  // Safe File Save
  ipcMain.handle('file:save', async (_event, request: SaveRequest) => {
    return await saveSafeFile(request);
  });

  // Safe File Copy
  ipcMain.handle('file:copy', async (_event, request: CopyRequest) => {
    return await copySafeFile(request);
  });

  // Structured Compare
  ipcMain.handle('structured:compare', async (_event, request: StructuredDiffRequest) => {
    return compareStructuredData(request);
  });

  // Shell explorer
  ipcMain.handle('system:open-explorer', async (_event, targetPath: string) => {
    shell.showItemInFolder(path.resolve(targetPath));
    return true;
  });

  // Metadata
  ipcMain.handle('app:version', () => '1.0.0');
  ipcMain.handle('app:platform', () => process.platform);
}
