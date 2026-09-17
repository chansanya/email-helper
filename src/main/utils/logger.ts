import path from 'node:path'
import fs from 'node:fs'
import { getDataDir } from './paths'

function sanitize(text: string): string {
  return text.replace(/(password|pass|auth|code)["':\s=]+([^\s,"'}]+)/gi, '$1="***"')
}

function writeLog(level: string, message: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  const formattedArgs = args
    .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ')
  const line = `[${timestamp}] [${level.toUpperCase()}] ${sanitize(message)} ${sanitize(formattedArgs)}\n`

  // 1. 输出到控制台
  if (level === 'error') {
    console.error(line.trim())
  } else if (level === 'warn') {
    console.warn(line.trim())
  } else {
    console.log(line.trim())
  }

  // 2. 写入日志文件
  try {
    const logFile = path.join(getDataDir(), 'logs', 'app.log')
    fs.appendFileSync(logFile, line, 'utf-8')
  } catch {
    // 忽略日志文件写入异常，不影响主进程
  }
}

export const logger = {
  info: (msg: string, ...args: any[]) => writeLog('info', msg, ...args),
  warn: (msg: string, ...args: any[]) => writeLog('warn', msg, ...args),
  error: (msg: string, ...args: any[]) => writeLog('error', msg, ...args),
  debug: (msg: string, ...args: any[]) => writeLog('debug', msg, ...args)
}
