<template>
  <div class="settings-view">
    <!-- 主发件邮箱配置卡 -->
    <div class="panel-card">
      <div class="panel-title">
        <Mail :size="18" />
        <span>主发件邮箱配置 (SMTP)</span>
      </div>
      <div class="panel-desc">
        批量邮件将统一使用此邮箱通过 SMTP 协议逐封投递。密码将通过系统级安全加密（Windows safeStorage）持久化存储。
      </div>

      <!-- 快速服务商预设 -->
      <div class="preset-box">
        <span class="preset-label">快速预设填入:</span>
        <div class="preset-chips">
          <button
            v-for="p in presets"
            :key="p.id"
            type="button"
            class="preset-btn"
            @click="applyPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div v-if="currentPresetNote" class="preset-note-banner">
        <Info :size="15" />
        <span>{{ currentPresetNote }}</span>
      </div>

      <el-form :model="smtpForm" label-position="top" class="smtp-form">
        <div class="form-row-3">
          <el-form-item label="配置备注名称" required>
            <el-input v-model="smtpForm.name" placeholder="如：公司业务主通知邮箱" />
          </el-form-item>

          <el-form-item label="SMTP 服务器主机" required>
            <el-input v-model="smtpForm.host" placeholder="如：smtp.qq.com" />
          </el-form-item>

          <el-form-item label="SMTP 端口与加密" required>
            <div class="port-security-box">
              <el-input-number v-model="smtpForm.port" :min="1" :max="65535" style="width: 110px" />
              <el-select v-model="smtpForm.security" style="width: 140px">
                <el-option label="SSL/TLS (465)" value="SSL_TLS" />
                <el-option label="STARTTLS (587)" value="STARTTLS" />
                <el-option label="无加密 (25)" value="NONE" />
              </el-select>
            </div>
          </el-form-item>
        </div>

        <div class="form-row-2">
          <el-form-item label="发件邮箱账号 (SMTP 用户名)" required>
            <el-input v-model="smtpForm.username" placeholder="如：company@example.com" />
          </el-form-item>

          <el-form-item label="客户端授权码 / 专用密码" required>
            <el-input
              v-model="smtpForm.password"
              type="password"
              show-password
              :placeholder="smtpForm.hasPassword ? '已安全保存（若不修改请留空）' : '请输入邮箱开启 POP3/SMTP 后的 16 位独立授权码'"
            />
          </el-form-item>
        </div>

        <div class="form-row-3">
          <el-form-item label="发件人显示姓名">
            <el-input v-model="smtpForm.fromName" placeholder="如：XX科技通知中心" />
          </el-form-item>

          <el-form-item label="发件人邮箱地址 (通常与账号一致)" required>
            <el-input v-model="smtpForm.fromAddress" placeholder="如：company@example.com" />
          </el-form-item>

          <el-form-item label="回复地址 (Reply-To, 可选)">
            <el-input v-model="smtpForm.replyTo" placeholder="如需收件人回复至其他邮箱可填" />
          </el-form-item>
        </div>

        <div class="smtp-action-row">
          <el-button :loading="isTesting" @click="handleTestConnection">
            <Zap :size="14" style="margin-right: 4px" />
            测试 SMTP 连接与鉴权
          </el-button>

          <el-button type="primary" :loading="isSavingSmtp" @click="handleSaveSmtp">
            <Save :size="14" style="margin-right: 4px" />
            保存邮箱设置
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- 调度性能与系统参数 -->
    <div class="panel-card">
      <div class="panel-title">
        <Sliders :size="18" />
        <span>并发调度与投递策略</span>
      </div>
      <div class="panel-desc">
        配置多线程异步工作池并发数与间隔，合理设置可兼顾发送速率与第三方邮箱服务商的反垃圾防封策略。
      </div>

      <el-form :model="settingsForm" label-position="top" class="settings-form">
        <div class="form-row-3">
          <el-form-item label="并发发送工作池 (1 ~ 10)">
            <el-input-number v-model="settingsForm.concurrency" :min="1" :max="10" />
            <span class="field-hint-text">默认推荐 3 并发，避免单 IP 并发请求过高被目标邮箱拦截。</span>
          </el-form-item>

          <el-form-item label="全局发信间隔 (毫秒)">
            <el-input-number v-model="settingsForm.sendIntervalMs" :step="200" :min="200" :max="10000" />
            <span class="field-hint-text">每调度一封邮件之间的缓冲时间，默认 1000ms。</span>
          </el-form-item>

          <el-form-item label="遭遇临时网络故障时自动重试次数">
            <el-input-number v-model="settingsForm.maxRetryAttempts" :min="0" :max="5" />
            <span class="field-hint-text">对 4xx/超时等临时错误执行指数退避重试，默认 3 次。</span>
          </el-form-item>
        </div>

        <div class="settings-action-row">
          <el-button type="primary" :loading="isSavingSettings" @click="handleSaveSettings">
            <Save :size="14" style="margin-right: 4px" />
            保存调度参数
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- 运行目录与存储说明 -->
    <div class="panel-card">
      <div class="panel-title">
        <HardDrive :size="18" />
        <span>附件工作目录与数据持久化</span>
      </div>
      <div class="path-display-box">
        <div class="path-meta">
          <span class="meta-title">当前附件挂载目录 (mail-files):</span>
          <code class="path-code">{{ store.attachmentFolder || '正在读取...' }}</code>
        </div>
        <el-button @click="openFolder">
          <FolderOpen :size="14" style="margin-right: 4px" />
          在文件资源管理器中打开
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import {
  Mail,
  Sliders,
  HardDrive,
  Info,
  Zap,
  Save,
  FolderOpen
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import { SMTP_PRESETS, type SmtpPreset } from '@shared/constants'
import type { AppSettings, SmtpConfig } from '@shared/types'

const store = useAppStore()
const presets = SMTP_PRESETS
const currentPresetNote = ref('')

const isTesting = ref(false)
const isSavingSmtp = ref(false)
const isSavingSettings = ref(false)

const smtpForm = reactive<SmtpConfig>({ ...store.smtpConfig })
const settingsForm = reactive<AppSettings>({ ...store.settings })

watch(
  () => store.smtpConfig,
  (val) => {
    Object.assign(smtpForm, val)
  },
  { deep: true }
)

watch(
  () => store.settings,
  (val) => {
    Object.assign(settingsForm, val)
  },
  { deep: true }
)

function applyPreset(preset: SmtpPreset) {
  if (preset.host) smtpForm.host = preset.host
  smtpForm.port = preset.port
  smtpForm.security = preset.security
  currentPresetNote.value = preset.note
  ElMessage.info(`已填入 ${preset.label} 默认参数`)
}

async function handleTestConnection() {
  isTesting.value = true
  try {
    const res = await window.electronAPI.testSmtpConnection({ ...smtpForm })
    if (res.success && res.data?.ok) {
      ElMessage.success(res.data.message)
    } else {
      ElMessage.error(res.data?.message || res.error || '测试握手失败')
    }
  } finally {
    isTesting.value = false
  }
}

async function handleSaveSmtp() {
  isSavingSmtp.value = true
  try {
    const res = await window.electronAPI.saveSmtpConfig({ ...smtpForm })
    if (!res.success) throw new Error(res.error)
    await store.fetchSmtpConfig()
    ElMessage.success('SMTP 配置已安全持久化')
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    isSavingSmtp.value = false
  }
}

async function handleSaveSettings() {
  isSavingSettings.value = true
  try {
    const res = await window.electronAPI.saveSettings({ ...settingsForm })
    if (!res.success) throw new Error(res.error)
    await store.fetchSettings()
    ElMessage.success('并发调度参数已更新')
  } catch (err: any) {
    ElMessage.error(err?.message || '保存设置失败')
  } finally {
    isSavingSettings.value = false
  }
}

async function openFolder() {
  await window.electronAPI.openAttachmentFolder()
  await store.fetchAttachmentFiles()
}
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
}

.preset-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.preset-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-btn {
  background: #F1F5F9;
  border: 1px solid var(--border-color);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s ease;
}

.preset-btn:hover {
  background: #E2E8F0;
  border-color: #CBD5E1;
}

.preset-note-banner {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.form-row-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.form-row-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.port-security-box {
  display: flex;
  gap: 8px;
}

.field-hint-text {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 4px;
}

.smtp-action-row,
.settings-action-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.path-display-box {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.path-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.path-code {
  font-size: 13px;
  font-family: monospace;
  color: var(--text-primary);
  background: #E2E8F0;
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
