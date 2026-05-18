import { UserRole } from '@/lib/auth/types'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

export const THINKTANK_MODULE_KEY = 'thinktank'
export const THINKTANK_ACCESS_DENIED_MESSAGE =
  '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'

const THINKTANK_ALLOWED_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.CONSULTANT,
  UserRole.CLIENT_PM,
])

export interface ThinkTankAccessResult {
  allowed: boolean
  module: typeof THINKTANK_MODULE_KEY
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
      message: readMessage(body) ?? THINKTANK_ACCESS_DENIED_MESSAGE,
    }
  }

  if (!response.ok) {
    throw new Error(readMessage(body) ?? '暂时无法验证 ThinkTank 访问权限，请稍后重试。')
  }

  return {
    allowed: body?.data?.allowed === true,
    module: body?.data?.module === THINKTANK_MODULE_KEY ? THINKTANK_MODULE_KEY : THINKTANK_MODULE_KEY,
  }
}

function readMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const message = (body as { message?: unknown }).message
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message)) {
    const first = message.find((item) => typeof item === 'string' && item.trim())
    return first ?? null
  }
  return null
}
