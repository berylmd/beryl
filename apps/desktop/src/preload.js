const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('berylDesktop', {
  readFile: (path) => ipcRenderer.invoke('beryl:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('beryl:writeFile', path, content),
  listFiles: (dir) => ipcRenderer.invoke('beryl:listFiles', dir),
  watchDir: (dir) => ipcRenderer.invoke('beryl:watchDir', dir),
  unwatchDir: (dir) => ipcRenderer.invoke('beryl:unwatchDir', dir),
  pickDirectory: () => ipcRenderer.invoke('beryl:pickDirectory'),
  onDirChanged: (callback) => {
    ipcRenderer.on('beryl:dirChanged', (_event, dir) => callback(dir));
  },
});
