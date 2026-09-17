<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="820px"
    :destroy-on-close="false"
    append-to-body
  >
    <div v-if="job" class="exec-drawer-body">
      <!-- 任务控制面板 -->
      <div class="job-control-panel">
        <div class="panel-top">
          <div class="job-heading">
            <span class="job-name-text">{{ job.name }}</span>
            <StatusBadge :status="job.status" />
          </div>

          <div class="control-btns">
            <el-button
              v-if="job.status === 'RUNNING'"
              size="default"
              type="warning"
              @click="handlePause"
            >
              <Pause :size="15" style="margin-right: 4px" />
              暂停发送
            </el-button>

            <el-button
              v-if="job.status === 'PAUSED' || job.status === 'BLOCKED_CONFIG'"
              size="default"
              type="primary"
              @click="handleResume"
            >
              <Play :size="15" style="margin-right: 4px" />
              继续执行
            </el-button>

            <el-button
              v-if="job.status === 'RUNNING' || job.status === 'PAUSED'"
              size="default"
              type="danger"
              plain
              @click="handleCancel"
            >
              <Ban :size="15" style="margin-right: 4px" />
              终止任务
            </el-button>

            <el-button
              v-if="canRetryFailed"
              size="default"
              type="primary"
              plain
              @click="handleRetryFailed"
            >
              <RotateCcw :size="15" style="margin-right: 4px" />
              重试失败项 ({{ job.failedCount + job.unknownCount }})
            </el-button>
          </div>
        </div>

        <!-- 进度大看板 -->
        <div class="progress-wrap">
          <div class="progress-text">
            <span class="p-counts">已处理 {{ processedCount }} / {{ job.totalCount }} 封邮件</span>
            <span class="p-percent">总体进度: {{ percent }}%</span>
          </div>
          <el-progress
            :percentage="percent"
            :status="progressStatus"
            :stroke-width="12"
            :show-text="false"
          />
        </div>

        <div v-if="job.status === 'COMPLETED'" class="completed-msg-box">
          <CheckCheck :size="18" />
          <span>本次任务已全部完成，所有邮件均已被发件服务器顺利接收！</span>
        </div>

        <!-- 统计药丸 -->
        <div class="stat-pills">
          <span class="pill total">总名单: {{ job.totalCount }}</span>
          <span class="pill success">SMTP 已接收: {{ job.acceptedCount }}</span>
          <span class="pill danger">发送失败: {{ job.failedCount }}</span>
          <span class="pill warning">待确认: {{ job.unknownCount }}</span>
          <span class="pill neutral">排队中: {{ job.pendingCount }}</span>
        </div>
      </div>

      <!-- 子项明细审计列表 -->
      <div class="audit-table-wrap">
        <div class="table-bar">
          <span class="bar-title">邮件明细</span>
          <el-select v-model="filterStatus" size="small" style="width: 150px">
            <el-option label="全部收件人" value="ALL" />
            <el-option label="仅 SMTP 已接收" value="ACCEPTED" />
            <el-option label="仅发送失败" value="FAILED" />
            <el-option label="排队与处理中" value="PENDING" />
          </el-select>
        </div>

        <el-table :data="displayItems" row-key="id" size="default" style="width: 100%" max-height="540">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="item-detail-box">
                <div class="detail-row">
                  <span class="d-label">SMTP Message-ID:</span>
                  <span class="d-val">{{ row.smtpMessageId || '暂无 / 尚未完成' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">服务器原始反馈:</span>
                  <span class="d-val" :class="{ err: row.errorCategory }">{{ row.errorMessage || row.smtpResponse || '-' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">发送附件路径:</span>
                  <span class="d-val">{{ row.attachmentPath }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="收件人与邮箱" min-width="200">
            <template #default="{ row }">
              <div class="rec-cell">
                <span class="r-name">{{ row.recipientName || '收件人' }}</span>
                <span class="r-email">{{ row.recipientEmail }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="专属附件" min-width="190" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="attach-cell">
                <Paperclip :size="14" class="p-icon" />
                <span>{{ row.attachmentName }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="140" align="center">
            <template #default="{ row }">
              <StatusBadge :status="row.status" />
            </template>
          </el-table-column>

          <el-table-column label="尝试次数" width="85" align="center">
            <template #default="{ row }">
              <span class="attempt-badge">{{ row.attemptCount }} 次</span>
            </template>
          </el-table-column>

          <el-table-column label="说明与反馈" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.status === 'SMTP_ACCEPTED'" class="resp-ok">{{ row.smtpResponse || '250 OK' }}</span>
              <span v-else-if="row.status === 'FAILED'" class="resp-err">{{ row.errorMessage || '发送失败' }}</span>
              <span v-else class="resp-muted">{{ row.status === 'IN_PROGRESS' ? '正在连接发件箱发送中...' : '排队中' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Pause,
  Play,
  Ban,
  RotateCcw,
  Paperclip,
  CheckCheck
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from './StatusBadge.vue'
import type { SendJob } from '@shared/types'

const visible = ref(false)
const store = useAppStore()
const filterStatus = ref<'ALL' | 'ACCEPTED' | 'FAILED' | 'PENDING'>('ALL')

const job = computed<SendJob | null>(() => store.activeJob)

const drawerTitle = computed(() => {
  return job.value ? `发信任务进度监控: ${job.value.name}` : '发信任务监控'
})

const processedCount = computed(() => {
  if (!job.value) return 0
  return job.value.acceptedCount + job.value.failedCount + job.value.cancelledCount
})

const percent = computed(() => {
  if (!job.value || job.value.totalCount === 0) return 0
  return Math.min(100, Math.floor((processedCount.value / job.value.totalCount) * 100))
})

const progressStatus = computed(() => {
  if (!job.value) return undefined
  if (job.value.status === 'COMPLETED') return 'success'
  if (job.value.status === 'BLOCKED_CONFIG' || job.value.failedCount > 0) return 'exception'
  return undefined
})

const canRetryFailed = computed(() => {
  if (!job.value) return false
  const hasErrors = job.value.failedCount > 0 || job.value.unknownCount > 0
  return hasErrors && job.value.status !== 'RUNNING'
})

const displayItems = computed(() => {
  if (!job.value) return []
  let list = job.value.items || []
  if (filterStatus.value === 'ACCEPTED') {
    return list.filter((i) => i.status === 'SMTP_ACCEPTED')
  }
  if (filterStatus.value === 'FAILED') {
    return list.filter((i) => i.status === 'FAILED' || i.status === 'UNKNOWN')
  }
  if (filterStatus.value === 'PENDING') {
    return list.filter((i) => i.status === 'PENDING' || i.status === 'IN_PROGRESS' || i.status === 'RETRY_WAIT')
  }
  return list
})

function open() {
  visible.value = true
}

async function handlePause() {
  if (!job.value) return
  await window.electronAPI.pauseSendJob(job.value.id)
  await store.fetchActiveJob()
  ElMessage.warning('已暂停新邮件派发')
}

async function handleResume() {
  if (!job.value) return
  await window.electronAPI.resumeSendJob(job.value.id)
  await store.fetchActiveJob()
  ElMessage.success('已继续发送')
}

async function handleCancel() {
  if (!job.value) return
  try {
    await ElMessageBox.confirm('确定要终止当前的发送任务吗？未发送的邮件将被取消。', '确认', { type: 'warning' })
    await window.electronAPI.cancelSendJob(job.value.id)
    await store.fetchActiveJob()
    ElMessage.info('任务已终止')
  } catch {}
}

async function handleRetryFailed() {
  if (!job.value) return
  const res = await window.electronAPI.retryFailedItems(job.value.id)
  if (res.success && res.data) {
    store.activeJob = res.data
    ElMessage.success('已创建针对失败项的新任务')
  }
}

defineExpose({ open })
</script>

<style scoped>
.exec-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.job-control-panel {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.job-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.job-name-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.control-btns {
  display: flex;
  gap: 8px;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.completed-msg-box {
  background: var(--success-subtle);
  border: 1px solid #A7F3D0;
  border-radius: 6px;
  padding: 10px 14px;
  color: var(--success-color);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.pill.total { background: #E2E8F0; color: #1E293B; }
.pill.success { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
.pill.danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
.pill.warning { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
.pill.neutral { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }

.audit-table-wrap {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-bar {
  padding: 10px 16px;
  background: #F8FAFC;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bar-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.rec-cell {
  display: flex;
  flex-direction: column;
}

.r-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.r-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.attach-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.p-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.attempt-badge {
  font-size: 13px;
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

.resp-muted {
  color: var(--text-muted);
  font-size: 12px;
}

.item-detail-box {
  background: #F8FAFC;
  padding: 10px 16px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  gap: 10px;
}

.d-label {
  width: 140px;
  color: var(--text-muted);
  font-weight: 600;
}

.d-val {
  font-family: monospace;
  color: var(--text-primary);
}

.d-val.err {
  color: var(--danger-color);
}
</style>
