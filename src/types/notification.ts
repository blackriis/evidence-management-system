export interface NotificationTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
}

export interface NotificationEvent {
  type: NotificationEventType
  userId: string
  data: Record<string, any>
  scheduledAt?: Date
  priority: NotificationPriority
}

export enum NotificationEventType {
  EVALUATION_DEADLINE_APPROACHING = 'evaluation_deadline_approaching',
  EVALUATION_OVERDUE = 'evaluation_overdue',
  EVIDENCE_UPLOADED = 'evidence_uploaded',
  EVALUATION_SUBMITTED = 'evaluation_submitted',
  ACADEMIC_YEAR_WINDOW_OPENED = 'academic_year_window_opened',
  ACADEMIC_YEAR_WINDOW_CLOSING = 'academic_year_window_closing',
  SCOPE_ASSIGNED = 'scope_assigned',
  BULK_IMPORT_COMPLETED = 'bulk_import_completed',
  SYSTEM_MAINTENANCE = 'system_maintenance'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationChannel {
  EMAIL = 'email',
  LINE = 'line',
  IN_APP = 'in_app'
}

export interface NotificationPreferences {
  userId: string
  emailEnabled: boolean
  lineEnabled: boolean
  inAppEnabled: boolean
  channels: {
    [key in NotificationEventType]?: NotificationChannel[]
  }
}

export interface NotificationJob {
  id: string
  eventType: NotificationEventType
  userId: string
  channels: NotificationChannel[]
  templateData: Record<string, any>
  scheduledAt: Date
  attempts: number
  maxAttempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface NotificationHistory {
  id: string
  userId: string
  eventType: NotificationEventType
  channel: NotificationChannel
  status: 'sent' | 'failed' | 'bounced'
  sentAt: Date
  error?: string
}