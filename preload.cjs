const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('app:quit'),
  fullscreen: () => ipcRenderer.send('app:fullscreen')
});
