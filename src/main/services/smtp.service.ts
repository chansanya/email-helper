import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { securityService } from './security.service'
import { storageService } from './storage.service'
import { logger } from '../utils/logger'
import type { SmtpConfig } from '../../shared/types'

export interface ClassifiedSmtpError {
  category: 'AUTH_ERROR' | 'CONNECTION_ERROR' | 'RATE_LIMIT' | 'RECIPIENT_REJECTED' | 'CONTENT_REJECTED' | 'UNKNOWN'
  retryable: boolean
  message: string
  rawError: string
}

export class SmtpService {
  public classifyError(err: any): ClassifiedSmtpError {
    const rawMsg = String(err?.message || err || '')
    const responseCode = err?.responseCode || 0

    // 1. 认证鉴权失败 (535 等)
    if (
      responseCode === 535 ||
      /535|auth|authentication|credentials|login|password/i.test(rawMsg)
    ) {
      return {
        category: 'AUTH_ERROR',
        retryable: false,
        message: 'SMTP 认证失败，请检查发件邮箱账号和客户端授权码',
        rawError: rawMsg
      }
    }

    // 2. 频率/临时限制 (421, 450, 451, 452 等)
    if (
      (responseCode >= 400 && responseCode < 500) ||
      /too many|rate limit|quota|busy|try again|frequency/i.test(rawMsg)
    ) {
      return {
        category: 'RATE_LIMIT',
        retryable: true,
        message: `服务商临时限流或繁忙 (${responseCode || '4xx'})，系统将退避重试`,
        rawError: rawMsg
      }
    }

    // 3. 网络与连接故障 (超时、断开、DNS 解析失败)
    if (
      /timeout|econnrefused|etimedout|enotfound|econnreset|socket|handshake/i.test(rawMsg)
    ) {
      return {
        category: 'CONNECTION_ERROR',
        retryable: true,
        message: '连接 SMTP 服务器超时或网络中断，系统将退避重试',
        rawError: rawMsg
      }
    }

    // 4. 收件地址被拒 (550, 551, 553 等)
    if (
      responseCode === 550 ||
      responseCode === 551 ||
      responseCode === 553 ||
      /user not found|mailbox unavailable|recipient rejected|no such user/i.test(rawMsg)
    ) {
      return {
        category: 'RECIPIENT_REJECTED',
        retryable: false,
        message: `收件人邮箱不存在或被目标服务器拒收 (${responseCode || '550'})`,
        rawError: rawMsg
      }
    }

    // 5. 内容策略/垃圾邮件拦截 (554 等)
    if (responseCode === 554 || /spam|blacklisted|content rejected/i.test(rawMsg)) {
      return {
        category: 'CONTENT_REJECTED',
        retryable: false,
        message: `邮件内容或附件被服务商反垃圾策略拦截 (${responseCode || '554'})`,
        rawError: rawMsg
      }
    }

    // 兜底未知
    return {
      category: 'UNKNOWN',
      retryable: false,
      message: `发送异常: ${rawMsg.slice(0, 100)}`,
      rawError: rawMsg
    }
  }

  public createTransporter(config: SmtpConfig, rawPassword?: string, pool = true): Transporter {
    let password = rawPassword
    if (!password) {
      // 尝试从存储加载解密密码
      const stored = storageService.getStoredSmtpConfig()
      // 注意: 这里也可以通过异步方法处理，但在创建时若无 password 尝试同步解密
    }

    const isSecure = config.security === 'SSL_TLS'
    const requireTLS = config.security === 'STARTTLS'

    const transportOptions: any = {
      host: config.host,
      port: config.port,
      secure: isSecure,
      requireTLS,
      auth: {
        user: config.username,
        pass: password || ''
      },
      connectionTimeout: (config.timeoutSeconds || 30) * 1000,
      greetingTimeout: 15000,
      socketTimeout: 60000
    }

    if (pool) {
      transportOptions.pool = true
      transportOptions.maxConnections = 5
      transportOptions.maxMessages = 100
    }

    return nodemailer.createTransport(transportOptions)
  }

  public async testConnection(config: SmtpConfig, rawPassword?: string): Promise<{ ok: boolean; message: string }> {
    let password = rawPassword
    if (!password) {
      const stored = await storageService.getStoredSmtpConfig()
      if (stored.encryptedPassword) {
        password = securityService.decrypt(stored.encryptedPassword)
      }
    }

    if (!password) {
      return { ok: false, message: '请填写 SMTP 授权码或密码' }
    }

    const transporter = this.createTransporter(config, password, false)
    try {
      await transporter.verify()
      return { ok: true, message: 'SMTP 服务器握手与认证测试成功！' }
    } catch (err: any) {
      const classified = this.classifyError(err)
      logger.warn('SMTP 测试连接失败', classified)
      return { ok: false, message: `${classified.message} [${classified.rawError}]` }
    } finally {
      transporter.close()
    }
  }
}

export const smtpService = new SmtpService()
