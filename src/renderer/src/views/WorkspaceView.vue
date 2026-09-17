<template>
  <div class="workspace-view">
    <!-- 主体双栏工作区 -->
    <div class="workspace-main">
      <!-- 左栏：收件名单与附件 (宽 420px，舒展大方) -->
      <aside class="recipient-panel">
        <div class="panel-header">
          <div class="header-text">
            <span class="panel-title">收件名单与附件</span>
            <span class="panel-count">共 {{ store.mappings.length }} 人 · 就绪 {{ readyCount }} 人</span>
          </div>

          <div class="header-actions">
            <button class="mini-tool-btn" title="导入 Excel 或 CSV 表格" @click="openImport">
              <Upload :size="15" />
              <span>导入表格</span>
            </button>
            <button class="mini-tool-btn primary" title="手动录入收件人与附件映射" @click="openAdd">
              <Plus :size="15" />
              <span>手动新增</span>
            </button>
            <button class="mini-tool-btn" title="核验所有附件物理文件是否存在" @click="validateFiles">
              <RefreshCw :size="15" :class="{ spinning: isValidating }" />
            </button>
          </div>
        </div>

        <!-- 搜索与状态过滤 -->
        <div class="filter-strip">
          <el-input
            v-model="searchQuery"
            placeholder="搜索收件人姓名、邮箱或附件文件名..."
            clearable
            class="search-input"
          >
            <template #prefix>
              <Search :size="15" />
            </template>
          </el-input>

          <div class="mini-filters">
            <button
              :class="['filter-tag', { active: statusFilter === 'ALL' }]"
              @click="statusFilter = 'ALL'"
            >
              全部 ({{ store.mappings.length }})
            </button>
            <button
              :class="['filter-tag', { active: statusFilter === 'ENABLED' }]"
              @click="statusFilter = 'ENABLED'"
            >
              已就绪 ({{ readyCount }})
            </button>
            <button
              :class="['filter-tag danger', { active: statusFilter === 'ISSUE' }]"
              @click="statusFilter = 'ISSUE'"
            >
              异常缺失 ({{ issueCount }})
            </button>
          </div>
        </div>

        <!-- 拖拽投放与名单流 -->
        <div
          class="recipients-list"
          :class="{ dragging: isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
        >
          <div v-if="filteredList.length === 0" class="empty-list">
            <Inbox :size="40" class="empty-icon" />
            <div class="empty-hint">暂无符合条件的名单</div>
            <div class="empty-sub">支持直接把包含收件人姓名、邮箱、附件路径的 Excel/CSV 表格拖入此处</div>
          </div>

          <div
            v-for="item in filteredList"
            :key="item.id"
            :class="['recipient-card', { active: activeRecipient?.id === item.id, disabled: !item.enabled }]"
            @click="selectRecipient(item)"
            @dblclick="editItem(item)"
          >
            <div class="card-top">
              <div class="user-meta">
                <span class="user-name">{{ item.recipientName || '收件人' }}</span>
                <span class="user-email">{{ item.recipientEmail }}</span>
              </div>
              <div class="card-controls" @click.stop>
                <el-switch
                  v-model="item.enabled"
                  size="default"
                  @change="(val: boolean) => toggleItemEnabled(item, val)"
                />
              </div>
            </div>

            <div class="card-bottom">
              <div class="attach-chip" :class="{ error: item.fileStatus === 'MISSING' }">
                <Paperclip :size="13" class="attach-icon" />
                <span class="attach-name" :title="item.attachmentPath">
                  {{ getFileName(item.attachmentPath) }}
                </span>
              </div>

              <div class="card-status">
                <span v-if="item.fileStatus === 'MISSING'" class="status-tag red">附件缺失</span>
                <span v-else-if="item.emailStatus === 'INVALID'" class="status-tag red">邮箱非法</span>
                <span v-else class="status-tag green">{{ formatBytes(item.fileSize) }}</span>

                <button class="card-action-btn" title="编辑该收件人信息" @click.stop="editItem(item)">
                  <Edit :size="14" />
                </button>
                <button class="card-action-btn delete" title="删除该收件人" @click.stop="deleteItem(item)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部批量状态栏 -->
        <div class="panel-footer">
          <span class="footer-summary">
            就绪率: <strong>{{ readyCount }}</strong> / {{ store.mappings.length }} 封
          </span>
          <div class="footer-actions">
            <button class="text-action-btn" @click="exportMappings">导出名单</button>
            <button class="text-action-btn" @click="batchToggleAll">
              {{ allEnabled ? '全部停用' : '全部启用' }}
            </button>
          </div>
        </div>
      </aside>

      <!-- 右栏：邮件排版与所见即所得画布 -->
      <section class="composer-panel">
        <!-- 主题栏 -->
        <div class="subject-bar">
          <div class="subject-input-wrap">
            <span class="subject-prefix">邮件主题</span>
            <input
              v-model="store.template.subject"
              type="text"
              class="desktop-subject-input"
              placeholder="输入邮件主题，例如：【通知】{{recipientName}} 您好，请查收专属附件材料..."
              @change="saveTemplate"
            />
          </div>

          <div class="mode-switcher">
            <div class="desktop-segmented">
              <button
                type="button"
                :class="{ active: viewMode === 'edit' }"
                @click="viewMode = 'edit'"
              >
                <PenTool :size="14" />
                <span>编辑</span>
              </button>
              <button
                type="button"
                :class="{ active: viewMode === 'preview' }"
                @click="viewMode = 'preview'"
              >
                <Eye :size="14" />
                <span>预览</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 画布主视区 -->
        <div class="canvas-area">
          <div v-show="viewMode === 'edit'" class="editor-container">
            <RichEditor
              v-model="store.template.htmlContent"
              @update:model-value="saveTemplate"
            />
          </div>

          <div v-show="viewMode === 'preview'" class="preview-container">
            <div class="preview-recipient-hint">
              <span>当前正在预览: <strong>{{ activeRecipient?.recipientName || '收件人' }}</strong> &lt;{{ activeRecipient?.recipientEmail || 'recipient@example.com'}}&gt;</span>
              <span class="hint-sub">点击收件人，切换预览</span>
            </div>
            <div class="preview-box">
              <MailPreview
                :template="store.template"
                :selected-recipient="activeRecipient"
              />
            </div>
          </div>
        </div>

        <!-- 画布底栏 -->
        <div class="canvas-footer">
          <span class="auto-save-text">
            <Check :size="14" /> 邮件主题与正文已自动保存
          </span>

          <div class="canvas-footer-right">
            <button class="test-send-btn" @click="openTestMailDialog">
              <Send :size="14" />
              <span>测试邮件</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- 桌面底部全局指令栏 (浅色大方、大号按钮) -->
    <footer class="desktop-command-bar">
      <div class="cmd-left">
        <span class="cmd-metric">
          待发送: <strong>{{ readyCount }}</strong> 封
        </span>
        <span class="cmd-divider">·</span>
        <span class="cmd-metric" :class="{ err: issueCount > 0 }">
          异常文件: <strong>{{ issueCount }}</strong> 封
        </span>
        <span class="cmd-divider">·</span>
        <span class="cmd-metric">
          预计耗时: <strong>{{ estimatedTime }}</strong>
        </span>
      </div>

      <div class="cmd-center">
        <div class="knob-pill" title="点击调整发送并发" @click="emit('openSettings')">
          <Sliders :size="14" />
          <span>并发: {{ store.settings.concurrency }} 线程</span>
        </div>
        <div class="knob-pill" title="点击调整发送间隔" @click="emit('openSettings')">
          <Clock :size="14" />
          <span>间隔: {{ (store.settings.sendIntervalMs || 1000) / 1000 }} 秒</span>
        </div>
      </div>

      <div class="cmd-right">
        <button
          v-if="store.activeJob && store.activeJob.status === 'RUNNING'"
          class="monitor-btn"
          @click="openExecutionDrawer"
        >
          <Activity :size="16" class="spin" />
          <span>查看正在执行的任务 ({{ store.activeJob.acceptedCount }}/{{ store.activeJob.totalCount }})</span>
        </button>

        <button
          class="hero-send-btn"
          :disabled="readyCount === 0 || !store.isSmtpVerified"
          @click="startPreflight"
        >
          <Send :size="17" />
          <span>批量发送({{ readyCount }} 封)</span>
        </button>
      </div>
    </footer>

    <!-- 弹窗组件 -->
    <MappingFormDrawer ref="drawerRef" @saved="handleMappingSaved" />
    <ImportMappingModal ref="importModalRef" @imported="store.fetchMappings" />
    <PreflightModal ref="preflightRef" @started="handleJobStarted" />
    <ExecutionDrawer ref="execDrawerRef" />

    <!-- 发送测试邮件弹窗 -->
    <el-dialog v-model="testDialogVisible" title="测试邮件" width="480px" append-to-body>
      <div style="display: flex; flex-direction: column; gap: 12px; padding: 4px 0;">
        <span style="font-size: 14px; color: #475569; line-height: 1.6;">
          系统将以当前选中的收件人信息替换模板中的变量，直接发送一封真实邮件至您指定的接收邮箱，方便您在电脑或手机上查验排版。
        </span>
        <el-input v-model="testTargetEmail" placeholder="输入接收测试邮件的邮箱..." size="default" />
      </div>
      <template #footer>
        <el-button @click="testDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="isSendingTest" @click="doSendTestMail">
          立即发送测试
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Upload,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit,
  Paperclip,
  Inbox,
  PenTool,
  Eye,
  Check,
  Send,
  Sliders,
  Clock,
  Activity
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import RichEditor from '../components/RichEditor.vue'
import MailPreview from '../components/MailPreview.vue'
import MappingFormDrawer from '../components/MappingFormDrawer.vue'
import ImportMappingModal from '../components/ImportMappingModal.vue'
import PreflightModal from '../components/PreflightModal.vue'
import ExecutionDrawer from '../components/ExecutionDrawer.vue'
import type { RecipientMapping } from '@shared/types'

const store = useAppStore()

const emit = defineEmits<{
  (e: 'openSettings'): void
}>()

const searchQuery = ref('')
const statusFilter = ref<'ALL' | 'ENABLED' | 'ISSUE'>('ALL')
const isDragOver = ref(false)
const isValidating = ref(false)
const viewMode = ref<'edit' | 'preview'>('edit')

const activeRecipient = ref<RecipientMapping | null>(null)

const drawerRef = ref<InstanceType<typeof MappingFormDrawer> | null>(null)
const importModalRef = ref<InstanceType<typeof ImportMappingModal> | null>(null)
const preflightRef = ref<InstanceType<typeof PreflightModal> | null>(null)
const execDrawerRef = ref<InstanceType<typeof ExecutionDrawer> | null>(null)

const testDialogVisible = ref(false)
const testTargetEmail = ref('')
const isSendingTest = ref(false)

const readyCount = computed(
  () => store.mappings.filter((m) => m.enabled && m.fileStatus !== 'MISSING' && m.emailStatus !== 'INVALID').length
)

const issueCount = computed(
  () => store.mappings.filter((m) => m.fileStatus === 'MISSING' || m.emailStatus === 'INVALID').length
)

const allEnabled = computed(
  () => store.mappings.length > 0 && store.mappings.every((m) => m.enabled)
)

const filteredList = computed(() => {
  let list = store.mappings
  if (statusFilter.value === 'ENABLED') {
    list = list.filter((m) => m.enabled && m.fileStatus !== 'MISSING' && m.emailStatus !== 'INVALID')
  } else if (statusFilter.value === 'ISSUE') {
    list = list.filter((m) => m.fileStatus === 'MISSING' || m.emailStatus === 'INVALID')
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(
      (m) =>
        m.recipientEmail.toLowerCase().includes(q) ||
        (m.recipientName && m.recipientName.toLowerCase().includes(q)) ||
        m.attachmentPath.toLowerCase().includes(q)
    )
  }
  return list
})

const estimatedTime = computed(() => {
  const count = readyCount.value
  const concurrency = store.settings.concurrency || 3
  const interval = (store.settings.sendIntervalMs || 1000) / 1000
  const totalSec = Math.ceil((count / concurrency) * (interval + 1.5))
  if (totalSec < 60) return `约 ${totalSec} 秒`
  return `约 ${Math.ceil(totalSec / 60)} 分钟`
})

function getFileName(p: string): string {
  if (!p) return '未指定附件'
  return p.split(/[\\/]/).pop() || p
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function selectRecipient(item: RecipientMapping) {
  activeRecipient.value = item
}

async function toggleItemEnabled(item: RecipientMapping, val: boolean) {
  await window.electronAPI.updateMapping(item.id, { enabled: val })
}

async function deleteItem(item: RecipientMapping) {
  try {
    await ElMessageBox.confirm(`确定从名单中移除 ${item.recipientName || item.recipientEmail} 吗？`, '移除确认', {
      type: 'warning',
      confirmButtonText: '移除',
      cancelButtonText: '取消'
    })
    await window.electronAPI.deleteMappings([item.id])
    await store.fetchMappings()
    if (activeRecipient.value?.id === item.id) {
      activeRecipient.value = store.mappings[0] || null
    }
  } catch {}
}

async function batchToggleAll() {
  const target = !allEnabled.value
  for (const m of store.mappings) {
    m.enabled = target
    await window.electronAPI.updateMapping(m.id, { enabled: target })
  }
  ElMessage.success(`已${target ? '全部启用' : '全部停用'}`)
}

function openAdd() {
  drawerRef.value?.openAdd()
}

function editItem(item: RecipientMapping) {
  drawerRef.value?.openEdit(item)
}

async function handleMappingSaved() {
  await store.fetchMappings()
  if (activeRecipient.value) {
    const updated = store.mappings.find((m) => m.id === activeRecipient.value?.id)
    if (updated) activeRecipient.value = updated
  }
}

function openImport() {
  importModalRef.value?.open()
}

async function validateFiles() {
  isValidating.value = true
  try {
    await store.fetchMappings()
    ElMessage.success('已重新核对所有附件物理文件')
  } finally {
    setTimeout(() => {
      isValidating.value = false
    }, 400)
  }
}

async function exportMappings() {
  const res = await window.electronAPI.exportMappings()
  if (res.success && res.data?.defaultPath) {
    ElMessage.success(`名单已导出至: ${res.data.defaultPath}`)
  }
}

async function saveTemplate() {
  await window.electronAPI.saveTemplate({ ...store.template })
}

function openTestMailDialog() {
  testTargetEmail.value = store.smtpConfig.fromAddress || ''
  testDialogVisible.value = true
}

async function doSendTestMail() {
  if (!testTargetEmail.value) return
  isSendingTest.value = true
  try {
    await saveTemplate()
    const res = await window.electronAPI.sendTestMail(testTargetEmail.value)
    if (!res.success) throw new Error(res.error)
    ElMessage.success(res.data?.message || '测试邮件已发送')
    testDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err?.message || '发送失败')
  } finally {
    isSendingTest.value = false
  }
}

function startPreflight() {
  preflightRef.value?.open()
}

function handleJobStarted() {
  store.fetchActiveJob()
  openExecutionDrawer()
}

function openExecutionDrawer() {
  execDrawerRef.value?.open()
}

async function handleDrop(e: DragEvent) {
  isDragOver.value = false
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      const res = await window.electronAPI.importMappings({
        filePath: file.path,
        strategy: 'SKIP_EXISTING'
      })
      if (res.success) {
        ElMessage.success(`表格导入解析完成，成功添加 ${res.data?.importedCount} 条记录`)
        await store.fetchMappings()
      } else {
        ElMessage.error(res.error || '导入失败')
      }
    } else {
      ElMessage.info('请拖入 .xlsx / .xls / .csv 格式的收件名单表格文件')
    }
  }
}

onMounted(() => {
  if (store.mappings.length > 0) {
    activeRecipient.value = store.mappings[0]
  }
})
</script>

<style scoped>
.workspace-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 46px);
  overflow: hidden;
  background: var(--bg-app);
}

.workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 左栏：收件名单与附件 */
.recipient-panel {
  width: 420px;
  border-right: 1px solid var(--border-color);
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F8FAFC;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-count {
  font-size: 12px;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.mini-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-tool-btn:hover {
  background: #F1F5F9;
  border-color: #CBD5E1;
  color: var(--text-primary);
}

.mini-tool-btn.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #FFFFFF;
}

.mini-tool-btn.primary:hover {
  background: var(--primary-hover);
}

.filter-strip {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #FFFFFF;
}

.mini-filters {
  display: flex;
  gap: 6px;
}

.filter-tag {
  background: #F1F5F9;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.12s ease;
}

.filter-tag.active {
  background: #EFF6FF;
  border-color: #BFDBFE;
  color: var(--primary-color);
  font-weight: 600;
}

.filter-tag.danger.active {
  background: #FEF2F2;
  border-color: #FECACA;
  color: var(--danger-color);
}

.recipients-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #F8FAFC;
  transition: background 0.15s ease;
}

.recipients-list.dragging {
  background: #EFF6FF;
  outline: 2px dashed var(--primary-color);
}

.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  color: #CBD5E1;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-sub {
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.5;
}

.recipient-card {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.recipient-card:hover {
  border-color: #CBD5E1;
  box-shadow: var(--shadow-sm);
}

.recipient-card.active {
  border-color: var(--primary-color);
  background: #EFF6FF;
  box-shadow: 0 0 0 1px var(--primary-color);
}

.recipient-card.disabled {
  opacity: 0.6;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.user-meta {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.user-email {
  font-size: 13px;
  color: var(--text-secondary);
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #334155;
  max-width: 240px;
}

.attach-chip.error {
  background: #FEF2F2;
  color: var(--danger-color);
}

.attach-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.attach-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: inherit;
  font-weight: 500;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  font-size: 12px;
  font-weight: 600;
}

.status-tag.green { color: var(--success-color); }
.status-tag.red { color: var(--danger-color); }

.card-action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.card-action-btn:hover {
  color: var(--primary-color);
  background: #EFF6FF;
}

.card-action-btn.delete:hover {
  color: var(--danger-color);
  background: #FEE2E2;
}

.delete-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
}

.delete-btn:hover {
  color: var(--danger-color);
  background: #FEE2E2;
}

.panel-footer {
  height: 42px;
  padding: 0 16px;
  background: #FFFFFF;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-muted);
}

.footer-summary strong {
  color: var(--text-primary);
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.text-action-btn {
  background: transparent;
  border: none;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
}

.text-action-btn:hover {
  color: var(--primary-color);
}

/* 右栏：邮件画布 */
.composer-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  min-width: 0;
}

.subject-bar {
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #FFFFFF;
}

.subject-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subject-prefix {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-color);
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.desktop-subject-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: inherit;
}

.desktop-subject-input::placeholder {
  color: #94A3B8;
  font-weight: 400;
}

.canvas-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-container,
.preview-container {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-container {
  padding: 16px 20px;
  background: #F8FAFC;
}

.preview-recipient-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hint-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.preview-box {
  flex: 1;
  min-height: 0;
}

.canvas-footer {
  height: 46px;
  padding: 0 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
}

.auto-save-text {
  font-size: 13px;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.test-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.test-send-btn:hover {
  background: #F1F5F9;
  border-color: #CBD5E1;
  color: var(--text-primary);
}

/* 底部全局控制栏 (浅色大方、大号发送按钮) */
.desktop-command-bar {
  height: 56px;
  background: #FFFFFF;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -2px 8px rgba(15, 23, 42, 0.04);
  flex-shrink: 0;
}

.cmd-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-muted);
}

.cmd-metric strong {
  color: var(--text-primary);
  font-weight: 700;
}

.cmd-metric.err strong {
  color: #DC2626;
}

.cmd-divider {
  color: #CBD5E1;
}

.cmd-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.knob-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
  font-weight: 500;
}

.knob-pill:hover {
  background: #E2E8F0;
  color: var(--text-primary);
}

.cmd-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.monitor-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  color: var(--primary-color);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.hero-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #2563EB;
  color: #FFFFFF;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28);
}

.hero-send-btn:hover:not(:disabled) {
  background: #1D4ED8;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
}

.hero-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.spinning, .spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
