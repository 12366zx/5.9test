const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  notifyCompleted: (mode) => ipcRenderer.send('timer-completed', mode),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});
