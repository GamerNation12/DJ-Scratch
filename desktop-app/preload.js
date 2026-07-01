const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
});
