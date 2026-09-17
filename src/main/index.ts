import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import { storageService } from './services/storage.service'
import { getAttachmentDir, getDataDir } from './utils/paths'
import { logger } from './utils/logger'

// 单实例锁，避免重复打开多个进程打架
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    logger.info('邮箱助手启动中...')
    // 确保数据和附件目录就绪
    getDataDir()
    getAttachmentDir()

    // 检查并恢复异常中断的历史任务
    await storageService.recoverDanglingJobs()

    mainWindow = createMainWindow()
    registerIpcHandlers(mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        registerIpcHandlers(mainWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  process.on('uncaughtException', (err) => {
    logger.error('主进程未捕获异常', err)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('主进程未处理 Promise 拒绝', reason)
  })
}
