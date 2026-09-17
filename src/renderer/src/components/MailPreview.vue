<template>
  <div class="mail-preview-card">
    <div class="preview-header">
      <div class="preview-meta-row">
        <span class="meta-label">发件人:</span>
        <span class="meta-value from">{{ fromText }}</span>
      </div>
      <div class="preview-meta-row">
        <span class="meta-label">收件人:</span>
        <span class="meta-value to">{{ toText }}</span>
      </div>
      <div class="preview-meta-row">
        <span class="meta-label">主　题:</span>
        <span class="meta-value subject">{{ renderedSubject }}</span>
      </div>
      <div class="preview-meta-row">
        <span class="meta-label">附　件:</span>
        <div class="attachment-pill">
          <Paperclip :size="14" />
          <span class="attach-name">{{ sampleAttachmentName }}</span>
          <span class="attach-tag">专属附件</span>
        </div>
      </div>
    </div>

    <div class="preview-body" v-html="renderedHtml"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Paperclip } from 'lucide-vue-next'
import { useAppStore } from '../stores/useAppStore'
import type { MailTemplate, RecipientMapping } from '@shared/types'

const props = defineProps<{
  template: MailTemplate
  selectedRecipient?: RecipientMapping | null
}>()

const store = useAppStore()

const currentRecipient = computed(() => {
  if (props.selectedRecipient) return props.selectedRecipient
  if (store.mappings.length > 0) return store.mappings[0]
  return {
    id: 'sample',
    recipientEmail: 'client@example.com',
    recipientName: '张三',
    attachmentPath: '业务确认单_张三.pdf',
    enabled: true,
    createdAt: '',
    updatedAt: ''
  }
})

const fromText = computed(() => {
  const fromName = store.smtpConfig.fromName || '发件人'
  const fromAddr = store.smtpConfig.fromAddress || 'sender@example.com'
  return `${fromName} <${fromAddr}>`
})

const toText = computed(() => {
  const r = currentRecipient.value
  return `${r.recipientName || '收件人'} <${r.recipientEmail}>`
})

const sampleAttachmentName = computed(() => {
  const p = currentRecipient.value.attachmentPath
  return p ? p.split(/[\\/]/).pop() || p : '专属附件.pdf'
})

function replaceVars(text: string) {
  if (!text) return ''
  const r = currentRecipient.value
  const today = new Date().toISOString().slice(0, 10)
  return text
    .replace(/\{\{\s*recipientName\s*\}\}/g, r.recipientName || '收件人')
    .replace(/\{\{\s*recipientEmail\s*\}\}/g, r.recipientEmail)
    .replace(/\{\{\s*attachmentName\s*\}\}/g, sampleAttachmentName.value)
    .replace(/\{\{\s*sendDate\s*\}\}/g, today)
}

const renderedSubject = computed(() => replaceVars(props.template.subject))
const renderedHtml = computed(() => replaceVars(props.template.htmlContent))
</script>

<style scoped>
.mail-preview-card {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.preview-header {
  background: #F8FAFC;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-meta-row {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.meta-label {
  width: 70px;
  color: var(--text-muted);
  font-weight: 600;
  flex-shrink: 0;
}

.meta-value {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-value.subject {
  font-size: 16px;
  font-weight: 700;
  color: #0F172A;
}

.attachment-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 13px;
  color: var(--primary-color);
}

.attach-name {
  font-weight: 600;
}

.attach-tag {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.preview-body {
  padding: 28px;
  flex: 1;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-primary);
  background: #FFFFFF;
}
</style>
