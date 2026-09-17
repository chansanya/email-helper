<template>
  <el-dialog
    v-model="visible"
    title="批量发信前体检与就绪确认"
    width="740px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div v-loading="loading" class="preflight-body">
      <div v-if="report" class="report-wrapper">
        <!-- 核心指标看板 -->
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">待发有效名单</span>
            <span class="metric-value primary">{{ report.validCount }}</span>
            <span class="metric-sub">共录入 {{ report.totalCandidates }} 位收件人</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">附件总大小</span>
            <span class="metric-value">{{ report.formattedTotalAttachmentSize }}</span>
            <span class="metric-sub">各收件人独立打包</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">预计发完耗时</span>
            <span class="metric-value">{{ formatDuration(report.estimatedTimeSeconds) }}</span>
            <span class="metric-sub">基于当前并发与间隔</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">发件邮箱状态</span>
            <span :class="['metric-value', report.smtpStatus.ok ? 'success' : 'danger']">
              {{ report.smtpStatus.ok ? '配置就绪' : '不可用' }}
            </span>
            <span class="metric-sub">{{ report.smtpStatus.message }}</span>
          </div>
        </div>

        <!-- 异常与警告列表 -->
        <div v-if="report.issues && report.issues.length > 0" class="issues-box">
          <div class="issues-header">
            <AlertTriangle :size="18" class="issues-icon" />
            <span>发现 {{ report.issues.length }} 项需要关注的潜在问题：</span>
          </div>
          <div class="issues-list">
            <div
              v-for="(issue, idx) in report.issues"
              :key="idx"
              :class="['issue-item', issue.type.toLowerCase()]"
            >
              <span class="issue-badge">{{ issue.type === 'ERROR' ? '阻断错误' : '温馨提示' }}</span>
              <span class="issue-msg">{{ issue.message }}</span>
            </div>
          </div>
        </div>

        <div v-else class="all-clear-box">
          <CheckCircle :size="20" class="all-clear-icon" />
          <span>所有收件名单与附件文件已全数核验完毕，全部处于可用就绪状态！</span>
        </div>

        <!-- 任务名称输入 -->
        <div class="job-name-row">
          <span class="name-label">本次任务名称:</span>
          <el-input v-model="jobName" placeholder="如：业务通知单及专属附件批量发送" size="default" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">返回检查</el-button>
        <el-button
          type="primary"
          :disabled="!report || !report.readyToStart"
          :loading="isStarting"
          @click="handleConfirmSend"
        >
          立即开始
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle, AlertTriangle } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import type { PreflightResult } from '@shared/types'

const visible = ref(false)
const loading = ref(false)
const isStarting = ref(false)
const report = ref<PreflightResult | null>(null)
const jobName = ref('')

const emit = defineEmits<{
  (e: 'started'): void
}>()

async function open() {
  visible.value = true
  loading.value = true
  report.value = null
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  jobName.value = `批量发信_${y}${m}${d}${hh}${mm}`

  try {
    const res = await window.electronAPI.preflightCheck()
    if (!res.success) throw new Error(res.error)
    report.value = res.data || null
  } catch (err: any) {
    ElMessage.error(err?.message || '预检执行失败')
  } finally {
    loading.value = false
  }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `约 ${sec} 秒`
  const min = Math.floor(sec / 60)
  const remainingSec = sec % 60
  return `约 ${min} 分 ${remainingSec} 秒`
}

async function handleConfirmSend() {
  isStarting.value = true
  try {
    const res = await window.electronAPI.startSendJob({ jobName: jobName.value })
    if (!res.success) throw new Error(res.error)
    ElMessage.success('批量发信任务已启动！')
    visible.value = false
    emit('started')
  } catch (err: any) {
    ElMessage.error(err?.message || '任务启动失败')
  } finally {
    isStarting.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.report-wrapper {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 8px 4px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.metric-card {
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 6px 0 3px;
}

.metric-value.primary { color: var(--primary-color); }
.metric-value.success { color: var(--success-color); }
.metric-value.danger { color: var(--danger-color); }

.metric-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.issues-box {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: var(--radius-md);
  padding: 16px 18px;
}

.issues-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #B45309;
}

.issues-icon {
  color: #D97706;
}

.issues-list {
  max-height: 180px;
  overflow-y: auto;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.issue-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.issue-item.error .issue-badge {
  background: #FEE2E2;
  color: #B91C1C;
}

.issue-item.warning .issue-badge {
  background: #FEF3C7;
  color: #B45309;
}

.issue-msg {
  color: #1E293B;
  line-height: 1.5;
}

.all-clear-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--success-subtle);
  border: 1px solid #A7F3D0;
  border-radius: var(--radius-md);
  padding: 14px 18px;
  color: var(--success-color);
  font-size: 14px;
  font-weight: 600;
}

.all-clear-icon {
  flex-shrink: 0;
}

.job-name-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}

.name-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 6px 4px;
}
</style>
