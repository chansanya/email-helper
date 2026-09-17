export type SmtpSecurity = 'SSL_TLS' | 'STARTTLS' | 'NONE'

export interface SmtpConfig {
  name: string
  host: string
  port: number
  security: SmtpSecurity
  username: string
  password?: string
  hasPassword?: boolean
  fromName: string
  fromAddress: string
  replyTo?: string
  timeoutSeconds: number
}

export interface RecipientMapping {
  id: string
  recipientEmail: string
  recipientName: string
  attachmentPath: string
  enabled: boolean
  remark?: string
  createdAt: string
  updatedAt: string
  fileStatus?: 'OK' | 'MISSING' | 'INVALID_PATH'
  emailStatus?: 'VALID' | 'INVALID'
  fileSize?: number
  formattedFileSize?: string
}

export interface MailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  updatedAt: string
}

export interface AppSettings {
  concurrency: number
  sendIntervalMs: number
  maxRetryAttempts: number
  retryDelaySeconds: number
  attachmentFolder: string
}

export type SendJobStatus =
  | 'DRAFT'
  | 'RUNNING'
  | 'PAUSED'
  | 'BLOCKED_CONFIG'
  | 'INTERRUPTED'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'CANCELLED'

export type SendItemStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RETRY_WAIT'
  | 'SMTP_ACCEPTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN'

export interface SendItem {
  id: string
  recipientEmail: string
  recipientName: string
  attachmentPath: string
  attachmentName: string
  attachmentSize: number
  status: SendItemStatus
  attemptCount: number
  smtpMessageId?: string
  smtpResponse?: string
  acceptedAt?: string
  errorCategory?: string
  errorMessage?: string
  lastAttemptAt?: string
}

export interface SendAttempt {
  itemId: string
  jobId: string
  attemptNumber: number
  startedAt: string
  finishedAt: string
  status: 'SMTP_ACCEPTED' | 'FAILED'
  smtpResponse?: string
  errorCategory?: string
  errorMessage?: string
}

export interface SendJob {
  id: string
  name: string
  status: SendJobStatus
  subject: string
  htmlContent: string
  textContent: string
  concurrency: number
  sendIntervalMs: number
  totalCount: number
  acceptedCount: number
  failedCount: number
  pendingCount: number
  unknownCount: number
  cancelledCount: number
  items: SendItem[]
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface SendJobSummary {
  id: string
  name: string
  status: SendJobStatus
  totalCount: number
  acceptedCount: number
  failedCount: number
  pendingCount: number
  unknownCount: number
  cancelledCount: number
  createdAt: string
  finishedAt?: string
}

export interface PreflightIssue {
  type: 'ERROR' | 'WARNING'
  recipientEmail?: string
  message: string
}

export interface PreflightResult {
  readyToStart: boolean
  totalCandidates: number
  validCount: number
  invalidEmailCount: number
  missingFileCount: number
  disabledCount: number
  totalAttachmentBytes: number
  formattedTotalAttachmentSize: string
  smtpStatus: { ok: boolean; message: string }
  estimatedTimeSeconds: number
  issues: PreflightIssue[]
}

export interface FileScanItem {
  relativePath: string
  name: string
  size: number
  formattedSize: string
  updatedAt: string
  isDirectory: boolean
}

export interface ImportOptions {
  filePath: string
  strategy: 'SKIP_EXISTING' | 'OVERWRITE_EXISTING'
}

export interface ImportResult {
  importedCount: number
  skippedCount: number
  overwrittenCount: number
  errorCount: number
  errors: Array<{ row: number; email?: string; reason: string }>
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ProgressPayload {
  jobId: string
  status: SendJobStatus
  totalCount: number
  acceptedCount: number
  failedCount: number
  pendingCount: number
  unknownCount: number
  cancelledCount: number
  currentItemId?: string
  currentEmail?: string
}

export interface ElectronAPI {
  // SMTP
  getSmtpConfig: () => Promise<ApiResponse<SmtpConfig>>
  saveSmtpConfig: (config: SmtpConfig) => Promise<ApiResponse<boolean>>
  testSmtpConnection: (config?: SmtpConfig) => Promise<ApiResponse<{ ok: boolean; message: string }>>

  // Settings
  getSettings: () => Promise<ApiResponse<AppSettings>>
  saveSettings: (settings: Partial<AppSettings>) => Promise<ApiResponse<boolean>>

  // Mappings
  listMappings: () => Promise<ApiResponse<RecipientMapping[]>>
  createMapping: (mapping: Omit<RecipientMapping, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ApiResponse<RecipientMapping>>
  updateMapping: (id: string, mapping: Partial<RecipientMapping>) => Promise<ApiResponse<RecipientMapping>>
  deleteMappings: (ids: string[]) => Promise<ApiResponse<boolean>>
  importMappings: (options: ImportOptions) => Promise<ApiResponse<ImportResult>>
  exportMappings: () => Promise<ApiResponse<{ defaultPath: string }>>
  validateAllMappings: () => Promise<ApiResponse<RecipientMapping[]>>

  // Files
  scanAttachmentFiles: () => Promise<ApiResponse<FileScanItem[]>>
  openAttachmentFolder: () => Promise<ApiResponse<boolean>>
  getAttachmentFolderPath: () => Promise<ApiResponse<string>>
  exportTemplateFile: () => Promise<ApiResponse<string>>

  // Templates
  getTemplate: () => Promise<ApiResponse<MailTemplate>>
  saveTemplate: (template: Partial<MailTemplate>) => Promise<ApiResponse<boolean>>
  previewMail: (data: { template: MailTemplate; recipient: RecipientMapping }) => Promise<ApiResponse<{ subject: string; html: string; text: string }>>
  sendTestMail: (targetEmail: string) => Promise<ApiResponse<{ ok: boolean; message: string }>>

  // Send Jobs
  preflightCheck: () => Promise<ApiResponse<PreflightResult>>
  startSendJob: (params?: { jobName?: string }) => Promise<ApiResponse<SendJob>>
  pauseSendJob: (jobId: string) => Promise<ApiResponse<boolean>>
  resumeSendJob: (jobId: string) => Promise<ApiResponse<boolean>>
  cancelSendJob: (jobId: string) => Promise<ApiResponse<boolean>>
  retryFailedItems: (jobId: string) => Promise<ApiResponse<SendJob>>
  getActiveJob: () => Promise<ApiResponse<SendJob | null>>
  getJobDetail: (jobId: string) => Promise<ApiResponse<{ job: SendJob; attempts: SendAttempt[] }>>
  listHistoryJobs: () => Promise<ApiResponse<SendJobSummary[]>>
  deleteHistoryJob: (jobId: string) => Promise<ApiResponse<boolean>>
  exportJobReport: (jobId: string) => Promise<ApiResponse<string>>

  // Dialogs
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<ApiResponse<string | null>>

  // Window Controls
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<void>
  isWindowMaximized: () => Promise<boolean>

  // Events
  onJobProgress: (callback: (payload: ProgressPayload) => void) => () => void
}
