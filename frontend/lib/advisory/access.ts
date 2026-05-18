import { UserRole } from '@/lib/auth/types'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const THINKTANK_MODULE_KEY = 'thinktank'
export const THINKTANK_ACCESS_DENIED_MESSAGE = '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'
export const THINKTANK_MODULE_DISABLED_MESSAGE = 'ThinkTank 当前未在本租户启用，请联系管理员开通。'

const THINKTANK_ALLOWED_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.CONSULTANT,
  UserRole.CLIENT_PM,
  UserRole.RESPONDENT,
])

export interface ThinkTankAccessResult {
  allowed: boolean
  module: typeof THINKTANK_MODULE_KEY
  reason?: 'module_disabled' | 'role_not_allowed' | 'missing_role'
  message?: string
}

export function canAccessThinkTank(role?: UserRole | string | null): boolean {
  return typeof role === 'string' && THINKTANK_ALLOWED_ROLES.has(role)
}

export async function fetchThinkTankAccess(): Promise<ThinkTankAccessResult> {
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/access', {
    headers,
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (response.status === 403) {
    return {
      allowed: false,
      module: THINKTANK_MODULE_KEY,
      reason: readReason(body),
      message: readAdvisoryMessage(body) ?? THINKTANK_ACCESS_DENIED_MESSAGE,
    }
  }

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? '暂时无法验证 ThinkTank 访问权限，请稍后重试。')
  }

  const data = unwrapAdvisoryEnvelope<Partial<ThinkTankAccessResult>>(body)

  return {
    allowed: data?.allowed === true,
    module: data?.module === THINKTANK_MODULE_KEY ? THINKTANK_MODULE_KEY : THINKTANK_MODULE_KEY,
  }
}

function readReason(body: unknown): ThinkTankAccessResult['reason'] | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as { reason?: unknown; data?: unknown; error?: { reason?: unknown } }
  const reason = record.reason
  if (reason === 'module_disabled' || reason === 'role_not_allowed' || reason === 'missing_role') {
    return reason
  }
  if (record.data) return readReason(record.data)
  return undefined
}
