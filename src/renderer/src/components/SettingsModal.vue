<template>
  <el-dialog
    v-model="visible"
    title="系统与发件箱配置"
    width="720px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="settings-modal-body">
      <!-- 常用服务商预设 -->
      <div class="preset-section">
        <span class="preset-label">常用服务商快捷预设:</span>
        <div class="preset-chips">
          <button
            v-for="p in presets"
            :key="p.id"
            type="button"
            class="preset-chip"
            @click="applyPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div v-if="currentPresetNote" class="preset-note">
        <Info :size="16" />
        <span>{{ currentPresetNote }}</span>
      </div>

      <!-- SMTP 设置表单 -->
      <div class="form-grid-3">
        <div class="form-item">
          <label class="item-label">SMTP 主机</label>
          <el-input v-model="smtpForm.host" placeholder="如 smtp.qq.com" size="default" />
        </div>
        <div class="form-item">
          <label class="item-label">端口</label>
          <el-input-number v-model="smtpForm.port" :min="1" :max="65535" size="default" style="width: 100%" />
        </div>
        <div class="form-item">
          <label class="item-label">安全协议</label>
          <el-select v-model="smtpForm.security" size="default" style="width: 100%">
            <el-option label="SSL/TLS (端口 465)" value="SSL_TLS" />
            <el-option label="STARTTLS (端口 587)" value="STARTTLS" />
            <el-option label="无加密 (端口 25)" value="NONE" />
          </el-select>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-item">
          <label class="item-label">发件账号 (用户名/邮箱)</label>
          <el-input v-model="smtpForm.username" placeholder="如 sender@example.com" size="default" />
        </div>
        <div class="form-item">
          <label class="item-label">客户端专用授权码 / 密码</label>
          <el-input
            v-model="smtpForm.password"
            type="password"
            show-password
            size="default"
            :placeholder="smtpForm.hasPassword ? '已加密保存（若不修改请留空）' : '请输入邮箱 POP3/SMTP 专用授权码'"
          />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-item">
          <label class="item-label">发件人显示姓名</label>
          <el-input v-model="smtpForm.fromName" placeholder="如 发件人 / 通知中心" size="default" />
        </div>
        <div class="form-item">
          <label class="item-label">发件邮箱地址 (通常与账号一致)</label>
          <el-input v-model="smtpForm.fromAddress" placeholder="如 sender@example.com" size="default" />
        </div>
      </div>

      <!-- 调度参数 -->
      <div class="section-divider">
        <span>多线程与发信调度策略</span>
      </div>

      <div class="form-grid-3">
        <div class="form-item">
          <label class="item-label">并发发送数 (1 ~ 10)</label>
          <el-input-number v-model="settingsForm.concurrency" :min="1" :max="10" size="default" style="width: 100%" />
        </div>
        <div class="form-item">
          <label class="item-label">单封发送间隔 (毫秒)</label>
          <el-input-number v-model="settingsForm.sendIntervalMs" :step="200" :min="200" :max="10000" size="default" style="width: 100%" />
        </div>
        <div class="form-item">
          <label class="item-label">失败自动重试 (次)</label>
          <el-input-number v-model="settingsForm.maxRetryAttempts" :min="0" :max="5" size="default" style="width: 100%" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <el-button :loading="isTesting" @click="handleTestConnection">
          <Zap :size="15" style="margin-right: 4px" />
          测试连通性
        </el-button>

        <div class="footer-right">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="isSaving" @click="handleSave">
            保存配置
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Zap, Info } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import { SMTP_PRESETS, type SmtpPreset } from '@shared/constants'
import type { AppSettings, SmtpConfig } from '@shared/types'

const visible = ref(false)
const store = useAppStore()
const presets = SMTP_PRESETS
const currentPresetNote = ref('')

const isTesting = ref(false)
const isSaving = ref(false)

const smtpForm = reactive<SmtpConfig>({ ...store.smtpConfig })
const settingsForm = reactive<AppSettings>({ ...store.settings })

function open() {
  Object.assign(smtpForm, store.smtpConfig)
  Object.assign(settingsForm, store.settings)
  currentPresetNote.value = ''
  visible.value = true
}

function applyPreset(p: SmtpPreset) {
  if (p.host) smtpForm.host = p.host
  smtpForm.port = p.port
  smtpForm.security = p.security
  currentPresetNote.value = p.note
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

async function handleSave() {
  isSaving.value = true
  try {
    const [r1, r2] = await Promise.all([
      window.electronAPI.saveSmtpConfig({ ...smtpForm }),
      window.electronAPI.saveSettings({ ...settingsForm })
    ])
    if (!r1.success) throw new Error(r1.error)
    if (!r2.success) throw new Error(r2.error)
    await Promise.all([store.fetchSmtpConfig(), store.fetchSettings()])
    ElMessage.success('配置已保存')
    visible.value = false
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    isSaving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.settings-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px;
}

.preset-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.preset-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
  height: 32px;
  display: inline-flex;
  align-items: center;
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}

.preset-chip {
  background: #F1F5F9;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 12px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s ease;
  font-weight: 500;
}

.preset-chip:hover {
  background: #E2E8F0;
  border-color: #CBD5E1;
}

.preset-note {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--primary-color);
  line-height: 1.5;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-divider {
  border-top: 1px solid var(--border-color);
  margin: 10px 0 2px;
  padding-top: 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.footer-right {
  display: flex;
  gap: 10px;
}
</style>
