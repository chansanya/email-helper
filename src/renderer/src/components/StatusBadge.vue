<template>
  <span :class="['status-badge', badgeClass]">
    <component :is="iconComponent" class="badge-icon" :size="14" />
    <span class="badge-text">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Ban,
  HelpCircle,
  Loader2,
  Play,
  Pause,
  ShieldAlert,
  CheckCheck,
  AlertTriangle
} from 'lucide-vue-next'

const props = defineProps<{
  status: string
}>()

const statusMeta = computed(() => {
  switch (props.status) {
    case 'SMTP_ACCEPTED':
      return { label: 'SMTP 已接收', cls: 'success', icon: CheckCircle }
    case 'FAILED':
      return { label: '发送失败', cls: 'danger', icon: AlertCircle }
    case 'IN_PROGRESS':
      return { label: '正在发送中', cls: 'primary', icon: Loader2 }
    case 'PENDING':
      return { label: '排队等待', cls: 'neutral', icon: Clock }
    case 'RETRY_WAIT':
      return { label: '等待重试', cls: 'warning', icon: RefreshCw }
    case 'CANCELLED':
      return { label: '已取消', cls: 'muted', icon: Ban }
    case 'UNKNOWN':
      return { label: '待核实确认', cls: 'warning', icon: HelpCircle }
    case 'RUNNING':
      return { label: '正在发送中', cls: 'primary', icon: Play }
    case 'PAUSED':
      return { label: '已暂停发送', cls: 'warning', icon: Pause }
    case 'BLOCKED_CONFIG':
      return { label: '邮箱配置受阻', cls: 'danger', icon: ShieldAlert }
    case 'COMPLETED':
      return { label: '全部发送完成', cls: 'success', icon: CheckCheck }
    case 'PARTIAL_SUCCESS':
      return { label: '部分发送成功', cls: 'warning', icon: AlertTriangle }
    case 'OK':
      return { label: '附件就绪', cls: 'success', icon: CheckCircle }
    case 'MISSING':
      return { label: '文件缺失', cls: 'danger', icon: AlertCircle }
    case 'VALID':
      return { label: '有效', cls: 'success', icon: CheckCircle }
    case 'INVALID':
      return { label: '格式非法', cls: 'danger', icon: AlertCircle }
    default:
      return { label: props.status || '未知状态', cls: 'neutral', icon: Clock }
  }
})

const label = computed(() => statusMeta.value.label)
const badgeClass = computed(() => statusMeta.value.cls)
const iconComponent = computed(() => statusMeta.value.icon)
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.badge-icon {
  flex-shrink: 0;
}

.success {
  background-color: var(--success-subtle);
  color: var(--success-color);
  border: 1px solid #A7F3D0;
}

.danger {
  background-color: var(--danger-subtle);
  color: var(--danger-color);
  border: 1px solid #FECACA;
}

.primary {
  background-color: var(--primary-subtle);
  color: var(--primary-color);
  border: 1px solid #BFDBFE;
}

.warning {
  background-color: var(--warning-subtle);
  color: var(--warning-color);
  border: 1px solid #FDE68A;
}

.neutral {
  background-color: #F1F5F9;
  color: #475569;
  border: 1px solid #E2E8F0;
}

.muted {
  background-color: #F8FAFC;
  color: #94A3B8;
  border: 1px solid #E2E8F0;
}
</style>
