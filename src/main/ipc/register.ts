import { ipcMain, dialog, BrowserWindow } from 'electron'
import { storageService } from '../services/storage.service'
import { securityService } from '../services/security.service'
import { smtpService } from '../services/smtp.service'
import { fileService } from '../services/file.service'
import { templateService } from '../services/template.service'
import { queueService } from '../services/queue.service'
import { safeResolveAttachmentPath } from '../utils/paths'
import { logger } from '../utils/logger'
import type { ApiResponse, RecipientMapping, SmtpConfig } from '../../shared/types'

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

function failure<T = unknown>(error: any): ApiResponse<T> {
  const msg = typeof error === 'string' ? error : error?.message || '未知服务异常'
  return { success: false, error: msg }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // 监听发信进度并向渲染进程推送
  queueService.onProgress((payload) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('send:progress', payload)
    }
  })

  // --- SMTP ---
  ipcMain.handle('smtp:getConfig', async () => {
    try {
      const stored = await storageService.getStoredSmtpConfig()
      const publicConfig: SmtpConfig = {
        name: stored.name,
        host: stored.host,
        port: stored.port,
        security: stored.security,
        username: stored.username,
        fromName: stored.fromName,
        fromAddress: stored.fromAddress,
        replyTo: stored.replyTo,
        timeoutSeconds: stored.timeoutSeconds,
        hasPassword: !!stored.encryptedPassword
      }
      return success(publicConfig)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('smtp:saveConfig', async (_, config: SmtpConfig) => {
    try {
      const current = await storageService.getStoredSmtpConfig()
      let encrypted = current.encryptedPassword
      if (config.password) {
        encrypted = securityService.encrypt(config.password)
      }
      await storageService.saveStoredSmtpConfig({
        ...config,
        encryptedPassword: encrypted
      })
      logger.info('更新 SMTP 发件配置成功')
      return success(true)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('smtp:testConnection', async (_, config?: SmtpConfig) => {
    try {
      let cfg = config
      let pwd = config?.password
      if (!cfg) {
        const stored = await storageService.getStoredSmtpConfig()
        cfg = stored as SmtpConfig
      }
      const res = await smtpService.testConnection(cfg, pwd)
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = await storageService.getSettings()
      return success(settings)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('settings:save', async (_, partial) => {
    try {
      await storageService.saveSettings(partial)
      return success(true)
    } catch (e: any) {
      return failure(e)
    }
  })

  // --- Mappings ---
  ipcMain.handle('mapping:list', async () => {
    try {
      const mappings = await storageService.getMappings()
      return success(mappings)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:create', async (_, data: Omit<RecipientMapping, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const mappings = await storageService.getMappings()
      const newMapping: RecipientMapping = {
        ...data,
        id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      mappings.unshift(newMapping)
      await storageService.saveMappings(mappings)
      return success(newMapping)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:update', async (_, id: string, data: Partial<RecipientMapping>) => {
    try {
      const mappings = await storageService.getMappings()
      const idx = mappings.findIndex((m) => m.id === id)
      if (idx === -1) throw new Error('未找到指定映射记录')
      mappings[idx] = {
        ...mappings[idx],
        ...data,
        updatedAt: new Date().toISOString()
      }
      await storageService.saveMappings(mappings)
      return success(mappings[idx])
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:delete', async (_, ids: string[]) => {
    try {
      const mappings = await storageService.getMappings()
      const filtered = mappings.filter((m) => !ids.includes(m.id))
      await storageService.saveMappings(filtered)
      return success(true)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:import', async (_, options) => {
    try {
      const result = await fileService.importMappings(options)
      return success(result)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:export', async () => {
    try {
      const res = await fileService.exportMappings()
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:autoExtract', async () => {
    try {
      const res = await fileService.autoExtractFromAttachments()
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:exportMissingTemplate', async () => {
    try {
      const res = await fileService.exportMissingTemplate()
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('mapping:validateAll', async () => {
    try {
      const mappings = await storageService.getMappings()
      for (const m of mappings) {
        const fileCheck = await import('../utils/paths').then((mod) =>
          mod.safeResolveAttachmentPath(m.attachmentPath)
        )
        m.fileStatus = fileCheck.exists && fileCheck.isFile ? 'OK' : 'MISSING'
        m.fileSize = fileCheck.size
        m.emailStatus = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.recipientEmail) ? 'VALID' : 'INVALID'
      }
      await storageService.saveMappings(mappings)
      return success(mappings)
    } catch (e: any) {
      return failure(e)
    }
  })

  // --- Files ---
  ipcMain.handle('file:scanAttachments', async () => {
    try {
      const files = await fileService.scanAttachmentFiles()
      return success(files)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('file:openAttachmentFolder', async () => {
    try {
      const ok = await fileService.openAttachmentFolder()
      return success(ok)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('file:getAttachmentFolderPath', async () => {
    try {
      const p = fileService.getAttachmentFolderPath()
      return success(p)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('file:exportTemplateFile', async () => {
    try {
      const filePath = await fileService.exportTemplateFile()
      return success(filePath)
    } catch (e: any) {
      return failure(e)
    }
  })

  // --- Template ---
  ipcMain.handle('template:get', async () => {
    try {
      const t = await storageService.getTemplate()
      return success(t)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('template:save', async (_, templateData) => {
    try {
      const current = await storageService.getTemplate()
      const updated = {
        ...current,
        ...templateData,
        updatedAt: new Date().toISOString()
      }
      await storageService.saveTemplate(updated)
      return success(true)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('template:preview', async (_, { template, recipient }) => {
    try {
      const res = templateService.prepareMailContent(template, recipient, recipient?.attachmentPath || '示例附件.pdf')
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('template:sendTestMail', async (_, targetEmail: string) => {
    try {
      if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return failure('请输入有效的测试接收邮箱')
      }

      const storedSmtp = await storageService.getStoredSmtpConfig()
      let password = ''
      if (storedSmtp.encryptedPassword) {
        password = securityService.decrypt(storedSmtp.encryptedPassword)
      }
      if (!password) {
        return failure('发件邮箱尚未配置授权码或密码')
      }

      const template = await storageService.getTemplate()

      // 寻找真实存在的附件，确保测试邮件也包含可直接打开的真实附件
      const scanFiles = await fileService.scanAttachmentFiles()
      let testAttachFilename = '测试附件.txt'
      let testAttachPath = ''
      if (scanFiles.length > 0) {
        testAttachFilename = scanFiles[0].name
        testAttachPath = scanFiles[0].relativePath
      }

      const content = templateService.prepareMailContent(
        template,
        { recipientEmail: targetEmail, recipientName: '测试收件人' },
        testAttachFilename
      )

      const transporter = smtpService.createTransporter(storedSmtp as SmtpConfig, password, false)
      try {
        const fromField = storedSmtp.fromName
          ? `"${storedSmtp.fromName}" <${storedSmtp.fromAddress}>`
          : storedSmtp.fromAddress

        const mailAttachments: any[] = []
        if (testAttachPath) {
          const fileCheck = safeResolveAttachmentPath(testAttachPath)
          if (fileCheck.exists && fileCheck.isFile) {
            mailAttachments.push({
              filename: testAttachFilename,
              path: fileCheck.fullPath
            })
          }
        }

        if (mailAttachments.length === 0) {
          mailAttachments.push({
            filename: '测试附件说明.txt',
            content: '这是一份由邮箱助手随信发送的真实测试附件。\n\n当您能够在邮件客户端中下载并打开此文件时，表明附件投递与接收功能完全正常！',
            contentType: 'text/plain; charset=utf-8'
          })
        }

        await transporter.sendMail({
          from: fromField,
          to: targetEmail,
          subject: `[测试发送] ${content.subject}`,
          html: content.html,
          text: content.text,
          attachments: mailAttachments
        })
        return success({ ok: true, message: `测试邮件已成功投递给 ${targetEmail}（已附带真实可打开附件）` })
      } finally {
        transporter.close()
      }
    } catch (e: any) {
      const classified = smtpService.classifyError(e)
      return failure(`${classified.message} [${classified.rawError}]`)
    }
  })

  // --- Send Jobs ---
  ipcMain.handle('send:preflight', async () => {
    try {
      const res = await queueService.preflightCheck()
      return success(res)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:start', async (_, params) => {
    try {
      const job = await queueService.createJob(params?.jobName)
      await queueService.startJob(job.id)
      return success(job)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:pause', async (_, jobId: string) => {
    try {
      const ok = await queueService.pauseJob(jobId)
      return success(ok)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:resume', async (_, jobId: string) => {
    try {
      const ok = await queueService.resumeJob(jobId)
      return success(ok)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:cancel', async (_, jobId: string) => {
    try {
      const ok = await queueService.cancelJob(jobId)
      return success(ok)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:retryFailed', async (_, jobId: string) => {
    try {
      const newJob = await queueService.retryFailedItems(jobId)
      await queueService.startJob(newJob.id)
      return success(newJob)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:getActiveJob', async () => {
    try {
      const job = await queueService.getActiveJob()
      return success(job)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('send:getJobDetail', async (_, jobId: string) => {
    try {
      const job = await storageService.getJob(jobId)
      if (!job) throw new Error('未找到指定任务')
      const attempts = await storageService.getAttempts(jobId)
      return success({ job, attempts })
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('history:list', async () => {
    try {
      const list = await storageService.getJobsIndex()
      return success(list)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('history:delete', async (_, jobId: string) => {
    try {
      await storageService.deleteJob(jobId)
      queueService.deleteJob(jobId)
      return success(true)
    } catch (e: any) {
      return failure(e)
    }
  })

  ipcMain.handle('history:export', async (_, jobId: string) => {
    try {
      const job = await storageService.getJob(jobId)
      if (!job) throw new Error('任务数据不存在')
      const p = await fileService.exportJobReport(job)
      return success(p)
    } catch (e: any) {
      return failure(e)
    }
  })

  // --- Dialogs ---
  ipcMain.handle('dialog:openFile', async (_, options) => {
    try {
      const res = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: options?.filters || []
      })
      if (res.canceled || res.filePaths.length === 0) {
        return success(null)
      }
      return success(res.filePaths[0])
    } catch (e: any) {
      return failure(e)
    }
  })
}
