<template>
  <div class="composer-view">
    <div class="composer-grid">
      <!-- 左侧：编辑区 -->
      <div class="editor-column">
        <div class="panel-card composer-card">
          <div class="composer-top-bar">
            <div class="field-row">
              <span class="field-label">模板名称:</span>
              <el-input v-model="templateForm.name" placeholder="模板标识，如：月度结算账单通知" />
            </div>

            <div class="field-row">
              <span class="field-label">邮件主题:</span>
              <div class="subject-input-box">
                <el-input
                  v-model="templateForm.subject"
                  placeholder="支持变量，如：【结算】{{recipientName}} 您的账单已生成"
                />
                <el-dropdown trigger="click" @command="insertSubjectVar">
                  <el-button type="default" size="default">
                    插入变量
                    <ChevronDown :size="14" style="margin-left: 4px" />
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="v in variables"
                        :key="v.key"
                        :command="v.key"
                      >
                        {{ v.label }} ({{ v.key }})
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>

          <div class="editor-main">
            <span class="field-label body-label">邮件正文 (支持 HTML / Web 格式化排版):</span>
            <RichEditor v-model="templateForm.htmlContent" />
          </div>

          <div class="composer-footer">
            <div class="footer-left">
              <el-button @click="openTestMailDialog">
                <Send :size="14" style="margin-right: 4px" />
                测试邮件
              </el-button>
            </div>

            <div class="footer-right">
              <el-button type="primary" :loading="isSaving" @click="handleSaveTemplate">
                <Save :size="14" style="margin-right: 4px" />
                保存模板更改
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：真实邮件模拟预览 -->
      <div class="preview-column">
        <div class="panel-card preview-card-wrapper">
          <div class="preview-toolbar">
            <span class="toolbar-title">邮件真实效果渲染</span>
            <div class="sample-select-box">
              <span class="sample-label">切换预览对象:</span>
              <el-select
                v-model="selectedRecipientId"
                placeholder="选择收件人"
                size="small"
                style="width: 160px"
              >
                <el-option
                  v-for="m in store.mappings"
                  :key="m.id"
                  :label="`${m.recipientName} (${m.recipientEmail})`"
                  :value="m.id"
                />
              </el-select>
            </div>
          </div>

          <div class="preview-container">
            <MailPreview
              :template="templateForm"
              :selected-recipient="currentSelectedRecipient"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 发送测试邮件弹窗 -->
    <el-dialog v-model="testMailDialogVisible" title="发送单封测试邮件" width="460px">
      <div class="test-mail-content">
        <div class="dialog-hint">
          系统将使用当前配置的发件邮箱，将本模板（以张三为例）渲染后发送至您指定的测试邮箱，供您亲自查验排版。
        </div>
        <el-input
          v-model="testEmailAddress"
          placeholder="请输入接收测试邮件的邮箱..."
          clearable
        />
      </div>
      <template #footer>
        <el-button @click="testMailDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="isSendingTest"
          :disabled="!testEmailAddress"
          @click="handleSendTestMail"
        >
          立即发送测试
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ChevronDown, Save, Send } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/useAppStore'
import RichEditor from '../components/RichEditor.vue'
import MailPreview from '../components/MailPreview.vue'
import { TEMPLATE_VARIABLES } from '@shared/constants'
import type { MailTemplate, RecipientMapping } from '@shared/types'

const store = useAppStore()
const variables = TEMPLATE_VARIABLES

const templateForm = reactive<MailTemplate>({
  id: store.template.id,
  name: store.template.name,
  subject: store.template.subject,
  htmlContent: store.template.htmlContent,
  textContent: store.template.textContent,
  updatedAt: store.template.updatedAt
})

watch(
  () => store.template,
  (val) => {
    templateForm.id = val.id
    templateForm.name = val.name
    templateForm.subject = val.subject
    templateForm.htmlContent = val.htmlContent
    templateForm.textContent = val.textContent
    templateForm.updatedAt = val.updatedAt
  },
  { deep: true }
)

const selectedRecipientId = ref<string>('')
const isSaving = ref(false)

const testMailDialogVisible = ref(false)
const testEmailAddress = ref('')
const isSendingTest = ref(false)

const currentSelectedRecipient = computed<RecipientMapping | null>(() => {
  if (!selectedRecipientId.value) {
    return store.mappings.length > 0 ? store.mappings[0] : null
  }
  return store.mappings.find((m) => m.id === selectedRecipientId.value) || null
})

function insertSubjectVar(variableKey: string) {
  templateForm.subject += variableKey
}

async function handleSaveTemplate() {
  isSaving.value = true
  try {
    const res = await window.electronAPI.saveTemplate({ ...templateForm })
    if (!res.success) throw new Error(res.error)
    await store.fetchTemplate()
    ElMessage.success('邮件模板已保存')
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    isSaving.value = false
  }
}

function openTestMailDialog() {
  testEmailAddress.value = store.smtpConfig.fromAddress || ''
  testMailDialogVisible.value = true
}

async function handleSendTestMail() {
  if (!testEmailAddress.value) return
  isSendingTest.value = true
  try {
    // 先暂存模板以防未保存
    await window.electronAPI.saveTemplate({ ...templateForm })
    const res = await window.electronAPI.sendTestMail(testEmailAddress.value)
    if (!res.success) throw new Error(res.error)
    ElMessage.success(res.data?.message || '测试邮件已发出，请前往收件箱查验！')
    testMailDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err?.message || '测试邮件发送异常')
  } finally {
    isSendingTest.value = false
  }
}
</script>

<style scoped>
.composer-view {
  height: calc(100vh - 112px);
}

.composer-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  height: 100%;
}

.editor-column,
.preview-column {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.composer-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  margin-bottom: 0;
}

.composer-top-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-label {
  width: 70px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.body-label {
  width: auto;
  margin-bottom: 8px;
  display: block;
}

.subject-input-box {
  display: flex;
  gap: 8px;
  width: 100%;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.preview-card-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px 18px;
  margin-bottom: 0;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.sample-select-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sample-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-container {
  flex: 1;
  min-height: 0;
}

.test-mail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-hint {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
