'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { BrandProvider } from '@/components/layout/BrandProvider'

/**
 * Radix UI Dialog 在 React StrictMode + Next.js App Router 下存在已知 bug：
 * Dialog 关闭后 pointer-events:none 残留在 <body> 上，导致页面无法交互。
 * 这个 hook 通过 MutationObserver 监听 body.style 变化，
 * 当检测到残留的 pointer-events:none 且没有打开的 dialog 时自动清除。
 */
function useRadixDialogCleanup() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const body = document.body
      if (body.style.pointerEvents === 'none') {
        const hasOpenDialog = document.querySelector(
          '[data-state="open"][role="dialog"], [data-radix-overlay][data-state="open"]',
        )
        if (!hasOpenDialog) {
          body.style.pointerEvents = ''
        }
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    })

    return () => observer.disconnect()
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  useRadixDialogCleanup()

  return (
    <SessionProvider>
      <BrandProvider>
        {children}
      </BrandProvider>
    </SessionProvider>
  )
}
