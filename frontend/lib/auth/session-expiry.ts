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

export function clearAuthNavigationUiArtifacts(): void {
  if (typeof document === 'undefined') return

  const body = document.body
  const root = document.documentElement

  body.style.removeProperty('pointer-events')
  body.style.removeProperty('overflow')
  body.style.removeProperty('padding-right')
  body.style.removeProperty('margin-right')
  body.style.removeProperty('--removed-body-scroll-bar-size')
  root.style.removeProperty('overflow')
  body.removeAttribute('data-scroll-locked')
  root.removeAttribute('data-scroll-locked')

  document.querySelectorAll<HTMLElement>('[data-radix-overlay="true"]').forEach((overlay) => {
    overlay.style.pointerEvents = 'none'
    overlay.style.display = 'none'
    overlay.setAttribute('aria-hidden', 'true')
    overlay.setAttribute('data-csaas-orphaned-overlay', 'true')
  })

  document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]').forEach((dialog) => {
    dialog.style.pointerEvents = 'none'
    dialog.style.display = 'none'
    dialog.setAttribute('aria-hidden', 'true')
    dialog.setAttribute('data-csaas-orphaned-dialog', 'true')
  })
}

export function notifyAuthSessionExpired(callbackUrl: string = getCurrentAuthCallbackUrl()): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, {
      detail: { callbackUrl },
    })
  )
}
