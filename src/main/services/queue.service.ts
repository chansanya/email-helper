import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { safeResolveAttachmentPath } from '../utils/paths'
import { storageService } from './storage.service'
import { securityService } from './security.service'
import { smtpService } from './smtp.service'
import { templateService } from './template.service'
import { logger } from '../utils/logger'
import type {
  PreflightResult,
  ProgressPayload,
  RecipientMapping,
  SendAttempt,
  SendItem,
  SendJob,
  SmtpConfig
} from '../../shared/types'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export class QueueService {
  private activeJob: SendJob | null = null
  private isPaused = false
  private isCancelled = false
  private activeWorkers = 0
  private consecutiveErrors = 0
  private progressListeners: Array<(payload: ProgressPayload) => void> = []

  public onProgress(listener: (payload: ProgressPayload) => void): () => void {
    this.progressListeners.push(listener)
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener)
    }
  }

  private emitProgress(job: SendJob, currentItem?: SendItem) {
    const payload: ProgressPayload = {
      jobId: job.id,
      status: job.status,
      totalCount: job.totalCount,
      acceptedCount: job.acceptedCount,
      failedCount: job.failedCount,
      pendingCount: job.pendingCount,
      unknownCount: job.unknownCount,
      cancelledCount: job.cancelledCount,
      currentItemId: currentItem?.id,
      currentEmail: currentItem?.recipientEmail
    }
    for (const listener of this.progressListeners) {
      try {
        listener(payload)
      } catch (err) {
        logger.error('进度通知异常', err)
      }
    }
  }

  public async getActiveJob(): Promise<SendJob | null> {
    if (this.activeJob) return this.activeJob
    const index = await storageService.getJobsIndex()
    if (index.length > 0) {
      const latest = await storageService.getJob(index[0].id)
      this.activeJob = latest
      return latest
    }
    return null
  }

  public deleteJob(jobId: string) {
    if (this.activeJob?.id === jobId) {
      this.activeJob = null
    }
  }

  public async preflightCheck(): Promise<PreflightResult> {
    const mappings = await storageService.getMappings()
    const storedSmtp = await storageService.getStoredSmtpConfig()
    const settings = await storageService.getSettings()

    const issues: PreflightResult['issues'] = []

    // 1. SMTP 配置检查
    let smtpOk = false
    let smtpMsg = 'SMTP 未配置'
    if (!storedSmtp.host || !storedSmtp.username || !storedSmtp.fromAddress) {
      issues.push({ type: 'ERROR', message: '发件主邮箱配置不完整（主机、发件人或账号为空）' })
    } else if (!storedSmtp.encryptedPassword) {
      issues.push({ type: 'ERROR', message: '发件邮箱未设置授权码或密码' })
    } else {
      smtpOk = true
      smtpMsg = 'SMTP 配置就绪'
    }

    // 2. 映射检查
    let validCount = 0
    let invalidEmailCount = 0
    let missingFileCount = 0
    let disabledCount = 0
    let totalAttachmentBytes = 0

    const seenEmails = new Set<string>()

    for (const m of mappings) {
      if (!m.enabled) {
        disabledCount++
        continue
      }

      if (!m.recipientEmail || !EMAIL_REGEX.test(m.recipientEmail)) {
        invalidEmailCount++
        issues.push({
          type: 'ERROR',
          recipientEmail: m.recipientEmail,
          message: `邮箱格式不正确: ${m.recipientEmail}`
        })
        continue
      }

      if (seenEmails.has(m.recipientEmail.toLowerCase())) {
        issues.push({
          type: 'WARNING',
          recipientEmail: m.recipientEmail,
          message: `收件邮箱重复出现: ${m.recipientEmail}`
        })
      }
      seenEmails.add(m.recipientEmail.toLowerCase())

      const fileCheck = safeResolveAttachmentPath(m.attachmentPath)
      if (!fileCheck.exists || !fileCheck.isFile) {
        missingFileCount++
        issues.push({
          type: 'ERROR',
          recipientEmail: m.recipientEmail,
          message: `附件不存在或无法读取: ${m.attachmentPath}`
        })
        continue
      }

      validCount++
      totalAttachmentBytes += fileCheck.size
    }

    if (validCount === 0) {
      issues.push({ type: 'ERROR', message: '没有可用或启用的收件人映射' })
    }

    const readyToStart = smtpOk && validCount > 0 && issues.filter((i) => i.type === 'ERROR').length === 0

    // 估算耗时
    const intervalSec = (settings.sendIntervalMs || 1000) / 1000
    const concurrency = Math.max(1, settings.concurrency || 3)
    const estimatedTimeSeconds = Math.ceil((validCount / concurrency) * (intervalSec + 2))

    function formatBytes(bytes: number): string {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return {
      readyToStart,
      totalCandidates: mappings.length,
      validCount,
      invalidEmailCount,
      missingFileCount,
      disabledCount,
      totalAttachmentBytes,
      formattedTotalAttachmentSize: formatBytes(totalAttachmentBytes),
      smtpStatus: { ok: smtpOk, message: smtpMsg },
      estimatedTimeSeconds,
      issues
    }
  }

  public async createJob(jobName?: string): Promise<SendJob> {
    if (this.activeJob && this.activeJob.status === 'RUNNING') {
      throw new Error('已有正在运行的发送任务，请等待完成或先暂停/取消')
    }

    const preflight = await this.preflightCheck()
    if (!preflight.readyToStart) {
      const firstErr = preflight.issues.find((i) => i.type === 'ERROR')?.message || '发送前预检未通过'
      throw new Error(firstErr)
    }

    const mappings = await storageService.getMappings()
    const template = await storageService.getTemplate()
    const settings = await storageService.getSettings()

    const validMappings = mappings.filter((m) => {
      if (!m.enabled) return false
      if (!m.recipientEmail || !EMAIL_REGEX.test(m.recipientEmail)) return false
      const check = safeResolveAttachmentPath(m.attachmentPath)
      return check.exists && check.isFile
    })

    const items: SendItem[] = validMappings.map((m) => {
      const check = safeResolveAttachmentPath(m.attachmentPath)
      const fileName = path.basename(check.fullPath)
      return {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        recipientEmail: m.recipientEmail,
        recipientName: m.recipientName || m.recipientEmail.split('@')[0],
        attachmentPath: m.attachmentPath,
        attachmentName: fileName,
        attachmentSize: check.size,
        status: 'PENDING',
        attemptCount: 0
      }
    })

    const now = new Date()
    const nowStr = now.toISOString()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const name = jobName || `批量发信_${y}${m}${d}${hh}${mm}`

    const newJob: SendJob = {
      id: 'job_' + Date.now(),
      name,
      status: 'DRAFT',
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      concurrency: settings.concurrency || 3,
      sendIntervalMs: settings.sendIntervalMs || 1000,
      totalCount: items.length,
      acceptedCount: 0,
      failedCount: 0,
      pendingCount: items.length,
      unknownCount: 0,
      cancelledCount: 0,
      items,
      createdAt: nowStr
    }

    await storageService.saveJob(newJob)
    this.activeJob = newJob
    return newJob
  }

  public async startJob(jobId?: string): Promise<SendJob> {
    const id = jobId || this.activeJob?.id
    if (!id) {
      throw new Error('未指定要启动的任务 ID')
    }

    let job = await storageService.getJob(id)
    if (!job) {
      throw new Error('未找到对应任务记录')
    }

    if (this.activeJob && this.activeJob.id !== job.id && this.activeJob.status === 'RUNNING') {
      throw new Error('已有其他任务在执行中')
    }

    this.activeJob = job
    this.isPaused = false
    this.isCancelled = false
    this.consecutiveErrors = 0
    job.status = 'RUNNING'
    if (!job.startedAt) {
      job.startedAt = new Date().toISOString()
    }
    await storageService.saveJob(job)
    this.emitProgress(job)

    // 启动异步工作调度循环（不阻塞当前 IPC 返回）
    this.runDispatcher(job).catch((err) => {
      logger.error('任务调度引擎异常', err)
    })

    return job
  }

  public async pauseJob(jobId: string): Promise<boolean> {
    if (!this.activeJob || this.activeJob.id !== jobId) {
      const job = await storageService.getJob(jobId)
      if (job && job.status === 'RUNNING') {
        job.status = 'PAUSED'
        await storageService.saveJob(job)
        return true
      }
      return false
    }

    this.isPaused = true
    this.activeJob.status = 'PAUSED'
    await storageService.saveJob(this.activeJob)
    this.emitProgress(this.activeJob)
    return true
  }

  public async resumeJob(jobId: string): Promise<boolean> {
    if (this.activeJob && this.activeJob.id === jobId && this.activeJob.status === 'PAUSED') {
      this.isPaused = false
      this.consecutiveErrors = 0
      this.activeJob.status = 'RUNNING'
      await storageService.saveJob(this.activeJob)
      this.emitProgress(this.activeJob)
      this.runDispatcher(this.activeJob).catch((e) => logger.error('恢复任务执行异常', e))
      return true
    }
    return false
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const job = (this.activeJob && this.activeJob.id === jobId) ? this.activeJob : await storageService.getJob(jobId)
    if (!job) return false

    this.isCancelled = true
    this.isPaused = true

    for (const item of job.items) {
      if (item.status === 'PENDING' || item.status === 'RETRY_WAIT') {
        item.status = 'CANCELLED'
      }
    }

    job.status = 'CANCELLED'
    job.finishedAt = new Date().toISOString()
    this.updateJobCounts(job)
    await storageService.saveJob(job)
    this.emitProgress(job)
    return true
  }

  public async retryFailedItems(jobId: string): Promise<SendJob> {
    const originalJob = await storageService.getJob(jobId)
    if (!originalJob) {
      throw new Error('未找到原任务记录')
    }

    const failedItems = originalJob.items.filter(
      (i) => i.status === 'FAILED' || i.status === 'UNKNOWN'
    )

    if (failedItems.length === 0) {
      throw new Error('该任务没有失败或待确认的子项')
    }

    const newItems: SendItem[] = failedItems.map((item) => ({
      ...item,
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      status: 'PENDING',
      attemptCount: 0,
      smtpMessageId: undefined,
      smtpResponse: undefined,
      acceptedAt: undefined,
      errorCategory: undefined,
      errorMessage: undefined,
      lastAttemptAt: undefined
    }))

    const settings = await storageService.getSettings()
    const nowStr = new Date().toISOString()
    const newJob: SendJob = {
      id: 'job_' + Date.now(),
      name: `${originalJob.name} - 重试失败项`,
      status: 'DRAFT',
      subject: originalJob.subject,
      htmlContent: originalJob.htmlContent,
      textContent: originalJob.textContent,
      concurrency: originalJob.concurrency || settings.concurrency || 3,
      sendIntervalMs: originalJob.sendIntervalMs || 1000,
      totalCount: newItems.length,
      acceptedCount: 0,
      failedCount: 0,
      pendingCount: newItems.length,
      unknownCount: 0,
      cancelledCount: 0,
      items: newItems,
      createdAt: nowStr
    }

    await storageService.saveJob(newJob)
    this.activeJob = newJob
    return newJob
  }

  private updateJobCounts(job: SendJob) {
    job.acceptedCount = job.items.filter((i) => i.status === 'SMTP_ACCEPTED').length
    job.failedCount = job.items.filter((i) => i.status === 'FAILED').length
    job.pendingCount = job.items.filter((i) => i.status === 'PENDING' || i.status === 'RETRY_WAIT').length
    job.unknownCount = job.items.filter((i) => i.status === 'UNKNOWN').length
    job.cancelledCount = job.items.filter((i) => i.status === 'CANCELLED').length
  }

  private async runDispatcher(job: SendJob) {
    logger.info(`开始执行发送任务: ${job.name} (ID: ${job.id}), 总数: ${job.totalCount}, 并发: ${job.concurrency}`)

    // 1. 初始化 SMTP 连接池
    const storedSmtp = await storageService.getStoredSmtpConfig()
    let password = ''
    if (storedSmtp.encryptedPassword) {
      password = securityService.decrypt(storedSmtp.encryptedPassword)
    }

    if (!password) {
      job.status = 'BLOCKED_CONFIG'
      await storageService.saveJob(job)
      this.emitProgress(job)
      logger.error('发信任务启动失败：缺少发件人授权码')
      return
    }

    const transporter = smtpService.createTransporter(storedSmtp as SmtpConfig, password, true)
    const settings = await storageService.getSettings()
    const maxRetryAttempts = settings.maxRetryAttempts || 3

    // 重试退避辅助映射表: itemId -> nextReadyTimeMs
    const retrySchedule = new Map<string, number>()

    try {
      while (!this.isPaused && !this.isCancelled && job.status === 'RUNNING') {
        // 熔断保护：连续 5 次连接级失败自动挂起，保护用户邮箱不被直接封停
        if (this.consecutiveErrors >= 5) {
          logger.warn(`连续 ${this.consecutiveErrors} 次遭遇网络或连接异常，触发熔断保护，自动暂停任务`)
          job.status = 'BLOCKED_CONFIG'
          await storageService.saveJob(job)
          this.emitProgress(job)
          break
        }

        // 判断并发是否达到上限
        if (this.activeWorkers >= job.concurrency) {
          await new Promise((r) => setTimeout(r, 200))
          continue
        }

        // 寻找下一个可调度的子项
        const now = Date.now()
        const candidate = job.items.find((item) => {
          if (item.status === 'PENDING') return true
          if (item.status === 'RETRY_WAIT') {
            const readyAt = retrySchedule.get(item.id) || 0
            return now >= readyAt
          }
          return false
        })

        if (!candidate) {
          // 没有就绪的，但如果还有工作在进行中，等待完成
          if (this.activeWorkers > 0) {
            await new Promise((r) => setTimeout(r, 300))
            continue
          }

          // 检查是否还有处于 RETRY_WAIT 的项
          const retryWaitItem = job.items.find((i) => i.status === 'RETRY_WAIT')
          if (retryWaitItem) {
            const nextTime = retrySchedule.get(retryWaitItem.id) || (now + 1000)
            const waitMs = Math.max(200, nextTime - now)
            await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)))
            continue
          }

          // 所有子项都处理完了！收工！
          break
        }

        // 抢占该子项执行权
        this.activeWorkers++
        candidate.status = 'IN_PROGRESS'
        candidate.attemptCount++
        candidate.lastAttemptAt = new Date().toISOString()
        this.updateJobCounts(job)
        await storageService.saveJob(job)
        this.emitProgress(job, candidate)

        // 启动单独的工作子协程
        this.processItem(job, candidate, transporter, storedSmtp as SmtpConfig, maxRetryAttempts, retrySchedule)
          .finally(async () => {
            this.activeWorkers--
            this.updateJobCounts(job)
            await storageService.saveJob(job)
            this.emitProgress(job)
          })
          .catch((e) => {
            logger.error(`子项 ${candidate.id} 发送异常`, e)
          })

        // 全局发送间隔（避免瞬间所有并发 worker 同时砸向 SMTP）
        const interval = Math.max(100, job.sendIntervalMs || 1000)
        await new Promise((r) => setTimeout(r, interval))
      }

      // 等待剩余活跃的 workers 跑完
      while (this.activeWorkers > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }

      // 如果未被暂停或取消，收尾任务最终状态
      if (job.status === 'RUNNING') {
        job.finishedAt = new Date().toISOString()
        this.updateJobCounts(job)
        if (job.failedCount === 0 && job.unknownCount === 0) {
          job.status = 'COMPLETED'
        } else {
          job.status = 'PARTIAL_SUCCESS'
        }
        await storageService.saveJob(job)
        this.emitProgress(job)
        logger.info(`任务 ${job.name} 处理完毕，最终状态: ${job.status}`)
      }
    } finally {
      transporter.close()
    }
  }

  private async processItem(
    job: SendJob,
    item: SendItem,
    transporter: any,
    smtpConfig: SmtpConfig,
    maxRetryAttempts: number,
    retrySchedule: Map<string, number>
  ) {
    const startTime = new Date().toISOString()

    // 1. 校验附件文件
    const fileCheck = safeResolveAttachmentPath(item.attachmentPath)
    if (!fileCheck.exists || !fileCheck.isFile) {
      item.status = 'FAILED'
      item.errorCategory = 'FILE_ERROR'
      item.errorMessage = `附件文件不存在或无法读取: ${item.attachmentPath}`

      const attempt: SendAttempt = {
        itemId: item.id,
        jobId: job.id,
        attemptNumber: item.attemptCount,
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        status: 'FAILED',
        errorCategory: 'FILE_ERROR',
        errorMessage: item.errorMessage
      }
      await storageService.appendAttempt(attempt)
      return
    }

    // 2. 渲染邮件正文和变量
    const mailContent = templateService.prepareMailContent(
      {
        id: '',
        name: '',
        subject: job.subject,
        htmlContent: job.htmlContent,
        textContent: job.textContent,
        updatedAt: ''
      },
      {
        recipientEmail: item.recipientEmail,
        recipientName: item.recipientName
      },
      item.attachmentName
    )

    // 3. 发送邮件
    try {
      const fromField = smtpConfig.fromName
        ? `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`
        : smtpConfig.fromAddress

      const sendOptions: any = {
        from: fromField,
        to: item.recipientEmail,
        subject: mailContent.subject,
        text: mailContent.text,
        html: mailContent.html,
        attachments: [
          {
            filename: item.attachmentName,
            path: fileCheck.fullPath
          }
        ]
      }

      if (smtpConfig.replyTo) {
        sendOptions.replyTo = smtpConfig.replyTo
      }

      const info = await transporter.sendMail(sendOptions)

      // 发送成功（SMTP 已接收）
      item.status = 'SMTP_ACCEPTED'
      item.smtpMessageId = info.messageId || 'MSG_' + Date.now()
      item.smtpResponse = String(info.response || '250 OK')
      item.acceptedAt = new Date().toISOString()
      item.errorCategory = undefined
      item.errorMessage = undefined
      this.consecutiveErrors = 0

      const attempt: SendAttempt = {
        itemId: item.id,
        jobId: job.id,
        attemptNumber: item.attemptCount,
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        status: 'SMTP_ACCEPTED',
        smtpResponse: item.smtpResponse
      }
      await storageService.appendAttempt(attempt)
    } catch (err: any) {
      const classified = smtpService.classifyError(err)
      item.errorCategory = classified.category
      item.errorMessage = classified.message

      // 如果是认证错误，直接阻断整个任务，别再让后续一堆人都去撞车
      if (classified.category === 'AUTH_ERROR') {
        this.isPaused = true
        job.status = 'BLOCKED_CONFIG'
        item.status = 'FAILED'
        logger.error(`任务遭遇严重鉴权错误: ${classified.message}`)
      } else if (classified.retryable && item.attemptCount <= maxRetryAttempts) {
        // 重试退避 (10s, 30s, 90s 带抖动)
        item.status = 'RETRY_WAIT'
        const baseDelays = [10, 30, 90]
        const delaySec = baseDelays[item.attemptCount - 1] || 90
        const jitter = Math.floor(Math.random() * 3000)
        const nextReadyTime = Date.now() + delaySec * 1000 + jitter
        retrySchedule.set(item.id, nextReadyTime)
        logger.warn(`收件人 ${item.recipientEmail} 尝试 ${item.attemptCount} 遭遇临时错误，安排 ${delaySec}s 后重试`)
      } else {
        item.status = 'FAILED'
        logger.error(`收件人 ${item.recipientEmail} 发送最终失败: ${classified.message}`)
      }

      if (classified.category === 'CONNECTION_ERROR' || classified.category === 'AUTH_ERROR') {
        this.consecutiveErrors++
      }

      const attempt: SendAttempt = {
        itemId: item.id,
        jobId: job.id,
        attemptNumber: item.attemptCount,
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        status: 'FAILED',
        errorCategory: classified.category,
        errorMessage: `${classified.message} [${classified.rawError}]`
      }
      await storageService.appendAttempt(attempt)
    }
  }
}

export const queueService = new QueueService()
