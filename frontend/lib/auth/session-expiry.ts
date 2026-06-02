export const AUTH_SESSION_EXPIRED_EVENT = 'csaas:auth-session-expired'

export interface AuthSessionExpiredDetail {
  callbackUrl?: string
}

export function isSafeInternalCallbackUrl(
  callbackUrl: string | null | undefined
): callbackUrl is string {
  return Boolean(
    callbackUrl &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith('//') &&
    !callbackUrl.startsWith('/login')
  )
}

export function getCurrentAuthCallbackUrl(): string {
  if (typeof window === 'undefined') return '/dashboard'

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function buildLoginUrl(callbackUrl: string | null | undefined): string {
  const safeCallbackUrl = isSafeInternalCallbackUrl(callbackUrl) ? callbackUrl : '/dashboard'
  return `/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`
}

export function notifyAuthSessionExpired(callbackUrl: string = getCurrentAuthCallbackUrl()): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, {
      detail: { callbackUrl },
    })
  )
}
