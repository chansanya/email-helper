<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="page-title">{{ currentTitle }}</h1>
      <span class="page-desc">{{ currentSubtitle }}</span>
    </div>

    <div class="header-right">
      <button class="action-btn" title="在资源管理器中打开附件目录 (mail-files)" @click="openFolder">
        <FolderOpen :size="16" />
        <span>打开附件目录</span>
      </button>

      <button class="action-btn" title="刷新数据状态" @click="handleRefresh">
        <RefreshCw :size="16" :class="{ spinning: isRefreshing }" />
        <span>刷新</span>
      </button>

      <button
        v-if="store.currentView !== 'tasks'"
        class="action-btn primary"
        @click="store.currentView = 'tasks'"
      >
        <Send :size="16" />
        <span>前往任务中心</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FolderOpen, RefreshCw, Send } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'

const store = useAppStore()
const isRefreshing = ref(false)

const viewTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: '工作台', subtitle: '运行概况与核心流程指引' },
  mapping: { title: '收件映射', subtitle: '管理收件邮箱与专属附件的一对一关联' },
  composer: { title: '邮件编辑', subtitle: '设计支持 Web 格式化与动态变量的邮件内容' },
  tasks: { title: '发送任务', subtitle: '实时监控多并发发送进度与明细审计' },
  history: { title: '发送历史', subtitle: '查看过往任务执行记录并导出完整报告' },
  settings: { title: '系统设置', subtitle: '配置主发件邮箱与调度并发参数' }
}

const currentTitle = computed(() => viewTitles[store.currentView]?.title || '邮箱助手')
const currentSubtitle = computed(() => viewTitles[store.currentView]?.subtitle || '')

async function openFolder() {
  const res = await window.electronAPI.openAttachmentFolder()
  if (!res.success) {
    ElMessage.error(res.error || '无法打开附件目录')
  }
}

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await store.reloadAll()
    ElMessage.success('已同步最新数据状态')
  } finally {
    setTimeout(() => {
      isRefreshing.value = false
    }, 400)
  }
}
</script>

<style scoped>
.app-header {
  height: 64px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.page-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: #F8FAFC;
  color: var(--text-primary);
  border-color: #CBD5E1;
}

.action-btn.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #FFFFFF;
}

.action-btn.primary:hover {
  background: var(--primary-hover);
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
