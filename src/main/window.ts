import { BrowserWindow, shell, ipcMain } from 'electron'
import path from 'node:path'

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1060,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0F172A',
    autoHideMenuBar: true,
    title: '邮箱助手',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 窗口控制 IPC
  ipcMain.handle('window:minimize', () => {
    if (!mainWindow.isDestroyed()) mainWindow.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
      return mainWindow.isMaximized()
    }
    return false
  })

  ipcMain.handle('window:close', () => {
    if (!mainWindow.isDestroyed()) mainWindow.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return !mainWindow.isDestroyed() && mainWindow.isMaximized()
  })

  // 开发与生产环境页面加载
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
