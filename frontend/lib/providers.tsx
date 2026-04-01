'use client'

import { SessionProvider } from 'next-auth/react'
import { BrandProvider } from '@/components/layout/BrandProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandProvider>
        {children}
      </BrandProvider>
    </SessionProvider>
  )
}
