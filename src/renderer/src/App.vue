<template>
  <div class="desktop-shell">
    <DesktopTitlebar @open-settings="openSettingsModal" />
    <main class="desktop-main-canvas">
      <WorkspaceView
        v-show="store.currentView === 'workspace'"
        @open-settings="openSettingsModal"
      />
      <HistoryView
        v-show="store.currentView === 'history'"
      />
    </main>

    <SettingsModal ref="settingsModalRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import DesktopTitlebar from './components/DesktopTitlebar.vue'
import WorkspaceView from './views/WorkspaceView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useAppStore } from './stores/useAppStore'

const store = useAppStore()
const settingsModalRef = ref<InstanceType<typeof SettingsModal> | null>(null)
let progressUnsub: (() => void) | null = null
let pollTimer: any = null

function openSettingsModal() {
  settingsModalRef.value?.open()
}

onMounted(() => {
  store.reloadAll()

  // 1. 全局监听发信实时进度推送
  progressUnsub = window.electronAPI.onJobProgress((payload) => {
    store.handleProgressUpdate(payload)
    // 进度变动或完结时同步拉取完整的任务详情
    store.fetchActiveJob()
  })

  // 2. 状态兜底保障：当任务处于 RUNNING 或 PAUSED 状态时，每秒定时轮询核对状态，确保界面立即响应完成
  pollTimer = setInterval(() => {
    if (store.activeJob && (store.activeJob.status === 'RUNNING' || store.activeJob.status === 'PAUSED')) {
      store.fetchActiveJob()
    }
  }, 1000)
})

onUnmounted(() => {
  if (progressUnsub) progressUnsub()
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.desktop-main-canvas {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-app);
}
</style>
