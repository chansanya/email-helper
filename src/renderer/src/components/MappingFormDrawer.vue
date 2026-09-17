<template>
  <el-drawer
    v-model="visible"
    :title="isEdit ? '编辑名单与附件' : '手动新增收件人与附件'"
    size="500px"
    :destroy-on-close="true"
    append-to-body
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="drawer-form"
    >
      <el-form-item label="收件人" prop="recipientName">
        <el-input
          v-model="formData.recipientName"
          placeholder="例如：张三"
          size="default"
          clearable
        />
      </el-form-item>

      <el-form-item label="收件人邮箱" prop="recipientEmail">
        <el-input
          v-model="formData.recipientEmail"
          placeholder="例如：client@example.com"
          size="default"
          clearable
        />
      </el-form-item>

      <el-form-item label="专属附件" prop="attachmentPath">
        <div class="attach-input-box">
          <el-input
            v-model="formData.attachmentPath"
            placeholder="相对 mail-files 路径，如：contracts/张三合同.pdf"
            size="default"
            clearable
          />
          <el-button type="default" size="default" @click="openAttachmentPicker">
            <FolderOpen :size="15" style="margin-right: 4px" />
            浏览选择
          </el-button>
        </div>
        <div class="field-hint">
          文件存放在程序运行目录的 <code>mail-files</code> 文件夹中。
        </div>
      </el-form-item>

      <el-form-item label="备注说明 (仅在本地名单中查看，不会发给收件人)" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="例如：第一批次重点客户、业务确认单等"
        />
      </el-form-item>

      <el-form-item label="是否加入本次发信名单">
        <el-switch v-model="formData.enabled" active-text="启用此条收件人记录" size="default" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="isSaving" @click="handleSubmit">
          保存收件人
        </el-button>
      </div>
    </template>

    <AttachmentPickerModal
      ref="attachmentPickerRef"
      @select="handleAttachmentSelected"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { FolderOpen } from 'lucide-vue-next'
import { ElMessage, type FormInstance } from 'element-plus'
import AttachmentPickerModal from './AttachmentPickerModal.vue'
import type { RecipientMapping } from '@shared/types'

const visible = ref(false)
const isEdit = ref(false)
const isSaving = ref(false)
const editId = ref<string | null>(null)
const formRef = ref<FormInstance | null>(null)
const attachmentPickerRef = ref<InstanceType<typeof AttachmentPickerModal> | null>(null)

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const formData = reactive({
  recipientEmail: '',
  recipientName: '',
  attachmentPath: '',
  remark: '',
  enabled: true
})

const formRules = {
  recipientEmail: [
    { required: true, message: '请输入收件人邮箱', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      message: '邮箱地址格式不合法',
      trigger: 'blur'
    }
  ],
  attachmentPath: [
    { required: true, message: '请指定绑定的附件相对路径', trigger: 'blur' }
  ]
}

function openAdd() {
  isEdit.value = false
  editId.value = null
  formData.recipientEmail = ''
  formData.recipientName = ''
  formData.attachmentPath = ''
  formData.remark = ''
  formData.enabled = true
  visible.value = true
}

function openEdit(mapping: RecipientMapping) {
  isEdit.value = true
  editId.value = mapping.id
  formData.recipientEmail = mapping.recipientEmail
  formData.recipientName = mapping.recipientName
  formData.attachmentPath = mapping.attachmentPath
  formData.remark = mapping.remark || ''
  formData.enabled = mapping.enabled
  visible.value = true
}

function openAttachmentPicker() {
  attachmentPickerRef.value?.open(formData.attachmentPath)
}

function handleAttachmentSelected(path: string) {
  formData.attachmentPath = path
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    isSaving.value = true
    try {
      if (isEdit.value && editId.value) {
        const res = await window.electronAPI.updateMapping(editId.value, { ...formData })
        if (!res.success) throw new Error(res.error)
        ElMessage.success('已更新收件人记录')
      } else {
        const res = await window.electronAPI.createMapping({ ...formData })
        if (!res.success) throw new Error(res.error)
        ElMessage.success('已成功添加收件人')
      }
      visible.value = false
      emit('saved')
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败')
    } finally {
      isSaving.value = false
    }
  })
}

defineExpose({ openAdd, openEdit })
</script>

<style scoped>
.drawer-form {
  padding: 10px 6px;
}

.attach-input-box {
  display: flex;
  gap: 10px;
  width: 100%;
}

.field-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.5;
}

.field-hint code {
  background: #F1F5F9;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--primary-color);
  font-weight: 600;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 6px 4px;
}
</style>
