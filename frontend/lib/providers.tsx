'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { BrandProvider } from '@/components/layout/BrandProvider'

/**
 * Radix UI Dialog 在 React StrictMode + Next.js App Router 下存在已知 bug：
 * route 切换后可能残留 body pointer-events:none，或残留全屏 overlay 节点。
 * 这个 hook 会在没有打开 dialog 时清理这些孤儿状态，避免页面被灰色遮罩盖住。
 */
function useRadixDialogCleanup() {
  useEffect(() => {
    const hasOpenDialog = () =>
      Boolean(document.querySelector('[role="dialog"][data-state="open"]'))

    const cleanupOrphanedDialogState = () => {
      if (hasOpenDialog()) {
        return
      }

      const body = document.body
      if (body.style.pointerEvents === 'none') {
        body.style.pointerEvents = ''
      }

      document
        .querySelectorAll<HTMLElement>('[data-radix-overlay="true"]')
        .forEach((overlay) => overlay.remove())
    }

    const observer = new MutationObserver(cleanupOrphanedDialogState)

    cleanupOrphanedDialogState()

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'data-state'],
    })

    return () => observer.disconnect()
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  useRadixDialogCleanup()

  return (
    <SessionProvider>
      <BrandProvider>{children}</BrandProvider>
    </SessionProvider>
  )
}
