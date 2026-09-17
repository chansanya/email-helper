<template>
  <div class="desktop-titlebar">
    <!-- 左侧：应用信息 -->
    <div class="titlebar-left">
      <div class="app-icon-badge">
        <Send :size="16" />
      </div>
      <span class="app-name">邮箱助手</span>
    </div>

    <!-- 中部：双态切换分段控制 -->
    <div class="titlebar-center">
      <div class="desktop-segmented">
        <button
          type="button"
          :class="{ active: store.currentView === 'workspace' }"
          @click="store.currentView = 'workspace'"
        >
          <Mail :size="15" />
          <span>工作台</span>
        </button>

        <button
          type="button"
          :class="{ active: store.currentView === 'history' }"
          @click="store.currentView = 'history'"
        >
          <History :size="15" />
          <span>发送记录</span>
          <span v-if="store.activeJob && store.activeJob.status === 'RUNNING'" class="pulse-dot"></span>
        </button>
      </div>
    </div>

    <!-- 右侧：发件箱状态与窗体控制 -->
    <div class="titlebar-right">
      <!-- SMTP 状态胶囊 -->
      <button
        class="smtp-pill-btn"
        :title="store.isSmtpVerified ? `发件箱就绪: ${store.smtpConfig.fromAddress}` : '发件主邮箱未配置，点击前往设置'"
        @click="emit('openSettings')"
      >
        <span class="status-indicator" :class="{ active: store.isSmtpVerified }"></span>
        <span class="smtp-addr">{{ store.smtpConfig.fromAddress || '点击配置发件邮箱' }}</span>
      </button>

      <!-- 打开附件专属目录 -->
      <button class="title-action-btn" title="在电脑中打开附件存放文件夹 (mail-files)" @click="openAttachmentFolder">
        <FolderOpen :size="16" />
        <span class="action-text">附件目录</span>
      </button>

      <!-- 系统设置弹窗 -->
      <button class="title-action-btn" title="设置发件邮箱与发信参数" @click="emit('openSettings')">
        <Settings :size="16" />
        <span class="action-text">设置</span>
      </button>

      <!-- 分隔线 -->
      <div class="win-divider"></div>

      <!-- Windows 窗体按钮 -->
      <div class="win-controls">
        <button class="win-btn" title="最小化" @click="handleMinimize">
          <Minus :size="15" />
        </button>
        <button class="win-btn" :title="isMaximized ? '还原' : '最大化'" @click="handleMaximize">
          <Square :size="13" />
        </button>
        <button class="win-btn close" title="关闭" @click="handleClose">
          <X :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Send,
  Mail,
  History,
  FolderOpen,
  Settings,
  Minus,
  Square,
  X
} from 'lucide-vue-next'
import { useAppStore } from '../stores/useAppStore'

const store = useAppStore()
const isMaximized = ref(false)

const emit = defineEmits<{
  (e: 'openSettings'): void
}>()

async function openAttachmentFolder() {
  await window.electronAPI.openAttachmentFolder()
  await store.fetchAttachmentFiles()
}

async function handleMinimize() {
  await window.electronAPI.minimizeWindow()
}

async function handleMaximize() {
  isMaximized.value = await window.electronAPI.maximizeWindow()
}

async function handleClose() {
  await window.electronAPI.closeWindow()
}

onMounted(async () => {
  try {
    isMaximized.value = await window.electronAPI.isWindowMaximized()
  } catch {}
})
</script>

<style scoped>
.desktop-titlebar {
  height: 46px;
  background-color: var(--bg-titlebar);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 16px;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.app-icon-badge {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--primary-color);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
}

.app-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}



.titlebar-center {
  -webkit-app-region: no-drag;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.smtp-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 5px 10px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 220px;
}

.smtp-pill-btn:hover {
  background: #EFF6FF;
  border-color: #BFDBFE;
  color: var(--primary-color);
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #EF4444;
  flex-shrink: 0;
}

.status-indicator.active {
  background-color: #10B981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.smtp-addr {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.title-action-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.title-action-btn:hover {
  background: #F1F5F9;
  border-color: var(--border-color);
  color: var(--text-primary);
}

.action-text {
  font-weight: 500;
}

.win-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 2px;
}

.win-controls {
  display: flex;
  align-items: center;
}

.win-btn {
  width: 44px;
  height: 46px;
  background: transparent;
  border: none;
  color: #64748B;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.win-btn:hover {
  background: #F1F5F9;
  color: var(--text-primary);
}

.win-btn.close:hover {
  background: #EF4444;
  color: #FFFFFF;
}
</style>
