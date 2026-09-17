<template>
  <div class="mapping-view">
    <div class="panel-card table-panel">
      <!-- 顶部操作栏 -->
      <div class="table-actions-bar">
        <div class="left-tools">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索姓名、邮箱或附件路径..."
            clearable
            style="width: 260px"
          >
            <template #prefix>
              <Search :size="15" />
            </template>
          </el-input>

          <el-select v-model="filterStatus" placeholder="筛选状态" style="width: 140px">
            <el-option label="全部记录" value="ALL" />
            <el-option label="仅已启用" value="ENABLED" />
            <el-option label="仅未启用" value="DISABLED" />
            <el-option label="仅异常/附件缺失" value="ISSUE" />
          </el-select>

          <el-button @click="validateAll">
            <CheckCircle :size="14" style="margin-right: 4px" />
            重新校验文件
          </el-button>
        </div>

        <div class="right-tools">
          <el-button-group>
            <el-button type="primary" @click="handleAdd">
              <Plus :size="14" style="margin-right: 4px" />
              新增映射
            </el-button>

            <el-button @click="handleImport">
              <Upload :size="14" style="margin-right: 4px" />
              批量导入
            </el-button>

            <el-button @click="handleExport">
              <Download :size="14" style="margin-right: 4px" />
              导出配置
            </el-button>
          </el-button-group>
        </div>
      </div>

      <!-- 批量操作指示 -->
      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span class="batch-text">已选中 {{ selectedRows.length }} 项</span>
        <div class="batch-btns">
          <el-button size="small" @click="batchSetEnabled(true)">批量启用</el-button>
          <el-button size="small" @click="batchSetEnabled(false)">批量停用</el-button>
          <el-button size="small" type="danger" plain @click="batchDelete">
            批量删除
          </el-button>
        </div>
      </div>

      <!-- 核心表格 -->
      <el-table
        :data="filteredList"
        row-key="id"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" />

        <el-table-column label="收件人" min-width="170">
          <template #default="{ row }">
            <div class="recipient-cell">
              <div class="cell-name">{{ row.recipientName || '-' }}</div>
              <div class="cell-email">{{ row.recipientEmail }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="绑定专属附件 (相对 mail-files)" min-width="260">
          <template #default="{ row }">
            <div class="attachment-cell">
              <Paperclip :size="14" class="attach-icon" />
              <span class="attach-path" :title="row.attachmentPath">{{ row.attachmentPath }}</span>
              <span v-if="row.fileSize" class="attach-size">({{ formatBytes(row.fileSize) }})</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="文件状态" width="130" align="center">
          <template #default="{ row }">
            <StatusBadge :status="row.fileStatus || 'OK'" />
          </template>
        </el-table-column>

        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              size="small"
              @change="(val: boolean) => handleToggleEnabled(row, val)"
            />
          </template>
        </el-table-column>

        <el-table-column label="备注说明" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="remark-text">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <div class="table-row-actions">
              <button class="row-icon-btn" title="编辑映射" @click="handleEdit(row)">
                <Edit :size="15" />
              </button>
              <button class="row-icon-btn delete" title="删除映射" @click="handleDelete(row)">
                <Trash2 :size="15" />
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer-summary">
        共计 {{ store.mappings.length }} 条映射配置，当前展示 {{ filteredList.length }} 条
      </div>
    </div>

    <!-- 弹窗与抽屉 -->
    <MappingFormDrawer ref="drawerRef" @saved="store.fetchMappings" />
    <ImportMappingModal ref="importModalRef" @imported="store.fetchMappings" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search,
  Plus,
  Upload,
  Download,
  CheckCircle,
  Paperclip,
  Edit,
  Trash2
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from '../components/StatusBadge.vue'
import MappingFormDrawer from '../components/MappingFormDrawer.vue'
import ImportMappingModal from '../components/ImportMappingModal.vue'
import type { RecipientMapping } from '@shared/types'

const store = useAppStore()
const searchKeyword = ref('')
const filterStatus = ref<'ALL' | 'ENABLED' | 'DISABLED' | 'ISSUE'>('ALL')
const selectedRows = ref<RecipientMapping[]>([])

const drawerRef = ref<InstanceType<typeof MappingFormDrawer> | null>(null)
const importModalRef = ref<InstanceType<typeof ImportMappingModal> | null>(null)

const filteredList = computed(() => {
  let list = store.mappings
  if (filterStatus.value === 'ENABLED') {
    list = list.filter((m) => m.enabled)
  } else if (filterStatus.value === 'DISABLED') {
    list = list.filter((m) => !m.enabled)
  } else if (filterStatus.value === 'ISSUE') {
    list = list.filter((m) => m.fileStatus === 'MISSING' || m.emailStatus === 'INVALID')
  }

  if (searchKeyword.value) {
    const k = searchKeyword.value.toLowerCase()
    list = list.filter(
      (m) =>
        m.recipientEmail.toLowerCase().includes(k) ||
        (m.recipientName && m.recipientName.toLowerCase().includes(k)) ||
        m.attachmentPath.toLowerCase().includes(k)
    )
  }
  return list
})

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(isoStr: string): string {
  if (!isoStr) return '-'
  return isoStr.replace('T', ' ').slice(0, 19)
}

function handleSelectionChange(rows: RecipientMapping[]) {
  selectedRows.value = rows
}

function handleAdd() {
  drawerRef.value?.openAdd()
}

function handleEdit(row: RecipientMapping) {
  drawerRef.value?.openEdit(row)
}

function handleImport() {
  importModalRef.value?.open()
}

async function handleExport() {
  const res = await window.electronAPI.exportMappings()
  if (res.success && res.data?.defaultPath) {
    ElMessage.success(`配置已成功导出至: ${res.data.defaultPath}`)
  }
}

async function validateAll() {
  await store.fetchMappings()
  ElMessage.success('已重新核对所有附件文件存在性')
}

async function handleToggleEnabled(row: RecipientMapping, val: boolean) {
  await window.electronAPI.updateMapping(row.id, { enabled: val })
}

async function batchSetEnabled(enabled: boolean) {
  for (const r of selectedRows.value) {
    r.enabled = enabled
    await window.electronAPI.updateMapping(r.id, { enabled })
  }
  ElMessage.success(`已批量${enabled ? '启用' : '停用'}所选映射`)
}

async function handleDelete(row: RecipientMapping) {
  try {
    await ElMessageBox.confirm(`确定要移除收件人 ${row.recipientEmail} 的映射关系吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await window.electronAPI.deleteMappings([row.id])
    await store.fetchMappings()
    ElMessage.success('已删除映射记录')
  } catch {}
}

async function batchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定要批量删除选中的 ${selectedRows.value.length} 项映射关系吗？`,
      '批量删除确认',
      {
        confirmButtonText: '全部删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    const ids = selectedRows.value.map((r) => r.id)
    await window.electronAPI.deleteMappings(ids)
    await store.fetchMappings()
    selectedRows.value = []
    ElMessage.success('批量删除完成')
  } catch {}
}
</script>

<style scoped>
.mapping-view {
  display: flex;
  flex-direction: column;
}

.table-panel {
  padding: 16px 20px;
}

.table-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.left-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.right-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.batch-bar {
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: var(--radius-md);
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.batch-text {
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 600;
}

.batch-btns {
  display: flex;
  gap: 8px;
}

.recipient-cell {
  display: flex;
  flex-direction: column;
}

.cell-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.cell-email {
  font-size: 12px;
  color: var(--text-secondary);
}

.attachment-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  overflow: hidden;
}

.attach-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.attach-path {
  color: var(--text-primary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attach-size {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.remark-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.time-text {
  font-size: 12px;
  color: var(--text-muted);
}

.table-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.row-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.row-icon-btn:hover {
  background: #F1F5F9;
  color: var(--primary-color);
}

.row-icon-btn.delete:hover {
  background: #FEE2E2;
  color: var(--danger-color);
}

.table-footer-summary {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 14px;
  text-align: right;
}
</style>
