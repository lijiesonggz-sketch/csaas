'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Header from './Header'
import Sidebar from './Sidebar'

export const SIDEBAR_WIDTH = 200
export const SIDEBAR_COLLAPSED_WIDTH = 64

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FEFDFB]">
        <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const currentSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <div className="flex min-h-screen bg-[#FEFDFB]">
      <Header />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
      />
      <main
        className="flex-1 mt-16 min-h-[calc(100vh-64px)] transition-all duration-200"
        style={{ marginLeft: `${currentSidebarWidth}px` }}
      >
        {children}
      </main>
    </div>
  )
}
