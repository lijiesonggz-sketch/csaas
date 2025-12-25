'use client'

import { SessionProvider } from 'next-auth/react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
    </SessionProvider>
  )
}
