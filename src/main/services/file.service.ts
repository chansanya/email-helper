import path from 'node:path'
import fs from 'node:fs'
import { shell, dialog } from 'electron'
import * as XLSX from 'xlsx'
import { getAttachmentDir, safeResolveAttachmentPath } from '../utils/paths'
import { storageService } from './storage.service'
import { logger } from '../utils/logger'
import type {
  FileScanItem,
  ImportOptions,
  ImportResult,
  RecipientMapping,
  SendJob
} from '../../shared/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export class FileService {
  public async scanAttachmentFiles(): Promise<FileScanItem[]> {
    const root = getAttachmentDir()
    const results: FileScanItem[] = []

    function walk(currentDir: string, currentRelative: string) {
      if (!fs.existsSync(currentDir)) return
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        const rel = currentRelative ? `${currentRelative}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          walk(fullPath, rel)
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath)
          results.push({
            relativePath: rel.replace(/\\/g, '/'),
            name: entry.name,
            size: stat.size,
            formattedSize: formatBytes(stat.size),
            updatedAt: stat.mtime.toISOString(),
            isDirectory: false
          })
        }
      }
    }

    try {
      walk(root, '')
    } catch (e) {
      logger.error('扫描附件目录失败', e)
    }

    return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }

  public async openAttachmentFolder(): Promise<boolean> {
    const dir = getAttachmentDir()
    const res = await shell.openPath(dir)
    return res === ''
  }

  public getAttachmentFolderPath(): string {
    return getAttachmentDir()
  }

  public async autoExtractFromAttachments(): Promise<{ extractedCount: number; skippedCount: number }> {
    const scanFiles = await this.scanAttachmentFiles()
    const currentMappings = await storageService.getMappings()
    const existingAttachPaths = new Set(
      currentMappings.map((m) => m.attachmentPath.toLowerCase().replace(/\\/g, '/'))
    )

    let extractedCount = 0
    let skippedCount = 0
    const updatedList = [...currentMappings]

    for (const file of scanFiles) {
      if (file.isDirectory) continue
      const normalizedPath = file.relativePath.toLowerCase().replace(/\\/g, '/')
      if (existingAttachPaths.has(normalizedPath)) {
        skippedCount++
        continue
      }

      // 保留完整文件名（去除扩展名）作为收件人姓名
      const rawName = path.parse(file.name).name
      const newMapping: RecipientMapping = {
        id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        recipientEmail: '',
        recipientName: rawName || file.name,
        attachmentPath: file.relativePath,
        enabled: false, // 邮箱为空默认禁用，防误发
        remark: '自动扫描生成(待补全邮箱)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileStatus: 'OK',
        fileSize: file.size,
        emailStatus: 'INVALID'
      }

      updatedList.push(newMapping)
      existingAttachPaths.add(normalizedPath)
      extractedCount++
    }

    if (extractedCount > 0) {
      await storageService.saveMappings(updatedList)
    }

    return { extractedCount, skippedCount }
  }

  public async exportMissingTemplate(): Promise<{ filePath: string; count: number }> {
    const mappings = await storageService.getMappings()
    const missingItems = mappings.filter((m) => !m.recipientEmail || !EMAIL_REGEX.test(m.recipientEmail))

    if (missingItems.length === 0) {
      throw new Error('当前所有收件人均已录入有效邮箱，无需导出待收集表格')
    }

    const { filePath } = await dialog.showSaveDialog({
      title: '导出待补全邮箱收集模板',
      defaultPath: `收件人邮箱待收集名单_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    })

    if (!filePath) return { filePath: '', count: 0 }

    const rows = missingItems.map((m, idx) => ({
      序号: idx + 1,
      收件人姓名: m.recipientName,
      '收件邮箱 (请在此列填写)': m.recipientEmail || '',
      文件识别编号: m.id,
      备注: m.remark || ''
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 32 },
      { wch: 28 },
      { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, '待补全名单')
    XLSX.writeFile(wb, filePath)

    return { filePath, count: missingItems.length }
  }

  public async exportTemplateFile(): Promise<string> {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出邮件映射导入模板',
      defaultPath: '邮箱附件映射导入模板.xlsx',
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    })
    if (!filePath) return ''

    const sampleData = [
      {
        收件邮箱: 'zhangsan@example.com',
        收件人姓名: '张三',
        附件相对路径: 'contracts/张三合同.pdf',
        是否启用: '是',
        备注: '重点客户'
      },
      {
        收件邮箱: 'lisi@example.com',
        收件人姓名: '李四',
        附件相对路径: 'reports/李四报告.xlsx',
        是否启用: '是',
        备注: '技术部'
      }
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sampleData)
    ws['!cols'] = [
      { wch: 28 },
      { wch: 14 },
      { wch: 32 },
      { wch: 10 },
      { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, '映射配置')
    XLSX.writeFile(wb, filePath)
    return filePath
  }

  public async importMappings(options: ImportOptions): Promise<ImportResult> {
    if (!fs.existsSync(options.filePath)) {
      throw new Error('导入文件不存在')
    }

    const wb = XLSX.readFile(options.filePath)
    const firstSheetName = wb.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('导入表格为空或格式不正确')
    }

    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], { defval: '' })
    if (!rows || rows.length === 0) {
      throw new Error('表格中没有有效的数据行')
    }

    const currentMappings = await storageService.getMappings()
    const existingIdMap = new Map<string, RecipientMapping>()
    const existingEmailMap = new Map<string, RecipientMapping>()
    const existingAttachMap = new Map<string, RecipientMapping>()

    for (const m of currentMappings) {
      if (m.id) {
        existingIdMap.set(m.id, m)
      }
      if (m.recipientEmail) {
        existingEmailMap.set(m.recipientEmail.toLowerCase(), m)
      }
      if (m.attachmentPath) {
        existingAttachMap.set(m.attachmentPath.toLowerCase().replace(/\\/g, '/'), m)
      }
    }

    let importedCount = 0
    let skippedCount = 0
    let overwrittenCount = 0
    let completedCount = 0
    const errors: Array<{ row: number; email?: string; reason: string }> = []
    const updatedList: RecipientMapping[] = [...currentMappings]

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 包含表头

      // 智能匹配列名
      const email = String(
        row['收件邮箱 (请在此列填写)'] ||
        row['收件邮箱'] ||
        row['recipient_email'] ||
        row['email'] ||
        row['邮箱'] ||
        ''
      ).trim()

      const name = String(
        row['收件人姓名'] ||
        row['recipient_name'] ||
        row['name'] ||
        row['姓名'] ||
        ''
      ).trim()

      const fileCode = String(
        row['文件识别编号'] ||
        row['文件识别码'] ||
        row['文件编号'] ||
        row['识别编号'] ||
        row['匹配编号'] ||
        row['ID'] ||
        row['id'] ||
        ''
      ).trim()

      const attach = String(
        row['专属附件相对路径 (请勿修改)'] ||
        row['附件相对路径'] ||
        row['attachment_path'] ||
        row['attachment'] ||
        row['附件'] ||
        ''
      ).trim()

      const enabledRaw = String(row['是否启用'] || row['enabled'] || row['启用'] || '1').trim()
      const remark = String(row['备注'] || row['remark'] || '').trim()

      if (!email && !attach && !name && !fileCode) continue // 跳过全空行

      const normAttach = attach ? attach.toLowerCase().replace(/\\/g, '/') : ''
      const isValidEmail = !!email && EMAIL_REGEX.test(email)

      // 1. 优先按文件识别编号（ID）匹配，或按附件相对路径匹配已有记录（回填补全模式）
      let matchedRecord: RecipientMapping | undefined
      if (fileCode && existingIdMap.has(fileCode)) {
        matchedRecord = existingIdMap.get(fileCode)
      } else if (normAttach && existingAttachMap.has(normAttach)) {
        matchedRecord = existingAttachMap.get(normAttach)
      }

      if (matchedRecord) {
        if (email) {
          if (!isValidEmail) {
            errors.push({ row: rowNum, email, reason: '邮箱格式非法' })
            continue
          }
          matchedRecord.recipientEmail = email
          if (name) matchedRecord.recipientName = name
          if (remark) matchedRecord.remark = remark
          const check = safeResolveAttachmentPath(matchedRecord.attachmentPath)
          matchedRecord.fileStatus = check.exists && check.isFile ? 'OK' : 'MISSING'
          matchedRecord.fileSize = check.size
          matchedRecord.emailStatus = 'VALID'
          matchedRecord.enabled = true // 补全成功后自动解除禁用
          matchedRecord.updatedAt = new Date().toISOString()
          completedCount++
          continue
        }
      }

      // 2. 常规导入模式：必须有邮箱
      if (!email) {
        errors.push({ row: rowNum, reason: '收件邮箱不能为空' })
        continue
      }

      if (!isValidEmail) {
        errors.push({ row: rowNum, email, reason: '邮箱格式非法' })
        continue
      }

      if (!attach) {
        errors.push({ row: rowNum, email, reason: '附件相对路径不能为空' })
        continue
      }

      const enabled = !(enabledRaw === '否' || enabledRaw === '0' || enabledRaw.toLowerCase() === 'false')
      const lowerEmail = email.toLowerCase()

      if (existingEmailMap.has(lowerEmail)) {
        if (options.strategy === 'SKIP_EXISTING') {
          skippedCount++
          continue
        } else {
          // 覆盖
          const existing = existingEmailMap.get(lowerEmail)!
          existing.recipientName = name || existing.recipientName
          existing.attachmentPath = attach.replace(/\\/g, '/')
          existing.enabled = enabled
          existing.remark = remark || existing.remark
          existing.updatedAt = new Date().toISOString()
          const check = safeResolveAttachmentPath(existing.attachmentPath)
          existing.fileStatus = check.exists && check.isFile ? 'OK' : 'MISSING'
          existing.fileSize = check.size
          existing.emailStatus = 'VALID'
          overwrittenCount++
        }
      } else {
        const check = safeResolveAttachmentPath(attach)
        const newRecord: RecipientMapping = {
          id: 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          recipientEmail: email,
          recipientName: name || email.split('@')[0],
          attachmentPath: attach.replace(/\\/g, '/'),
          enabled,
          remark,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fileStatus: check.exists && check.isFile ? 'OK' : 'MISSING',
          fileSize: check.size,
          emailStatus: 'VALID'
        }
        updatedList.push(newRecord)
        existingEmailMap.set(lowerEmail, newRecord)
        if (normAttach) existingAttachMap.set(normAttach, newRecord)
        importedCount++
      }
    }

    await storageService.saveMappings(updatedList)

    return {
      importedCount,
      skippedCount,
      overwrittenCount,
      completedCount,
      errorCount: errors.length,
      errors
    }
  }

  public async exportMappings(): Promise<{ defaultPath: string }> {
    const mappings = await storageService.getMappings()
    const { filePath } = await dialog.showSaveDialog({
      title: '导出收件映射配置',
      defaultPath: `邮箱附件映射配置_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    })
    if (!filePath) return { defaultPath: '' }

    const data = mappings.map((m) => ({
      收件邮箱: m.recipientEmail,
      收件人姓名: m.recipientName,
      附件相对路径: m.attachmentPath,
      是否启用: m.enabled ? '是' : '否',
      备注: m.remark || '',
      更新时间: m.updatedAt
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 36 },
      { wch: 10 },
      { wch: 20 },
      { wch: 22 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, '收件映射')
    XLSX.writeFile(wb, filePath)
    return { defaultPath: filePath }
  }

  public async exportJobReport(job: SendJob): Promise<string> {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出发送任务审计报告',
      defaultPath: `发送任务报告_${job.name}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    })
    if (!filePath) return ''

    const rows = job.items.map((item, idx) => ({
      序号: idx + 1,
      收件邮箱: item.recipientEmail,
      收件人姓名: item.recipientName,
      附件文件名: item.attachmentName,
      附件路径: item.attachmentPath,
      附件大小: formatBytes(item.attachmentSize),
      最终状态: item.status === 'SMTP_ACCEPTED' ? 'SMTP已接收' : item.status === 'FAILED' ? '发送失败' : item.status,
      尝试次数: item.attemptCount,
      SMTP响应代码: item.smtpResponse || '',
      MessageID: item.smtpMessageId || '',
      接收时间: item.acceptedAt || '',
      错误分类: item.errorCategory || '',
      错误原因: item.errorMessage || ''
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 14 },
      { wch: 24 },
      { wch: 32 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 30 },
      { wch: 36 },
      { wch: 22 },
      { wch: 16 },
      { wch: 40 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, '发送明细')
    XLSX.writeFile(wb, filePath)
    return filePath
  }
}

export const fileService = new FileService()
