import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

export function getAppRootDir(): string {
  // 1. 如果是 Windows 便携版 (electron-builder portable)，获取 portable exe 所在实际目录
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  // 2. 如果是打包后的常规生产运行，使用 exe 所在目录
  if (app && app.isPackaged) {
    return path.dirname(process.execPath)
  }
  // 3. 开发环境，使用项目根目录
  return path.resolve(__dirname, '../../')
}

export function getAttachmentDir(): string {
  const dir = path.join(getAppRootDir(), 'mail-files')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getDataDir(): string {
  const dir = path.join(getAppRootDir(), 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const subDirs = ['jobs', 'attempts', 'logs']
  for (const sub of subDirs) {
    const subPath = path.join(dir, sub)
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true })
    }
  }
  return dir
}

export function safeResolveAttachmentPath(relativePath: string): {
  fullPath: string
  exists: boolean
  size: number
  isFile: boolean
  error?: string
} {
  try {
    const root = path.resolve(getAttachmentDir())
    // 规范化相对路径，移除开头的斜杠
    const cleanRelative = relativePath.replace(/^[/\\]+/, '')
    const fullPath = path.resolve(root, cleanRelative)

    // 严防跨目录穿透（如 ../../Windows/...）
    if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
      return {
        fullPath,
        exists: false,
        size: 0,
        isFile: false,
        error: '附件路径超出允许的 mail-files 目录范围'
      }
    }

    if (!fs.existsSync(fullPath)) {
      return {
        fullPath,
        exists: false,
        size: 0,
        isFile: false,
        error: '附件文件不存在'
      }
    }

    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) {
      return {
        fullPath,
        exists: false,
        size: 0,
        isFile: false,
        error: '目标路径不是普通文件'
      }
    }

    return {
      fullPath,
      exists: true,
      size: stat.size,
      isFile: true
    }
  } catch (err: any) {
    return {
      fullPath: '',
      exists: false,
      size: 0,
      isFile: false,
      error: err?.message || '附件路径校验异常'
    }
  }
}
