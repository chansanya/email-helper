import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, ProgressPayload } from '../shared/types'

const api: ElectronAPI = {
  // SMTP
  getSmtpConfig: () => ipcRenderer.invoke('smtp:getConfig'),
  saveSmtpConfig: (config) => ipcRenderer.invoke('smtp:saveConfig', config),
  testSmtpConnection: (config) => ipcRenderer.invoke('smtp:testConnection', config),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Mappings
  listMappings: () => ipcRenderer.invoke('mapping:list'),
  createMapping: (mapping) => ipcRenderer.invoke('mapping:create', mapping),
  updateMapping: (id, mapping) => ipcRenderer.invoke('mapping:update', id, mapping),
  deleteMappings: (ids) => ipcRenderer.invoke('mapping:delete', ids),
  importMappings: (options) => ipcRenderer.invoke('mapping:import', options),
  exportMappings: () => ipcRenderer.invoke('mapping:export'),
  autoExtractAttachments: () => ipcRenderer.invoke('mapping:autoExtract'),
  exportMissingTemplate: () => ipcRenderer.invoke('mapping:exportMissingTemplate'),
  validateAllMappings: () => ipcRenderer.invoke('mapping:validateAll'),

  // Files
  scanAttachmentFiles: () => ipcRenderer.invoke('file:scanAttachments'),
  openAttachmentFolder: () => ipcRenderer.invoke('file:openAttachmentFolder'),
  getAttachmentFolderPath: () => ipcRenderer.invoke('file:getAttachmentFolderPath'),
  exportTemplateFile: () => ipcRenderer.invoke('file:exportTemplateFile'),

  // Templates
  getTemplate: () => ipcRenderer.invoke('template:get'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  previewMail: (data) => ipcRenderer.invoke('template:preview', data),
  sendTestMail: (targetEmail) => ipcRenderer.invoke('template:sendTestMail', targetEmail),

  // Send Jobs
  preflightCheck: () => ipcRenderer.invoke('send:preflight'),
  startSendJob: (params) => ipcRenderer.invoke('send:start', params),
  pauseSendJob: (jobId) => ipcRenderer.invoke('send:pause', jobId),
  resumeSendJob: (jobId) => ipcRenderer.invoke('send:resume', jobId),
  cancelSendJob: (jobId) => ipcRenderer.invoke('send:cancel', jobId),
  retryFailedItems: (jobId) => ipcRenderer.invoke('send:retryFailed', jobId),
  getActiveJob: () => ipcRenderer.invoke('send:getActiveJob'),
  getJobDetail: (jobId) => ipcRenderer.invoke('send:getJobDetail', jobId),
  listHistoryJobs: () => ipcRenderer.invoke('history:list'),
  deleteHistoryJob: (jobId) => ipcRenderer.invoke('history:delete', jobId),
  exportJobReport: (jobId) => ipcRenderer.invoke('history:export', jobId),

  // Dialogs
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Events
  onJobProgress: (callback: (payload: ProgressPayload) => void) => {
    const handler = (_: any, payload: ProgressPayload) => callback(payload)
    ipcRenderer.on('send:progress', handler)
    return () => {
      ipcRenderer.removeListener('send:progress', handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
