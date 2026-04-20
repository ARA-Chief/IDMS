'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('idms', {

  // ── Persistent store ───────────────────────────────────────────
  store: {
    get:    (key)        => ipcRenderer.invoke('store:get', key),
    set:    (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key)        => ipcRenderer.invoke('store:delete', key)
  },

  // ── Database ───────────────────────────────────────────────────
  db: {
    ingestLogFile:    (payload) => ipcRenderer.invoke('db:ingestLogFile', payload),
    getRecentEvents:  (opts)    => ipcRenderer.invoke('db:getRecentEvents', opts),
    getIngestionStatus:(opts)   => ipcRenderer.invoke('db:getIngestionStatus', opts),
    getDaySummary:    (opts)    => ipcRenderer.invoke('db:getDaySummary', opts)
  },

  // ── Shell ──────────────────────────────────────────────────────
  shell: {
    openExternal: (url) => ipcRenderer.send('shell:openExternal', url)
  }

});
