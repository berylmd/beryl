import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import started from 'electron-squirrel-startup';

if (started) app.quit();

let mainWindow;
const watchers = new Map();

const createWindow = () => {
  mainWindow = new BrowserWindow({
    title: 'Beryl',
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'build', 'index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── FileAdapter IPC handlers ──────────────────────────────────────────────────

ipcMain.handle('beryl:readFile', async (_event, filePath) => {
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('beryl:writeFile', async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('beryl:listFiles', async (_event, dir) => {
  return fs.readdir(dir);
});

ipcMain.handle('beryl:watchDir', async (_event, dir) => {
  if (watchers.has(dir)) watchers.get(dir).close();
  const w = watch(dir, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('beryl:dirChanged', dir);
    }
  });
  watchers.set(dir, w);
});

ipcMain.handle('beryl:unwatchDir', async (_event, dir) => {
  if (watchers.has(dir)) {
    watchers.get(dir).close();
    watchers.delete(dir);
  }
});

ipcMain.handle('beryl:pickDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});
