import { safeStorage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getDataDir } from '../utils/paths'
import { logger } from '../utils/logger'

class SecurityService {
  private fallbackKey: Buffer | null = null

  private getFallbackKey(): Buffer {
    if (this.fallbackKey) return this.fallbackKey
    const keyFile = path.join(getDataDir(), '.machine.key')
    if (fs.existsSync(keyFile)) {
      try {
        this.fallbackKey = fs.readFileSync(keyFile)
        if (this.fallbackKey.length === 32) return this.fallbackKey
      } catch {
        // regenerate below
      }
    }
    const newKey = crypto.randomBytes(32)
    try {
      fs.writeFileSync(keyFile, newKey)
    } catch (e) {
      logger.error('保存本地机器密钥失败', e)
    }
    this.fallbackKey = newKey
    return newKey
  }

  public encrypt(plaintext: string): string {
    if (!plaintext) return ''
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(plaintext)
        return `safe:${encrypted.toString('base64')}`
      }
    } catch (err) {
      logger.warn('系统 safeStorage 不可用，降级至 AES 保护', err)
    }

    // AES 降级
    try {
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-cbc', this.getFallbackKey(), iv)
      let encrypted = cipher.update(plaintext, 'utf8', 'base64')
      encrypted += cipher.final('base64')
      return `aes:${iv.toString('base64')}:${encrypted}`
    } catch (err) {
      logger.error('AES 加密失败', err)
      throw new Error('凭据加密保护失败')
    }
  }

  public decrypt(ciphertext: string): string {
    if (!ciphertext) return ''
    try {
      if (ciphertext.startsWith('safe:')) {
        const base64Str = ciphertext.slice(5)
        const buffer = Buffer.from(base64Str, 'base64')
        return safeStorage.decryptString(buffer)
      }

      if (ciphertext.startsWith('aes:')) {
        const parts = ciphertext.split(':')
        if (parts.length === 3) {
          const iv = Buffer.from(parts[1], 'base64')
          const enc = parts[2]
          const decipher = crypto.createDecipheriv('aes-256-cbc', this.getFallbackKey(), iv)
          let decrypted = decipher.update(enc, 'base64', 'utf8')
          decrypted += decipher.final('utf8')
          return decrypted
        }
      }

      // 如果是旧明文或者直接存储（做平滑迁移兼容）
      return ciphertext
    } catch (err) {
      logger.error('凭据解密失败', err)
      return ''
    }
  }
}

export const securityService = new SecurityService()
