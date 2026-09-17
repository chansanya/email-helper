<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo-box">
        <Send class="logo-icon" :size="20" />
      </div>
      <div class="brand-text">
        <div class="brand-title">邮箱助手</div>
        <div class="brand-sub">精准批量邮件工具</div>
      </div>
    </div>

    <nav class="nav-menu">
      <button
        v-for="item in navItems"
        :key="item.id"
        :class="['nav-item', { active: store.currentView === item.id }]"
        @click="store.currentView = item.id as any"
      >
        <component :is="item.icon" class="nav-icon" :size="18" />
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.badge && item.badge > 0" class="nav-badge">{{ item.badge }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="status-card">
        <div class="status-row">
          <span class="dot" :class="{ active: store.isSmtpVerified }"></span>
          <span class="status-label">{{ store.isSmtpVerified ? '发件邮箱就绪' : '发件箱未配置' }}</span>
        </div>
        <div class="status-meta" :title="store.smtpConfig.fromAddress || '暂无发件地址'">
          {{ store.smtpConfig.fromAddress || '前往设置完善配置' }}
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  LayoutDashboard,
  Users,
  Mail,
  Send,
  History,
  Settings
} from 'lucide-vue-next'
import { useAppStore } from '../stores/useAppStore'

const store = useAppStore()

const navItems = computed(() => [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'mapping', label: '收件映射', icon: Users, badge: store.mappings.length },
  { id: 'composer', label: '邮件编辑', icon: Mail },
  {
    id: 'tasks',
    label: '发送任务',
    icon: Send,
    badge: store.activeJob?.status === 'RUNNING' ? store.activeJob.pendingCount : undefined
  },
  { id: 'history', label: '发送历史', icon: History },
  { id: 'settings', label: '系统设置', icon: Settings }
])
</script>

<style scoped>
.sidebar {
  width: 240px;
  background-color: var(--bg-sidebar);
  color: #E2E8F0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo-box {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 15px;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: -0.01em;
}

.brand-sub {
  font-size: 11px;
  color: #94A3B8;
}

.nav-menu {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.nav-item:hover {
  background-color: var(--bg-sidebar-hover);
  color: #FFFFFF;
}

.nav-item.active {
  background-color: var(--primary-color);
  color: #FFFFFF;
  font-weight: 600;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  background-color: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 600;
}

.sidebar-footer {
  padding: 16px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.status-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #E2E8F0;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #EF4444;
}

.dot.active {
  background-color: #10B981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.status-meta {
  font-size: 11px;
  color: #94A3B8;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
