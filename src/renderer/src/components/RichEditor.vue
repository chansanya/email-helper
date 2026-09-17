<template>
  <div class="rich-editor-wrapper">
    <div class="editor-toolbar">
      <div class="tool-group">
        <button type="button" class="tool-btn" title="加粗" @click="execCmd('bold')">
          <Bold :size="16" />
        </button>
        <button type="button" class="tool-btn" title="斜体" @click="execCmd('italic')">
          <Italic :size="16" />
        </button>
        <button type="button" class="tool-btn" title="下划线" @click="execCmd('underline')">
          <Underline :size="16" />
        </button>
        <button type="button" class="tool-btn" title="删除线" @click="execCmd('strikeThrough')">
          <Strikethrough :size="16" />
        </button>
      </div>

      <div class="tool-divider"></div>

      <div class="tool-group">
        <button type="button" class="tool-btn" title="大标题" @click="execFormatBlock('h2')">
          <Heading2 :size="16" />
        </button>
        <button type="button" class="tool-btn" title="正文段落" @click="execFormatBlock('p')">
          <Pilcrow :size="16" />
        </button>
        <button type="button" class="tool-btn" title="项目符号列表" @click="execCmd('insertUnorderedList')">
          <List :size="16" />
        </button>
        <button type="button" class="tool-btn" title="编号列表" @click="execCmd('insertOrderedList')">
          <ListOrdered :size="16" />
        </button>
        <button type="button" class="tool-btn" title="分割线" @click="execCmd('insertHorizontalRule')">
          <Minus :size="16" />
        </button>
      </div>

      <div class="tool-divider"></div>

      <div class="tool-group">
        <span class="var-label">正文插入变量:</span>
        <button
          v-for="v in variables"
          :key="v.key"
          type="button"
          class="var-chip"
          :title="v.desc"
          @click="insertVariable(v.key)"
        >
          <Code :size="13" />
          <span>{{ v.label }}</span>
        </button>
      </div>
    </div>

    <div
      ref="editorContentRef"
      class="editor-editable"
      contenteditable="true"
      @input="handleInput"
      @blur="handleBlur"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Pilcrow,
  List,
  ListOrdered,
  Minus,
  Code
} from 'lucide-vue-next'
import { TEMPLATE_VARIABLES } from '@shared/constants'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContentRef = ref<HTMLDivElement | null>(null)
const variables = TEMPLATE_VARIABLES

function execCmd(command: string, value: string | undefined = undefined) {
  document.execCommand(command, false, value)
  emitChange()
}

function execFormatBlock(tag: string) {
  document.execCommand('formatBlock', false, `<${tag}>`)
  emitChange()
}

function insertVariable(variableKey: string) {
  if (!editorContentRef.value) return
  editorContentRef.value.focus()
  document.execCommand('insertText', false, variableKey)
  emitChange()
}

function handleInput() {
  emitChange()
}

function handleBlur() {
  emitChange()
}

function emitChange() {
  if (editorContentRef.value) {
    emit('update:modelValue', editorContentRef.value.innerHTML)
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (editorContentRef.value && editorContentRef.value.innerHTML !== newVal) {
      editorContentRef.value.innerHTML = newVal || ''
    }
  }
)

onMounted(() => {
  if (editorContentRef.value) {
    editorContentRef.value.innerHTML = props.modelValue || ''
  }
})
</script>

<style scoped>
.rich-editor-wrapper {
  border: none;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 18px;
  background: #F8FAFC;
  border-bottom: 1px solid var(--border-color);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s ease;
}

.tool-btn:hover {
  background: #E2E8F0;
  color: var(--text-primary);
}

.tool-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 6px;
}

.var-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
  margin-right: 4px;
}

.var-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #BFDBFE;
  background: #EFF6FF;
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.var-chip:hover {
  background: #DBEAFE;
  border-color: #93C5FD;
}

.editor-editable {
  flex: 1;
  padding: 22px 26px;
  outline: none;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
  overflow-y: auto;
}

.editor-editable:focus {
  background: #FFFFFF;
}

/* 内部内容排版 */
.editor-editable h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 16px 0 10px;
  color: #0F172A;
}

.editor-editable p {
  margin-bottom: 12px;
}

.editor-editable hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 20px 0;
}

.editor-editable ul,
.editor-editable ol {
  padding-left: 28px;
  margin-bottom: 12px;
}
</style>
