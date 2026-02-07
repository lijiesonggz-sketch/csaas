'use client'

import { SessionProvider } from 'next-auth/react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrandProvider } from '@/components/layout/BrandProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandProvider>
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#667eea',
              borderRadius: 8,
            },
          }}
        >
          {children}
        </ConfigProvider>
      </BrandProvider>
    </SessionProvider>
  )
}
