import type { Metadata } from 'next'
import { Providers } from '@/lib/providers'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Csaas - AI驱动的IT咨询成熟度评估平台',
  description: '三模型协同架构的SaaS平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  )
}
