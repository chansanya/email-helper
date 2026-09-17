<template>
  <el-dialog
    v-model="visible"
    title="从附件存放目录 (mail-files) 挑选文件"
    width="720px"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="picker-container">
      <div class="picker-top">
        <el-input
          v-model="searchKey"
          placeholder="搜索文件名或子目录相对路径..."
          clearable
          size="default"
        >
          <template #prefix>
            <Search :size="15" />
          </template>
        </el-input>

        <button class="open-dir-btn" @click="openFolder">
          <FolderOpen :size="15" />
          <span>在电脑中打开文件夹</span>
        </button>
      </div>

      <div class="picker-list">
        <div v-if="filteredFiles.length === 0" class="empty-state">
          <FileQuestion :size="40" class="empty-icon" />
          <div class="empty-text">未在 mail-files 文件夹中找到文件</div>
          <div class="empty-tip">请将需要发送的成绩单、评语表等文件放进该目录，然后点击上方按钮打开并刷新</div>
        </div>

        <div
          v-for="file in filteredFiles"
          :key="file.relativePath"
          :class="['file-row', { selected: selectedPath === file.relativePath }]"
          @click="selectedPath = file.relativePath"
          @dblclick="confirmSelection"
        >
          <div class="file-info">
            <FileText :size="20" class="file-icon" />
            <div class="file-names">
              <div class="file-main-name">{{ file.name }}</div>
              <div class="file-rel-path">{{ file.relativePath }}</div>
            </div>
          </div>
          <div class="file-meta">
            <span class="file-size">{{ file.formattedSize }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="selected-hint" v-if="selectedPath">
          当前已选中: <strong>{{ selectedPath }}</strong>
        </span>
        <span v-else></span>

        <div class="btn-group">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :disabled="!selectedPath" @click="confirmSelection">
            确定选定此文件
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FolderOpen, FileText, FileQuestion } from 'lucide-vue-next'
import { useAppStore } from '../stores/useAppStore'

const visible = ref(false)
const searchKey = ref('')
const selectedPath = ref('')

const store = useAppStore()

const emit = defineEmits<{
  (e: 'select', relativePath: string): void
}>()

const filteredFiles = computed(() => {
  if (!searchKey.value) return store.attachmentFiles
  const k = searchKey.value.toLowerCase()
  return store.attachmentFiles.filter(
    (f) => f.name.toLowerCase().includes(k) || f.relativePath.toLowerCase().includes(k)
  )
})

function open(initialPath?: string) {
  selectedPath.value = initialPath || ''
  searchKey.value = ''
  visible.value = true
  store.fetchAttachmentFiles()
}

function confirmSelection() {
  if (selectedPath.value) {
    emit('select', selectedPath.value)
    visible.value = false
  }
}

async function openFolder() {
  await window.electronAPI.openAttachmentFolder()
  await store.fetchAttachmentFiles()
}

defineExpose({ open })
</script>

<style scoped>
.picker-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.picker-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.open-dir-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  font-weight: 500;
  transition: all 0.12s ease;
}

.open-dir-btn:hover {
  background: #F1F5F9;
  color: var(--text-primary);
  border-color: #CBD5E1;
}

.picker-list {
  max-height: 380px;
  min-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: #FFFFFF;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 0.12s ease;
}

.file-row:hover {
  background: #F8FAFC;
}

.file-row.selected {
  background: #EFF6FF;
  border-color: #BFDBFE;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: hidden;
}

.file-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.file-names {
  overflow: hidden;
}

.file-main-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-rel-path {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.file-meta {
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-left: 14px;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon {
  margin-bottom: 10px;
  color: #CBD5E1;
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-tip {
  font-size: 13px;
  margin-top: 6px;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.selected-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.btn-group {
  display: flex;
  gap: 10px;
}
</style>
