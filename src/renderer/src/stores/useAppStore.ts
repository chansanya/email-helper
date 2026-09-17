import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  AppSettings,
  FileScanItem,
  MailTemplate,
  ProgressPayload,
  RecipientMapping,
  SendJob,
  SmtpConfig
} from '@shared/types'
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_MAIL_TEMPLATE,
  DEFAULT_SMTP_CONFIG
} from '@shared/constants'

export const useAppStore = defineStore('app', () => {
  const currentView = ref<'workspace' | 'history'>('workspace')

  const smtpConfig = ref<SmtpConfig>({ ...DEFAULT_SMTP_CONFIG })
  const settings = ref<AppSettings>({ ...DEFAULT_APP_SETTINGS })
  const mappings = ref<RecipientMapping[]>([])
  const template = ref<MailTemplate>({ ...DEFAULT_MAIL_TEMPLATE })
  const attachmentFiles = ref<FileScanItem[]>([])
  const attachmentFolder = ref<string>('')
  const activeJob = ref<SendJob | null>(null)
  const isSmtpVerified = ref(false)

  // 刷新所有核心数据
  async function reloadAll() {
    await Promise.all([
      fetchSmtpConfig(),
      fetchSettings(),
      fetchMappings(),
      fetchTemplate(),
      fetchAttachmentFiles(),
      fetchAttachmentFolder(),
      fetchActiveJob()
    ])
  }

  async function fetchSmtpConfig() {
    const res = await window.electronAPI.getSmtpConfig()
    if (res.success && res.data) {
      smtpConfig.value = res.data
      isSmtpVerified.value = res.data.hasPassword || false
    }
  }

  async function fetchSettings() {
    const res = await window.electronAPI.getSettings()
    if (res.success && res.data) {
      settings.value = res.data
    }
  }

  async function fetchMappings() {
    const res = await window.electronAPI.validateAllMappings()
    if (res.success && res.data) {
      mappings.value = res.data
    }
  }

  async function fetchTemplate() {
    const res = await window.electronAPI.getTemplate()
    if (res.success && res.data) {
      template.value = res.data
    }
  }

  async function fetchAttachmentFiles() {
    const res = await window.electronAPI.scanAttachmentFiles()
    if (res.success && res.data) {
      attachmentFiles.value = res.data
    }
  }

  async function fetchAttachmentFolder() {
    const res = await window.electronAPI.getAttachmentFolderPath()
    if (res.success && res.data) {
      attachmentFolder.value = res.data
    }
  }

  async function fetchActiveJob() {
    const res = await window.electronAPI.getActiveJob()
    if (res.success) {
      activeJob.value = res.data || null
    }
  }

  function handleProgressUpdate(payload: ProgressPayload) {
    if (activeJob.value && activeJob.value.id === payload.jobId) {
      activeJob.value.status = payload.status
      activeJob.value.totalCount = payload.totalCount
      activeJob.value.acceptedCount = payload.acceptedCount
      activeJob.value.failedCount = payload.failedCount
      activeJob.value.pendingCount = payload.pendingCount
      activeJob.value.unknownCount = payload.unknownCount
      activeJob.value.cancelledCount = payload.cancelledCount
    }
  }

  return {
    currentView,
    smtpConfig,
    settings,
    mappings,
    template,
    attachmentFiles,
    attachmentFolder,
    activeJob,
    isSmtpVerified,
    reloadAll,
    fetchSmtpConfig,
    fetchSettings,
    fetchMappings,
    fetchTemplate,
    fetchAttachmentFiles,
    fetchAttachmentFolder,
    fetchActiveJob,
    handleProgressUpdate
  }
})
