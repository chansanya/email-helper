<template>
  <div class="dashboard-view">
    <!-- 顶部核心状态看板 -->
    <div class="stat-cards-grid">
      <div class="stat-card" @click="store.currentView = 'settings'">
        <div class="stat-top">
          <span class="stat-title">主发件邮箱</span>
          <Mail :size="18" class="card-icon" />
        </div>
        <div class="stat-main">
          <span :class="['stat-value', store.isSmtpVerified ? 'success' : 'warning']">
            {{ store.isSmtpVerified ? '就绪' : '待配置' }}
          </span>
        </div>
        <div class="stat-footer">
          {{ store.smtpConfig.username || '尚未设置 SMTP 账号' }}
        </div>
      </div>

      <div class="stat-card" @click="openFolder">
        <div class="stat-top">
          <span class="stat-title">附件存储目录</span>
          <FolderOpen :size="18" class="card-icon" />
        </div>
        <div class="stat-main">
          <span class="stat-value">{{ store.attachmentFiles.length }}</span>
          <span class="stat-unit">个文件</span>
        </div>
        <div class="stat-footer">
          存放于 mail-files 文件夹
        </div>
      </div>

      <div class="stat-card" @click="store.currentView = 'mapping'">
        <div class="stat-top">
          <span class="stat-title">收件映射关系</span>
          <Users :size="18" class="card-icon" />
        </div>
        <div class="stat-main">
          <span class="stat-value">{{ store.mappings.length }}</span>
          <span class="stat-unit">条配置</span>
        </div>
        <div class="stat-footer">
          已启用 {{ enabledMappingsCount }} 条 | 异常 {{ invalidMappingsCount }} 条
        </div>
      </div>

      <div class="stat-card" @click="store.currentView = 'tasks'">
        <div class="stat-top">
          <span class="stat-title">当前任务状态</span>
          <Send :size="18" class="card-icon" />
        </div>
        <div class="stat-main">
          <StatusBadge :status="store.activeJob?.status || 'IDLE'" />
        </div>
        <div class="stat-footer">
          <span v-if="store.activeJob">
            进度 {{ store.activeJob.acceptedCount }}/{{ store.activeJob.totalCount }}
          </span>
          <span v-else>暂无进行中的发信任务</span>
        </div>
      </div>
    </div>

    <!-- 流程导航与指引 -->
    <div class="panel-card workflow-card">
      <div class="panel-title">
        <Sparkles :size="18" class="title-icon" />
        <span>标准化操作指引</span>
      </div>
      <div class="panel-desc">
        本工具针对“一个主邮箱对多收件人、每人附带专属附件”的业务场景设计，遵循以下 5 步即可稳妥发送。
      </div>

      <div class="steps-flow">
        <div :class="['flow-step', { done: store.isSmtpVerified }]">
          <div class="step-badge">1</div>
          <div class="step-text">
            <div class="step-name">配置发件箱</div>
            <div class="step-summary">设置 SMTP 服务器与独立授权码</div>
          </div>
          <el-button link type="primary" size="small" @click="store.currentView = 'settings'">
            去配置
          </el-button>
        </div>

        <div class="flow-arrow">
          <ArrowRight :size="16" />
        </div>

        <div :class="['flow-step', { done: store.attachmentFiles.length > 0 }]">
          <div class="step-badge">2</div>
          <div class="step-text">
            <div class="step-name">放置附件</div>
            <div class="step-summary">将各收件人文件拷入 mail-files</div>
          </div>
          <el-button link type="primary" size="small" @click="openFolder">
            打开文件夹
          </el-button>
        </div>

        <div class="flow-arrow">
          <ArrowRight :size="16" />
        </div>

        <div :class="['flow-step', { done: store.mappings.length > 0 }]">
          <div class="step-badge">3</div>
          <div class="step-text">
            <div class="step-name">绑定映射</div>
            <div class="step-summary">手动添加或 Excel 导入“邮箱-文件”</div>
          </div>
          <el-button link type="primary" size="small" @click="store.currentView = 'mapping'">
            录入映射
          </el-button>
        </div>

        <div class="flow-arrow">
          <ArrowRight :size="16" />
        </div>

        <div :class="['flow-step', { done: !!store.template.subject }]">
          <div class="step-badge">4</div>
          <div class="step-text">
            <div class="step-name">编排正文</div>
            <div class="step-summary">富文本排版并插入个性化变量</div>
          </div>
          <el-button link type="primary" size="small" @click="store.currentView = 'composer'">
            编辑模板
          </el-button>
        </div>

        <div class="flow-arrow">
          <ArrowRight :size="16" />
        </div>

        <div class="flow-step highlight">
          <div class="step-badge launch">5</div>
          <div class="step-text">
            <div class="step-name">体检与发信</div>
            <div class="step-summary">预检文件完整性并启动多并发</div>
          </div>
          <el-button type="primary" size="small" @click="triggerPreflight">
            立即体检
          </el-button>
        </div>
      </div>
    </div>

    <!-- 快捷操作与最近概况 -->
    <div class="quick-grid">
      <div class="panel-card quick-card">
        <div class="panel-title">
          <Layers :size="16" />
          <span>核心设计亮点</span>
        </div>
        <ul class="feature-list">
          <li>
            <Check :size="14" class="check-icon" />
            <span><strong>一对一独立投递：</strong>每个人收到独立生成的邮件，杜绝群发抄送泄露隐私。</span>
          </li>
          <li>
            <Check :size="14" class="check-icon" />
            <span><strong>可配置并发连接池：</strong>基于 Nodemailer 连接池平滑发信，自带启动防抖与熔断保护。</span>
          </li>
          <li>
            <Check :size="14" class="check-icon" />
            <span><strong>绿色便携运行：</strong>优先使用运行目录同级 <code>mail-files</code> 与 <code>data</code>，无外部数据库依赖。</span>
          </li>
          <li>
            <Check :size="14" class="check-icon" />
            <span><strong>精准状态审计：</strong>记录每一封邮件的 SMTP messageId 与详细尝试记录，支持仅重试失败项。</span>
          </li>
        </ul>
      </div>

      <div class="panel-card launch-card">
        <div class="launch-inner">
          <div class="launch-info">
            <h3>准备好开始批量发信了吗？</h3>
            <p>点击下方按钮将自动执行全量预检（核验 SMTP 鉴权、映射格式与各附件物理存在性），无误后即可启动多线程任务。</p>
          </div>
          <button class="primary-launch-btn" @click="triggerPreflight">
            <Send :size="18" />
            <span>开始发信体检</span>
          </button>
        </div>
      </div>
    </div>

    <PreflightModal ref="preflightRef" @started="handleJobStarted" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Mail,
  FolderOpen,
  Users,
  Send,
  Sparkles,
  ArrowRight,
  Layers,
  Check
} from 'lucide-vue-next'
import { useAppStore } from '../stores/useAppStore'
import StatusBadge from '../components/StatusBadge.vue'
import PreflightModal from '../components/PreflightModal.vue'

const store = useAppStore()
const preflightRef = ref<InstanceType<typeof PreflightModal> | null>(null)

const enabledMappingsCount = computed(
  () => store.mappings.filter((m) => m.enabled).length
)

const invalidMappingsCount = computed(
  () => store.mappings.filter((m) => m.fileStatus === 'MISSING' || m.emailStatus === 'INVALID').length
)

async function openFolder() {
  await window.electronAPI.openAttachmentFolder()
  await store.fetchAttachmentFiles()
}

function triggerPreflight() {
  preflightRef.value?.open()
}

function handleJobStarted() {
  store.currentView = 'tasks'
}
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
}

.stat-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: #CBD5E1;
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-title {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.card-icon {
  color: var(--text-muted);
}

.stat-main {
  margin: 10px 0 6px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.stat-value.success {
  color: var(--success-color);
}

.stat-value.warning {
  color: var(--warning-color);
}

.stat-unit {
  font-size: 12px;
  color: var(--text-muted);
}

.stat-footer {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-card {
  margin-bottom: 20px;
}

.title-icon {
  color: var(--primary-color);
}

.steps-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 8px;
}

.flow-step {
  flex: 1;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.flow-step.done {
  border-color: #A7F3D0;
  background: #F0FDF4;
}

.flow-step.highlight {
  border-color: #BFDBFE;
  background: #EFF6FF;
}

.step-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #CBD5E1;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.flow-step.done .step-badge {
  background: var(--success-color);
}

.step-badge.launch {
  background: var(--primary-color);
}

.step-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-summary {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.flow-arrow {
  color: #CBD5E1;
  flex-shrink: 0;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.check-icon {
  color: var(--primary-color);
  flex-shrink: 0;
  margin-top: 3px;
}

.launch-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(145deg, #FFFFFF 0%, #F1F5F9 100%);
}

.launch-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.launch-info h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.launch-info p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.primary-launch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--primary-color);
  color: #FFFFFF;
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
  width: fit-content;
}

.primary-launch-btn:hover {
  background: var(--primary-hover);
  box-shadow: var(--shadow-md);
}
</style>
