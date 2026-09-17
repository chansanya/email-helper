import type { AppSettings, MailTemplate, SmtpConfig } from './types'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  concurrency: 3,
  sendIntervalMs: 1000,
  maxRetryAttempts: 3,
  retryDelaySeconds: 10,
  attachmentFolder: 'mail-files'
}

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  name: '默认主邮箱',
  host: 'smtp.qq.com',
  port: 465,
  security: 'SSL_TLS',
  username: '',
  hasPassword: false,
  fromName: '邮箱助手通知',
  fromAddress: '',
  timeoutSeconds: 30
}

export const DEFAULT_MAIL_TEMPLATE: MailTemplate = {
  id: 'default-template',
  name: '默认通知模板',
  subject: '【通知】{{recipientName}} 您好，请查收您的专属附件材料',
  htmlContent: `<p>尊敬的 <strong>{{recipientName}}</strong>：</p>
<p>您好！您专属的文件材料已作为附件随信发送，请及时查收核对。</p>
<hr />
<p style="color: #475569; font-size: 14px; line-height: 1.8;">
  <strong>收件邮箱：</strong>{{recipientEmail}}<br />
  <strong>专属附件：</strong>{{attachmentName}}<br />
  <strong>发送日期：</strong>{{sendDate}}
</p>
<p style="color: #94A3B8; font-size: 13px; margin-top: 24px;">此邮件由系统自动发送，如对材料内容有疑问可直接回复本邮件联系发件人。</p>`,
  textContent: `尊敬的 {{recipientName}}：\n\n您好！您专属的文件材料已作为附件随信发送，请及时查收核对。\n\n收件邮箱：{{recipientEmail}}\n专属附件：{{attachmentName}}\n发送日期：{{sendDate}}\n\n此邮件由系统自动发送，如对材料内容有疑问可直接回复本邮件联系发件人。`,
  updatedAt: new Date().toISOString()
}

export interface SmtpPreset {
  id: string
  label: string
  host: string
  port: number
  security: 'SSL_TLS' | 'STARTTLS' | 'NONE'
  note: string
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: 'qq',
    label: 'QQ 邮箱',
    host: 'smtp.qq.com',
    port: 465,
    security: 'SSL_TLS',
    note: '需在 QQ 邮箱设置 - 账户中开启 POP3/SMTP 并生成 16 位独立授权码'
  },
  {
    id: '163',
    label: '163 网易邮箱',
    host: 'smtp.163.com',
    port: 465,
    security: 'SSL_TLS',
    note: '需在网易邮箱设置中开启客户端授权密码'
  },
  {
    id: '126',
    label: '126 网易邮箱',
    host: 'smtp.126.com',
    port: 465,
    security: 'SSL_TLS',
    note: '需在网易邮箱设置中开启客户端授权密码'
  },
  {
    id: 'tencent-enterprise',
    label: '腾讯企业邮 / 企微邮',
    host: 'smtp.exmail.qq.com',
    port: 465,
    security: 'SSL_TLS',
    note: '使用企业邮箱账号及客户端专用密码'
  },
  {
    id: 'aliyun-enterprise',
    label: '阿里企业邮箱',
    host: 'smtp.qiye.aliyun.com',
    port: 465,
    security: 'SSL_TLS',
    note: '端口 465 使用 SSL 加密'
  },
  {
    id: 'outlook',
    label: 'Outlook / Office 365',
    host: 'smtp.office365.com',
    port: 587,
    security: 'STARTTLS',
    note: '需开启 STARTTLS，通常使用微软账户或应用专用密码'
  },
  {
    id: 'custom',
    label: '自定义 SMTP 服务器',
    host: '',
    port: 465,
    security: 'SSL_TLS',
    note: '自行填写内网或第三方邮件发送服务器'
  }
]

export const TEMPLATE_VARIABLES = [
  { key: '{{recipientName}}', label: '收件人姓名', desc: '对应收件人姓名' },
  { key: '{{recipientEmail}}', label: '收件邮箱', desc: '对应收件人邮箱' },
  { key: '{{attachmentName}}', label: '附件名', desc: '对应专属绑定的附件文件名' },
  { key: '{{sendDate}}', label: '发送日期', desc: '发送时的当前日期，如 2026-09-17' }
]

export const JOB_STATUS_MAP: Record<string, { label: string; tagType: string }> = {
  DRAFT: { label: '草稿待发', tagType: 'info' },
  RUNNING: { label: '正在发送', tagType: 'primary' },
  PAUSED: { label: '已暂停', tagType: 'warning' },
  BLOCKED_CONFIG: { label: '配置受阻', tagType: 'danger' },
  INTERRUPTED: { label: '异常中断', tagType: 'danger' },
  COMPLETED: { label: '全部完成', tagType: 'success' },
  PARTIAL_SUCCESS: { label: '部分完成', tagType: 'warning' },
  CANCELLED: { label: '已取消', tagType: 'info' }
}

export const ITEM_STATUS_MAP: Record<string, { label: string; tagType: string }> = {
  PENDING: { label: '等待发送', tagType: 'info' },
  IN_PROGRESS: { label: '发送中', tagType: 'primary' },
  RETRY_WAIT: { label: '重试等待', tagType: 'warning' },
  SMTP_ACCEPTED: { label: 'SMTP 已接收', tagType: 'success' },
  FAILED: { label: '发送失败', tagType: 'danger' },
  CANCELLED: { label: '已取消', tagType: 'info' },
  UNKNOWN: { label: '待确认', tagType: 'warning' }
}
