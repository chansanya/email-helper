<template>
  <el-dialog
    v-model="visible"
    title="批量导入收件名单与附件配置 (Excel / CSV)"
    width="680px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="import-container">
      <div class="step-guide">
        <div class="guide-item">
          <span class="step-num">1</span>
          <div class="guide-content">
            <div class="guide-title">准备符合规范的表格文件</div>
            <div class="guide-desc">
              表格首行需包含：<code>收件邮箱</code>、<code>附件相对路径</code>，可选 <code>收件人姓名</code>、<code>备注</code>。支持直接上传已补齐邮箱的收集表格（系统将按附件路径自动匹配回填）。
            </div>
          </div>
          <button type="button" class="template-download-btn" @click="downloadTemplate">
            <Download :size="15" />
            <span>下载标准 Excel 模板</span>
          </button>
        </div>

        <div class="guide-item">
          <span class="step-num">2</span>
          <div class="guide-content">
            <div class="guide-title">选择电脑中的表格文件</div>
            <div class="file-pick-row">
              <el-input v-model="selectedFilePath" readonly placeholder="请选择 .xlsx / .xls / .csv 文件" size="default" />
              <el-button size="default" @click="handleBrowseFile">
                <FileSpreadsheet :size="15" style="margin-right: 4px" />
                浏览选择文件
              </el-button>
            </div>
          </div>
        </div>

        <div class="guide-item">
          <span class="step-num">3</span>
          <div class="guide-content">
            <div class="guide-title">遇到相同收件邮箱时的处理方式</div>
            <el-radio-group v-model="strategy" class="strategy-group">
              <el-radio value="SKIP_EXISTING">跳过已存在的收件人 (推荐)</el-radio>
              <el-radio value="OVERWRITE_EXISTING">覆盖更新已存在的附件与姓名</el-radio>
            </el-radio-group>
          </div>
        </div>
      </div>

      <!-- 导入结果展示 -->
      <div v-if="result" class="import-result-card">
        <div class="result-header">
          <CheckCircle :size="20" class="result-icon success" />
          <span class="result-title">导入完成统计汇总</span>
        </div>
        <div class="result-stats">
          <div v-if="result.completedCount" class="stat-pill primary">回填补全: {{ result.completedCount }} 位</div>
          <div class="stat-pill success">新增添加: {{ result.importedCount }} 位</div>
          <div class="stat-pill warning">覆盖更新: {{ result.overwrittenCount }} 位</div>
          <div class="stat-pill neutral">跳过重复: {{ result.skippedCount }} 位</div>
          <div v-if="result.errorCount > 0" class="stat-pill danger">格式异常: {{ result.errorCount }} 位</div>
        </div>

        <div v-if="result.errors && result.errors.length > 0" class="error-box">
          <div class="error-title">以下行存在格式问题未能导入：</div>
          <div class="error-list">
            <div v-for="(err, idx) in result.errors" :key="idx" class="error-row">
              第 {{ err.row }} 行: {{ err.reason }} <span v-if="err.email">({{ err.email }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">关闭</el-button>
        <el-button
          type="primary"
          :disabled="!selectedFilePath"
          :loading="isImporting"
          @click="startImport"
        >
          开始执行表格解析与导入
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import type { ImportResult } from '@shared/types'

const visible = ref(false)
const selectedFilePath = ref('')
const strategy = ref<'SKIP_EXISTING' | 'OVERWRITE_EXISTING'>('SKIP_EXISTING')
const isImporting = ref(false)
const result = ref<ImportResult | null>(null)

const emit = defineEmits<{
  (e: 'imported'): void
}>()

function open() {
  selectedFilePath.value = ''
  strategy.value = 'SKIP_EXISTING'
  result.value = null
  visible.value = true
}

async function handleBrowseFile() {
  const res = await window.electronAPI.openFileDialog({
    filters: [
      { name: '表格文件', extensions: ['xlsx', 'xls', 'csv'] }
    ]
  })
  if (res.success && res.data) {
    selectedFilePath.value = res.data
    result.value = null
  }
}

async function downloadTemplate() {
  const res = await window.electronAPI.exportTemplateFile()
  if (res.success && res.data) {
    ElMessage.success(`导入模板已保存至: ${res.data}`)
  }
}

async function startImport() {
  if (!selectedFilePath.value) return
  isImporting.value = true
  result.value = null
  try {
    const res = await window.electronAPI.importMappings({
      filePath: selectedFilePath.value,
      strategy: strategy.value
    })
    if (!res.success) throw new Error(res.error)
    result.value = res.data || null
    ElMessage.success('导入执行完毕')
    emit('imported')
  } catch (err: any) {
    ElMessage.error(err?.message || '导入失败')
  } finally {
    isImporting.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.import-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 8px 4px;
}

.step-guide {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  padding: 14px 18px;
  border-radius: var(--radius-md);
}

.step-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--primary-color);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.guide-content {
  flex: 1;
}

.guide-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.guide-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.guide-desc code {
  background: #E2E8F0;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0F172A;
  font-weight: 600;
}

.file-pick-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.strategy-group {
  margin-top: 8px;
}

.template-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--primary-color);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.template-download-btn:hover {
  background: #EFF6FF;
  border-color: #BFDBFE;
}

.import-result-card {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.result-icon.success {
  color: var(--success-color);
}

.result-stats {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.stat-pill {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.stat-pill.success {
  background: var(--success-subtle);
  color: var(--success-color);
}

.stat-pill.primary {
  background: var(--primary-subtle);
  color: var(--primary-color);
  border: 1px solid #BFDBFE;
}

.stat-pill.warning {
  background: var(--warning-subtle);
  color: var(--warning-color);
}

.stat-pill.neutral {
  background: #F1F5F9;
  color: #475569;
}

.stat-pill.danger {
  background: var(--danger-subtle);
  color: var(--danger-color);
}

.error-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.error-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--danger-color);
}

.error-list {
  max-height: 140px;
  overflow-y: auto;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-row {
  padding: 3px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 6px 4px;
}
</style>
