<template>
  <div class="desktop-history-view">
    <div class="history-top-bar">
      <div class="top-left">
        <span class="top-title">历史任务记录</span>
        <span class="top-desc">查看各批次发信任务的投递状态与逐条审计明细</span>
      </div>

      <div class="top-right">
        <el-button size="default" @click="loadHistory">
          <RefreshCw :size="15" style="margin-right: 4px" />
          刷新
        </el-button>
      </div>
    </div>

    <div class="history-table-box">
      <el-table :data="pagedHistoryList" size="default" style="width: 100%" v-loading="loading">
        <el-table-column label="任务名称" min-width="240">
          <template #default="{ row }">
            <div class="job-meta-cell" @click="viewJob(row.id)" style="cursor: pointer;">
              <span class="j-title clickable" title="点击查看该任务明细">{{ row.name }}</span>
              <span class="j-id">任务编号: {{ row.id }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="最终状态" width="160" align="center">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>

        <el-table-column label="投递统计" min-width="250">
          <template #default="{ row }">
            <div class="stat-pills-row">
              <span class="pill-tag success">成功: {{ row.acceptedCount }}</span>
              <span v-if="row.failedCount > 0" class="pill-tag danger">失败: {{ row.failedCount }}</span>
              <span v-if="row.unknownCount > 0" class="pill-tag warning">待确认: {{ row.unknownCount }}</span>
              <span class="pill-tag neutral">总数: {{ row.totalCount }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="发起时间" width="180">
          <template #default="{ row }">
            <span class="t-text">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="完成时间" width="180">
          <template #default="{ row }">
            <span class="t-text">{{ formatDate(row.finishedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="90" align="center" fixed="right">
          <template #default="{ row }">
            <div class="row-btns">
              <el-tooltip content="删除该任务记录" placement="top">
                <button class="table-icon-btn delete" title="删除" @click.stop="handleDeleteJob(row)">
                  <Trash2 :size="15" />
                </button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 底部清晰分页 -->
      <div class="pagination-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="historyList.length"
          layout="total, sizes, prev, pager, next"
          size="default"
        />
      </div>
    </div>

    <ExecutionDrawer ref="execDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RefreshCw, Trash2 } from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from '../components/StatusBadge.vue'
import ExecutionDrawer from '../components/ExecutionDrawer.vue'
import type { SendJobSummary } from '@shared/types'

const store = useAppStore()
const loading = ref(false)
const historyList = ref<SendJobSummary[]>([])
const execDrawerRef = ref<InstanceType<typeof ExecutionDrawer> | null>(null)

const currentPage = ref(1)
const pageSize = ref(10)

const pagedHistoryList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return historyList.value.slice(start, start + pageSize.value)
})

async function loadHistory() {
  loading.value = true
  try {
    const res = await window.electronAPI.listHistoryJobs()
    if (res.success && res.data) {
      historyList.value = res.data
    }
  } finally {
    loading.value = false
  }
}

function formatDate(isoStr?: string): string {
  if (!isoStr) return '-'
  return isoStr.replace('T', ' ').slice(0, 19)
}

async function viewJob(jobId: string) {
  const res = await window.electronAPI.getJobDetail(jobId)
  if (res.success && res.data?.job) {
    store.activeJob = res.data.job
    execDrawerRef.value?.open()
  }
}

async function handleDeleteJob(row: SendJobSummary) {
  try {
    await ElMessageBox.confirm(`确定要删除历史任务「${row.name}」吗？删除后该任务记录不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const res = await window.electronAPI.deleteHistoryJob(row.id)
    if (!res.success) throw new Error(res.error)
    ElMessage.success('任务记录已删除')
    await loadHistory()
  } catch {}
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.desktop-history-view {
  height: calc(100vh - 46px);
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  padding: 16px 20px;
  gap: 14px;
}

.history-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px 20px;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.top-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.top-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.top-desc {
  font-size: 13px;
  color: var(--text-muted);
}

.history-table-box {
  flex: 1;
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.job-meta-cell {
  display: flex;
  flex-direction: column;
}

.j-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  transition: color 0.12s ease;
}

.j-title.clickable:hover {
  color: var(--primary-color);
  text-decoration: underline;
}

.j-id {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 2px;
}

.stat-pills-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill-tag {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.pill-tag.success { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
.pill-tag.danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
.pill-tag.warning { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
.pill-tag.neutral { background: #F1F5F9; color: #475569; }

.t-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.row-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.table-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #F1F5F9;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.table-icon-btn:hover {
  background: #EFF6FF;
  border-color: #BFDBFE;
  color: var(--primary-color);
}

.table-icon-btn.delete:hover {
  background: #FEF2F2;
  border-color: #FECACA;
  color: var(--danger-color);
}

.pagination-footer {
  padding: 12px 20px;
  background: #FFFFFF;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
