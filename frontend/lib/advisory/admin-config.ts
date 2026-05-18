import { UserRole } from '@/lib/auth/types'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_PRIVACY_CONFIRMATION = '确认 ThinkTank 对话历史不会用于模型训练。'
export const THINKTANK_AUDIT_DELAY_MESSAGE = '审计摘要可能存在短暂延迟。'

export interface AdvisoryModuleAuditSummary {
  eventName: string
  actorUserId: string | null
  changedSetting: string | null
  oldValue: unknown
  newValue: unknown
  occurredAt: string
}

export interface AdvisoryModuleConfig {
  id: string
  tenantId: string
  moduleKey: 'thinktank'
  enabled: boolean
  allowedRoles: UserRole[]
  dataRetentionDays: number
  privacyConfirmedAt: string | null
  privacyConfirmedBy: string | null
  latestAuditSummary: AdvisoryModuleAuditSummary[]
}

export interface UpdateAdvisoryModuleConfigInput {
  enabled: boolean
  allowedRoles: UserRole[]
  dataRetentionDays: number
  privacyConfirmed: boolean
}

export const THINKTANK_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '管理员',
  [UserRole.CONSULTANT]: '主咨询师',
  [UserRole.CLIENT_PM]: '企业PM',
  [UserRole.RESPONDENT]: '被调研者',
}

export const THINKTANK_ROLE_ORDER = [
  UserRole.ADMIN,
  UserRole.CONSULTANT,
  UserRole.CLIENT_PM,
  UserRole.RESPONDENT,
] as const

export async function fetchAdvisoryModuleConfig(): Promise<AdvisoryModuleConfig> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/admin/module-config', {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法加载 ThinkTank 配置，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<AdvisoryModuleConfig>(body)
  if (!data) throw new Error('暂时无法加载 ThinkTank 配置，请稍后重试。')
  return data
}

export async function updateAdvisoryModuleConfig(
  input: UpdateAdvisoryModuleConfigInput
): Promise<AdvisoryModuleConfig> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/admin/module-config', {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法保存 ThinkTank 配置，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<AdvisoryModuleConfig>(body)
  if (!data) throw new Error('暂时无法保存 ThinkTank 配置，请稍后重试。')
  return data
}
