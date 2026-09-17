import juice from 'juice'
import type { MailTemplate, RecipientMapping } from '../../shared/types'

function sanitizeMailHtml(html: string): string {
  if (!html) return ''
  return html
    // 移除 script 标签及其中内容
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // 移除 iframe / object / embed
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // 移除 javascript: 伪协议
    .replace(/href=["']\s*javascript:[^"']*["']/gi, 'href="#"')
    // 移除 on* 事件绑定 (如 onload, onclick, onerror 等)
    .replace(/\s+on[a-zA-Z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
}

export class TemplateService {
  public renderVariables(
    content: string,
    recipient: Partial<RecipientMapping>,
    attachmentName: string
  ): string {
    if (!content) return ''
    const today = new Date().toISOString().slice(0, 10)
    const name = recipient.recipientName || recipient.recipientEmail?.split('@')[0] || ''
    const email = recipient.recipientEmail || ''

    return content
      .replace(/\{\{\s*recipientName\s*\}\}/g, name)
      .replace(/\{\{\s*recipientEmail\s*\}\}/g, email)
      .replace(/\{\{\s*attachmentName\s*\}\}/g, attachmentName)
      .replace(/\{\{\s*sendDate\s*\}\}/g, today)
  }

  public prepareMailContent(
    template: MailTemplate,
    recipient: Partial<RecipientMapping>,
    attachmentName: string
  ): {
    subject: string
    html: string
    text: string
  } {
    const renderedSubject = this.renderVariables(template.subject, recipient, attachmentName)
    const renderedHtml = this.renderVariables(template.htmlContent, recipient, attachmentName)
    const renderedText = this.renderVariables(template.textContent, recipient, attachmentName)

    // 清理可能导致邮件客户端直接崩溃或拦截的危险标签
    const cleanHtml = sanitizeMailHtml(renderedHtml)

    // 内联样式转换，以获得对各类邮件客户端（包括 Outlook、Foxmail、网页邮箱）的最佳排版呈现
    const inlinedHtml = juice(cleanHtml, {
      preserveMediaQueries: true,
      removeStyleTags: false
    })

    return {
      subject: renderedSubject,
      html: inlinedHtml,
      text: renderedText || cleanHtml.replace(/<[^>]+>/g, ' ').trim()
    }
  }
}

export const templateService = new TemplateService()
