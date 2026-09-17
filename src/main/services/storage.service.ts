import path from 'node:path'
import fs from 'node:fs'
import writeFileAtomic from 'write-file-atomic'
import { getDataDir } from '../utils/paths'
import { logger } from '../utils/logger'
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_MAIL_TEMPLATE,
  DEFAULT_SMTP_CONFIG
} from '../../shared/constants'
import type {
  AppSettings,
  MailTemplate,
  RecipientMapping,
  SendAttempt,
  SendJob,
  SendJobSummary,
  SmtpConfig
} from '../../shared/types'

interface StoredSmtpConfig extends Omit<SmtpConfig, 'password'> {
  encryptedPassword?: string
}

class StorageService {
  private writeQueue: Promise<void> = Promise.resolve()

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(task)
    this.writeQueue = result.then(
      () => {},
      () => {}
    )
    return result
  }

  private async writeJsonAtomic(filePath: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2)
    await writeFileAtomic(filePath, content, { encoding: 'utf8' })
  }

  // --- Settings & SMTP ---
  private getSettingsPath(): string {
    return path.join(getDataDir(), 'settings.json')
  }

  public async getSettings(): Promise<AppSettings> {
    try {
      const p = this.getSettingsPath()
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_APP_SETTINGS, ...(parsed.settings || {}) }
      }
    } catch (e) {
      logger.error('读取 settings.json 失败', e)
    }
    return { ...DEFAULT_APP_SETTINGS }
  }

  public async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getSettingsPath()
      let current: any = {}
      if (fs.existsSync(p)) {
        try {
          current = JSON.parse(fs.readFileSync(p, 'utf8'))
        } catch {}
      }
      current.settings = { ...DEFAULT_APP_SETTINGS, ...(current.settings || {}), ...settings }
      await this.writeJsonAtomic(p, current)
    })
  }

  public async getStoredSmtpConfig(): Promise<StoredSmtpConfig> {
    try {
      const p = this.getSettingsPath()
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_SMTP_CONFIG, ...(parsed.smtp || {}) }
      }
    } catch (e) {
      logger.error('读取 SMTP 配置失败', e)
    }
    return { ...DEFAULT_SMTP_CONFIG }
  }

  public async saveStoredSmtpConfig(config: StoredSmtpConfig): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getSettingsPath()
      let current: any = {}
      if (fs.existsSync(p)) {
        try {
          current = JSON.parse(fs.readFileSync(p, 'utf8'))
        } catch {}
      }
      current.smtp = { ...DEFAULT_SMTP_CONFIG, ...config }
      await this.writeJsonAtomic(p, current)
    })
  }

  // --- Mappings ---
  private getMappingsPath(): string {
    return path.join(getDataDir(), 'mappings.json')
  }

  public async getMappings(): Promise<RecipientMapping[]> {
    try {
      const p = this.getMappingsPath()
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw)
      }
    } catch (e) {
      logger.error('读取 mappings.json 失败', e)
    }
    return []
  }

  public async saveMappings(mappings: RecipientMapping[]): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getMappingsPath()
      await this.writeJsonAtomic(p, mappings)
    })
  }

  // --- Mail Template ---
  private getTemplatePath(): string {
    return path.join(getDataDir(), 'templates.json')
  }

  public async getTemplate(): Promise<MailTemplate> {
    try {
      const p = this.getTemplatePath()
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw)
      }
    } catch (e) {
      logger.error('读取 templates.json 失败', e)
    }
    return { ...DEFAULT_MAIL_TEMPLATE }
  }

  public async saveTemplate(template: MailTemplate): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getTemplatePath()
      await this.writeJsonAtomic(p, template)
    })
  }

  // --- Jobs & Attempts ---
  private getJobsIndexPath(): string {
    return path.join(getDataDir(), 'jobs', 'index.json')
  }

  public async getJobsIndex(): Promise<SendJobSummary[]> {
    try {
      const p = this.getJobsIndexPath()
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw)
      }
    } catch (e) {
      logger.error('读取 jobs/index.json 失败', e)
    }
    return []
  }

  public async saveJobsIndex(summaries: SendJobSummary[]): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getJobsIndexPath()
      await this.writeJsonAtomic(p, summaries)
    })
  }

  public getJobPath(jobId: string): string {
    return path.join(getDataDir(), 'jobs', `job-${jobId}.json`)
  }

  public async getJob(jobId: string): Promise<SendJob | null> {
    try {
      const p = this.getJobPath(jobId)
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw)
      }
    } catch (e) {
      logger.error(`读取 job-${jobId}.json 失败`, e)
    }
    return null
  }

  public async saveJob(job: SendJob): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getJobPath(job.id)
      await this.writeJsonAtomic(p, job)

      // 同步更新 index 摘要
      const indexList = await this.getJobsIndex()
      const existingIdx = indexList.findIndex((item) => item.id === job.id)
      const summary: SendJobSummary = {
        id: job.id,
        name: job.name,
        status: job.status,
        totalCount: job.totalCount,
        acceptedCount: job.acceptedCount,
        failedCount: job.failedCount,
        pendingCount: job.pendingCount,
        unknownCount: job.unknownCount,
        cancelledCount: job.cancelledCount,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt
      }
      if (existingIdx >= 0) {
        indexList[existingIdx] = summary
      } else {
        indexList.unshift(summary)
      }
      await this.writeJsonAtomic(this.getJobsIndexPath(), indexList)
    })
  }

  public getAttemptsPath(jobId: string): string {
    return path.join(getDataDir(), 'attempts', `job-${jobId}.ndjson`)
  }

  public async appendAttempt(attempt: SendAttempt): Promise<void> {
    return this.enqueueWrite(async () => {
      const p = this.getAttemptsPath(attempt.jobId)
      const line = JSON.stringify(attempt) + '\n'
      fs.appendFileSync(p, line, 'utf8')
    })
  }

  public async getAttempts(jobId: string): Promise<SendAttempt[]> {
    try {
      const p = this.getAttemptsPath(jobId)
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8')
        const lines = content.split('\n').filter((l) => l.trim().length > 0)
        return lines.map((line) => JSON.parse(line))
      }
    } catch (e) {
      logger.error(`读取 attempts for job-${jobId} 失败`, e)
    }
    return []
  }

  public async deleteJob(jobId: string): Promise<void> {
    return this.enqueueWrite(async () => {
      // 1. 从 index.json 移除
      const indexList = await this.getJobsIndex()
      const filtered = indexList.filter((item) => item.id !== jobId)
      await this.writeJsonAtomic(this.getJobsIndexPath(), filtered)

      // 2. 删除 job 文件
      const jobFile = this.getJobPath(jobId)
      if (fs.existsSync(jobFile)) {
        try { fs.unlinkSync(jobFile) } catch {}
      }

      // 3. 删除 attempts 文件
      const attemptsFile = this.getAttemptsPath(jobId)
      if (fs.existsSync(attemptsFile)) {
        try { fs.unlinkSync(attemptsFile) } catch {}
      }
    })
  }

  // --- 崩溃/断电自恢复 ---
  public async recoverDanglingJobs(): Promise<void> {
    try {
      const summaries = await this.getJobsIndex()
      let changed = false
      for (const summary of summaries) {
        if (summary.status === 'RUNNING' || summary.status === 'PAUSED') {
          const job = await this.getJob(summary.id)
          if (job) {
            let itemChanged = false
            for (const item of job.items) {
              if (item.status === 'IN_PROGRESS') {
                item.status = 'UNKNOWN'
                item.errorMessage = '程序意外中断，状态待确认（防止自动重发导致重复发送）'
                itemChanged = true
              }
            }
            if (itemChanged || job.status === 'RUNNING') {
              job.status = 'INTERRUPTED'
              job.unknownCount = job.items.filter((i) => i.status === 'UNKNOWN').length
              job.pendingCount = job.items.filter((i) => i.status === 'PENDING' || i.status === 'RETRY_WAIT').length
              await this.saveJob(job)
              changed = true
              logger.warn(`自恢复：任务 ${job.id} 之前未正常关闭，已置为 INTERRUPTED，并标记未确认项`)
            }
          }
        }
      }
      if (changed) {
        logger.info('崩溃恢复校验完成')
      }
    } catch (err) {
      logger.error('恢复挂起任务异常', err)
    }
  }
}

export const storageService = new StorageService()
