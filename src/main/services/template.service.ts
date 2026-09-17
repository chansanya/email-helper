import juice from 'juice'
import type { MailTemplate, RecipientMapping } from '../../shared/types'

export interface InlineAttachment {
  filename: string
  content: Buffer
  cid: string
  contentType: string
  contentDisposition: string
}

export interface PreparedMailContent {
  subject: string
  html: string
  text: string
  inlineAttachments: InlineAttachment[]
}

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
  ): PreparedMailContent {
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

    // 将 Base64 图片 (data:image/...) 自动转换为全邮件客户端兼容的 CID 内嵌图片附件
    const inlineAttachments: InlineAttachment[] = []
    let imgIndex = 0
    const finalHtml = inlinedHtml.replace(
      /src=["']data:image\/([a-zA-Z0-9+]+);base64,([^"']+)["']/gi,
      (_, mimeType, base64Data) => {
        imgIndex++
        const cid = `img_${imgIndex}_${Date.now()}@emailhelper`
        const ext = mimeType.toLowerCase() === 'jpeg' ? 'jpg' : mimeType.toLowerCase()
        inlineAttachments.push({
          filename: `inline_image_${imgIndex}.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          cid,
          contentType: `image/${mimeType}`,
          contentDisposition: 'inline'
        })
        return `src="cid:${cid}"`
      }
    )

    return {
      subject: renderedSubject,
      html: finalHtml,
      text: renderedText || cleanHtml.replace(/<[^>]+>/g, ' ').trim(),
      inlineAttachments
    }
  }
}

export const templateService = new TemplateService()
