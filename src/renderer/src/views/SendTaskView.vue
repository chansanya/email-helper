<template>
  <div class="send-task-view">
    <!-- 无任务空状态 -->
    <div v-if="!currentJob" class="panel-card empty-task-card">
      <div class="empty-content">
        <Send :size="48" class="empty-icon" />
        <div class="empty-title">当前没有正在运行或选中的发送任务</div>
        <div class="empty-desc">
          您可以前往工作台进行体检并发起新任务，或者在“发送历史”中查看过往审计报告。
        </div>
        <el-button type="primary" size="large" @click="openPreflight">
          <Play :size="16" style="margin-right: 6px" />
          发起新批量发送任务
        </el-button>
      </div>
    </div>

    <!-- 存在任务状态看板 -->
    <div v-else class="task-active-container">
      <!-- 任务头部控制卡 -->
      <div class="panel-card task-header-card">
        <div class="header-main">
          <div class="job-meta">
            <div class="job-title-row">
              <h2 class="job-name">{{ currentJob.name }}</h2>
              <StatusBadge :status="currentJob.status" />
            </div>
            <div class="job-subtitle">
              <span>任务编号: {{ currentJob.id }}</span>
              <span>创建时间: {{ formatDate(currentJob.createdAt) }}</span>
              <span>并发限制: {{ currentJob.concurrency }} 线程</span>
              <span>间隔: {{ (currentJob.sendIntervalMs || 1000) / 1000 }}s</span>
            </div>
          </div>

          <div class="job-actions">
            <el-button
              v-if="currentJob.status === 'RUNNING'"
              type="warning"
              @click="handlePause"
            >
              <Pause :size="15" style="margin-right: 4px" />
              暂停发送
            </el-button>

            <el-button
              v-if="currentJob.status === 'PAUSED' || currentJob.status === 'BLOCKED_CONFIG'"
              type="primary"
              @click="handleResume"
            >
              <Play :size="15" style="margin-right: 4px" />
              继续执行
            </el-button>

            <el-button
              v-if="currentJob.status === 'RUNNING' || currentJob.status === 'PAUSED'"
              type="danger"
              plain
              @click="handleCancel"
            >
              <Ban :size="15" style="margin-right: 4px" />
              取消任务
            </el-button>

            <el-button
              v-if="canRetryFailed"
              type="primary"
              plain
              @click="handleRetryFailed"
            >
              <RotateCcw :size="15" style="margin-right: 4px" />
              仅重试失败项 ({{ currentJob.failedCount + currentJob.unknownCount }})
            </el-button>

            <el-button @click="handleExportReport">
              <Download :size="15" style="margin-right: 4px" />
              导出报告
            </el-button>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-section">
          <div class="progress-labels">
            <span class="progress-rate">总体完成度: {{ percent }}%</span>
            <span class="progress-counts">
              已处理 {{ currentJob.acceptedCount + currentJob.failedCount + currentJob.cancelledCount }} / {{ currentJob.totalCount }}
            </span>
          </div>
          <el-progress
            :percentage="percent"
            :status="progressStatus"
            :stroke-width="10"
            :show-text="false"
          />
        </div>

        <!-- 分类统计小药丸 -->
        <div class="stats-pills-row">
          <div class="pill total">总数: {{ currentJob.totalCount }}</div>
          <div class="pill success">SMTP 已接收: {{ currentJob.acceptedCount }}</div>
          <div class="pill danger">发送失败: {{ currentJob.failedCount }}</div>
          <div class="pill warning">待确认: {{ currentJob.unknownCount }}</div>
          <div class="pill neutral">排队/重试: {{ currentJob.pendingCount }}</div>
          <div v-if="currentJob.cancelledCount > 0" class="pill muted">已取消: {{ currentJob.cancelledCount }}</div>
        </div>
      </div>

      <!-- 子项实时审计列表 -->
      <div class="panel-card table-panel">
        <div class="sub-header">
          <span class="sub-title">发送子项列表与投递审计</span>
          <div class="filter-box">
            <el-select v-model="itemFilter" size="small" style="width: 140px">
              <el-option label="全部子项" value="ALL" />
              <el-option label="仅 SMTP 已接收" value="ACCEPTED" />
              <el-option label="仅发送失败" value="FAILED" />
              <el-option label="仅等待与进行中" value="PENDING" />
            </el-select>
          </div>
        </div>

        <el-table
          :data="filteredItems"
          row-key="id"
          style="width: 100%"
          max-height="460"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expanded-audit-box">
                <div class="audit-row">
                  <span class="audit-label">SMTP Message-ID:</span>
                  <span class="audit-val">{{ row.smtpMessageId || '尚未生成或发送未完成' }}</span>
                </div>
                <div class="audit-row">
                  <span class="audit-label">最后响应/错误:</span>
                  <span :class="['audit-val', row.errorCategory ? 'err' : '']">
                    {{ row.errorMessage || row.smtpResponse || '-' }}
                  </span>
                </div>
                <div class="audit-row">
                  <span class="audit-label">附件物理路径:</span>
                  <span class="audit-val">{{ row.attachmentPath }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="收件邮箱与客户" min-width="200">
            <template #default="{ row }">
              <div class="cell-recipient">
                <span class="rec-name">{{ row.recipientName }}</span>
                <span class="rec-email">{{ row.recipientEmail }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="专属附件文件" min-width="220">
            <template #default="{ row }">
              <div class="cell-attach">
                <Paperclip :size="13" class="attach-icon" />
                <span class="attach-filename" :title="row.attachmentName">{{ row.attachmentName }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="投递状态" width="140" align="center">
            <template #default="{ row }">
              <StatusBadge :status="row.status" />
            </template>
          </el-table-column>

          <el-table-column label="尝试次数" width="90" align="center">
            <template #default="{ row }">
              <span class="attempt-badge">{{ row.attemptCount }} 次</span>
            </template>
          </el-table-column>

          <el-table-column label="SMTP 响应/说明" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.status === 'SMTP_ACCEPTED'" class="resp-ok">
                {{ row.smtpResponse || '250 OK' }}
              </span>
              <span v-else-if="row.status === 'FAILED'" class="resp-err">
                {{ row.errorMessage || '发送失败' }}
              </span>
              <span v-else class="resp-waiting">
                {{ row.status === 'IN_PROGRESS' ? '正在与 SMTP 服务器交互...' : '排队等待调度' }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <PreflightModal ref="preflightRef" @started="handleJobStarted" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Send,
  Play,
  Pause,
  Ban,
  RotateCcw,
  Download,
  Paperclip
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from '../components/StatusBadge.vue'
import PreflightModal from '../components/PreflightModal.vue'
import type { SendJob } from '@shared/types'

const store = useAppStore()
const preflightRef = ref<InstanceType<typeof PreflightModal> | null>(null)
const itemFilter = ref<'ALL' | 'ACCEPTED' | 'FAILED' | 'PENDING'>('ALL')
let progressUnsub: (() => void) | null = null

const currentJob = computed<SendJob | null>(() => store.activeJob)

const percent = computed(() => {
  if (!currentJob.value || currentJob.value.totalCount === 0) return 0
  const processed =
    currentJob.value.acceptedCount +
    currentJob.value.failedCount +
    currentJob.value.cancelledCount
  return Math.min(100, Math.floor((processed / currentJob.value.totalCount) * 100))
})

const progressStatus = computed(() => {
  if (!currentJob.value) return undefined
  if (currentJob.value.status === 'COMPLETED') return 'success'
  if (currentJob.value.status === 'BLOCKED_CONFIG' || currentJob.value.failedCount > 0) return 'exception'
  return undefined
})

const canRetryFailed = computed(() => {
  if (!currentJob.value) return false
  const hasErrors = currentJob.value.failedCount > 0 || currentJob.value.unknownCount > 0
  return hasErrors && currentJob.value.status !== 'RUNNING'
})

const filteredItems = computed(() => {
  if (!currentJob.value) return []
  let items = currentJob.value.items || []
  if (itemFilter.value === 'ACCEPTED') {
    return items.filter((i) => i.status === 'SMTP_ACCEPTED')
  }
  if (itemFilter.value === 'FAILED') {
    return items.filter((i) => i.status === 'FAILED' || i.status === 'UNKNOWN')
  }
  if (itemFilter.value === 'PENDING') {
    return items.filter((i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS' || i.status === 'RETRY_WAIT')
  }
  return items
})

function formatDate(isoStr?: string): string {
  if (!isoStr) return '-'
  return isoStr.replace('T', ' ').slice(0, 19)
}

function openPreflight() {
  preflightRef.value?.open()
}

function handleJobStarted() {
  store.fetchActiveJob()
}

async function handlePause() {
  if (!currentJob.value) return
  await window.electronAPI.pauseSendJob(currentJob.value.id)
  await store.fetchActiveJob()
  ElMessage.warning('已请求暂停，当前正在发送中的邮件完成后将挂起')
}

async function handleResume() {
  if (!currentJob.value) return
  await window.electronAPI.resumeSendJob(currentJob.value.id)
  await store.fetchActiveJob()
  ElMessage.success('已继续发信调度')
}

async function handleCancel() {
  if (!currentJob.value) return
  try {
    await ElMessageBox.confirm('确定要终止本发信任务吗？未发送的子项将被取消。', '终止确认', {
      type: 'warning'
    })
    await window.electronAPI.cancelSendJob(currentJob.value.id)
    await store.fetchActiveJob()
    ElMessage.info('任务已取消')
  } catch {}
}

async function handleRetryFailed() {
  if (!currentJob.value) return
  const res = await window.electronAPI.retryFailedItems(currentJob.value.id)
  if (res.success && res.data) {
    store.activeJob = res.data
    ElMessage.success('已创建并启动失败项重试任务')
  }
}

async function handleExportReport() {
  if (!currentJob.value) return
  const res = await window.electronAPI.exportJobReport(currentJob.value.id)
  if (res.success && res.data) {
    ElMessage.success(`任务报告已导出至: ${res.data}`)
  }
}

onMounted(() => {
  store.fetchActiveJob()
  progressUnsub = window.electronAPI.onJobProgress((payload) => {
    store.handleProgressUpdate(payload)
    if (store.activeJob && store.activeJob.id === payload.jobId) {
      // 定期拉取最新 items 列表更新
      store.fetchActiveJob()
    }
  })
})

onUnmounted(() => {
  if (progressUnsub) {
    progressUnsub()
    progressUnsub = null
  }
})
</script>

<style scoped>
.send-task-view {
  display: flex;
  flex-direction: column;
}

.empty-task-card {
  padding: 60px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 480px;
}

.empty-icon {
  color: #CBD5E1;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.task-active-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-header-card {
  padding: 20px 24px;
  margin-bottom: 0;
}

.header-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.job-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.job-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.job-subtitle {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.job-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.stats-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.pill.total { background: #F1F5F9; color: var(--text-primary); }
.pill.success { background: var(--success-light); color: var(--success-color); border: 1px solid #A7F3D0; }
.pill.danger { background: var(--danger-light); color: var(--danger-color); border: 1px solid #FECACA; }
.pill.warning { background: var(--warning-light); color: var(--warning-color); border: 1px solid #FDE68A; }
.pill.neutral { background: #EFF6FF; color: var(--primary-color); }
.pill.muted { background: #F8FAFC; color: var(--text-muted); }

.table-panel {
  padding: 16px 20px;
  margin-bottom: 0;
}

.sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cell-recipient {
  display: flex;
  flex-direction: column;
}

.rec-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rec-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.cell-attach {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.attach-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.attach-filename {
  color: var(--text-primary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attempt-badge {
  background: #F1F5F9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.resp-ok {
  color: var(--success-color);
  font-size: 12px;
  font-family: monospace;
}

.resp-err {
  color: var(--danger-color);
  font-size: 12px;
}

.resp-waiting {
  color: var(--text-muted);
  font-size: 12px;
}

.expanded-audit-box {
  background: #F8FAFC;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin: 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.audit-row {
  display: flex;
  gap: 8px;
}

.audit-label {
  width: 130px;
  color: var(--text-muted);
  font-weight: 600;
}

.audit-val {
  color: var(--text-primary);
  font-family: monospace;
}

.audit-val.err {
  color: var(--danger-color);
}
</style>
