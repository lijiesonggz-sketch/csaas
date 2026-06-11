'use client'

import { useEffect, useRef } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { BrandProvider } from '@/components/layout/BrandProvider'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  AuthSessionExpiredDetail,
  buildLoginUrl,
  clearAuthNavigationUiArtifacts,
  getCurrentAuthCallbackUrl,
} from '@/lib/auth/session-expiry'
import { AUTH_IDLE_TIMEOUT_MS } from '@/lib/auth/session-policy'
import { clearTokenCache } from '@/lib/utils/api'

/**
 * Radix UI Dialog 在 React StrictMode + Next.js App Router 下存在已知 bug：
 * route 切换后可能残留 body pointer-events:none，或残留全屏 overlay 节点。
 * 这个 hook 会在没有打开 dialog 时清理这些孤儿状态，避免页面被灰色遮罩盖住。
 * 不直接 remove overlay 节点，因为这些节点可能仍由 React/Radix 持有；
 * 外部删除会导致 React 卸载时触发 removeChild NotFoundError。
 */
function useRadixDialogCleanup() {
  useEffect(() => {
    const hasOpenDialog = () =>
      Boolean(document.querySelector('[role="dialog"][data-state="open"]'))

    const cleanupOrphanedScrollLock = () => {
      const body = document.body
      const root = document.documentElement
      const hasScrollLockMarker =
        body.hasAttribute('data-scroll-locked') || root.hasAttribute('data-scroll-locked')
      const hasBodyScrollLock = body.style.overflow === 'hidden' || body.style.overflow === 'clip'
      const hasRootScrollLock = root.style.overflow === 'hidden' || root.style.overflow === 'clip'

      if (hasBodyScrollLock) {
        body.style.removeProperty('overflow')
      }
      if (hasRootScrollLock) {
        root.style.removeProperty('overflow')
      }
      if (hasScrollLockMarker) {
        body.removeAttribute('data-scroll-locked')
        root.removeAttribute('data-scroll-locked')
        body.style.removeProperty('padding-right')
        body.style.removeProperty('margin-right')
        body.style.removeProperty('--removed-body-scroll-bar-size')
      }
    }

    const cleanupOrphanedDialogState = () => {
      if (hasOpenDialog()) {
        return
      }

      const body = document.body
      if (body.style.pointerEvents === 'none') {
        body.style.removeProperty('pointer-events')
      }
      cleanupOrphanedScrollLock()

      document.querySelectorAll<HTMLElement>('[data-radix-overlay="true"]').forEach((overlay) => {
        if (overlay.getAttribute('data-csaas-orphaned-overlay') === 'true') {
          return
        }

        overlay.style.pointerEvents = 'none'
        overlay.style.display = 'none'
        overlay.setAttribute('data-csaas-orphaned-overlay', 'true')
      })
    }

    const observer = new MutationObserver(cleanupOrphanedDialogState)

    cleanupOrphanedDialogState()

    const observerOptions: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'data-state', 'data-scroll-locked'],
    }

    observer.observe(document.body, observerOptions)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-scroll-locked'],
    })

    return () => observer.disconnect()
  }, [])
}

function useAuthSessionExpiryRedirect() {
  const signingOutRef = useRef(false)

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      if (signingOutRef.current) return

      signingOutRef.current = true
      const detail =
        event instanceof CustomEvent
          ? (event.detail as AuthSessionExpiredDetail | undefined)
          : undefined
      const callbackUrl = detail?.callbackUrl ?? getCurrentAuthCallbackUrl()

      clearTokenCache()
      clearAuthNavigationUiArtifacts()
      void signOut({ callbackUrl: buildLoginUrl(callbackUrl) })
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])
}

function useAuthIdleTimeout() {
  const { status } = useSession()
  const signingOutRef = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated') {
      signingOutRef.current = false
      return
    }

    let timeoutId: number | null = null

    const expireIdleSession = () => {
      if (signingOutRef.current) return

      signingOutRef.current = true
      clearTokenCache()
      clearAuthNavigationUiArtifacts()
      void signOut({ callbackUrl: buildLoginUrl(getCurrentAuthCallbackUrl()) })
    }

    const resetIdleTimer = () => {
      if (signingOutRef.current) return
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(expireIdleSession, AUTH_IDLE_TIMEOUT_MS)
    }

    const resetWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        resetIdleTimer()
      }
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'click',
      'keydown',
      'mousemove',
      'mousedown',
      'touchstart',
      'scroll',
      'wheel',
    ]

    resetIdleTimer()
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true })
    })
    document.addEventListener('visibilitychange', resetWhenVisible)

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer)
      })
      document.removeEventListener('visibilitychange', resetWhenVisible)
    }
  }, [status])
}

function AuthRuntime({ children }: { children: React.ReactNode }) {
  useRadixDialogCleanup()
  useAuthSessionExpiryRedirect()
  useAuthIdleTimeout()

  return <BrandProvider>{children}</BrandProvider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={5 * 60} refetchWhenOffline={false}>
      <AuthRuntime>{children}</AuthRuntime>
    </SessionProvider>
  )
}
