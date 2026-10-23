/**
 * DiffX — Electron Main Process Entry Point
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'DiffX',
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#090d16',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  registerIpcHandlers(win);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // In production or built renderer, load from dist
    const indexPath = path.join(__dirname, '../../dist/index.html');
    win.loadFile(indexPath).catch(() => {
      // Fallback for dev mode when dev server URL not passed as env
      win.loadURL('http://localhost:5173');
    });
  }

  return win;
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Comparison',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-comparison'),
        },
        {
          label: 'Refresh Comparison',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.send('menu:refresh'),
        },
        {
          label: 'Swap Sides',
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => mainWindow?.webContents.send('menu:swap-sides'),
        },
        { type: 'separator' as const },
        process.platform === 'darwin' ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'Diff Navigation',
      submenu: [
        {
          label: 'Next Difference',
          accelerator: 'F7',
          click: () => mainWindow?.webContents.send('menu:next-diff'),
        },
        {
          label: 'Previous Difference',
          accelerator: 'Shift+F7',
          click: () => mainWindow?.webContents.send('menu:prev-diff'),
        },
        { type: 'separator' as const },
        {
          label: 'Copy Left to Right',
          accelerator: 'CmdOrCtrl+Alt+Right',
          click: () => mainWindow?.webContents.send('menu:copy-l2r'),
        },
        {
          label: 'Copy Right to Left',
          accelerator: 'CmdOrCtrl+Alt+Left',
          click: () => mainWindow?.webContents.send('menu:copy-r2l'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => mainWindow?.webContents.send('menu:shortcuts'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  buildMenu();
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
