import { UserRole } from '@/lib/auth/types'
import { AUTH_SESSION_EXPIRED_EVENT } from '@/lib/auth/session-expiry'
import { canAccessThinkTank, fetchThinkTankAccess } from './access'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

describe('advisory access client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('unwraps backend global and ThinkTank data envelopes', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          data: {
            allowed: true,
            module: 'thinktank',
          },
        },
      }),
    })

    await expect(fetchThinkTankAccess()).resolves.toEqual({
      allowed: true,
      module: 'thinktank',
    })
  })

  it('treats every CSAAS role as a backend-check candidate', () => {
    expect(canAccessThinkTank(UserRole.ADMIN)).toBe(true)
    expect(canAccessThinkTank(UserRole.CONSULTANT)).toBe(true)
    expect(canAccessThinkTank(UserRole.CLIENT_PM)).toBe(true)
    expect(canAccessThinkTank(UserRole.RESPONDENT)).toBe(true)
    expect(canAccessThinkTank('external_viewer')).toBe(false)
  })

  it('notifies the app to sign out when access validation returns 401', async () => {
    const expiredEvents: CustomEvent[] = []
    const handleExpired = (event: Event) => expiredEvents.push(event as CustomEvent)
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpired)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    })

    await expect(fetchThinkTankAccess()).rejects.toThrow('登录状态已过期，请重新登录。')
    expect(expiredEvents).toHaveLength(1)

    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpired)
  })
})
