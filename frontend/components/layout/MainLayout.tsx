'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import Header from './Header'
import Sidebar from './Sidebar'

export const SIDEBAR_WIDTH = 200
export const SIDEBAR_COLLAPSED_WIDTH = 64

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof window.matchMedia !== 'function') {
      setIsMobile(false)
      setMobileSidebarOpen(false)
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateLayoutMode = (event?: MediaQueryListEvent) => {
      const mobile = event?.matches ?? mediaQuery.matches
      setIsMobile(mobile)
      if (!mobile) {
        setMobileSidebarOpen(false)
      }
    }

    updateLayoutMode()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateLayoutMode)
      return () => mediaQuery.removeEventListener?.('change', updateLayoutMode)
    }

    mediaQuery.addListener?.(updateLayoutMode)
    return () => mediaQuery.removeListener?.(updateLayoutMode)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="应用会话加载状态"
        className="flex items-center justify-center h-screen bg-[#FEFDFB]"
      >
        <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
        <span className="sr-only">正在加载应用会话</span>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const handleSkipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  const currentSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH
  const mainMarginLeft = isMobile ? 0 : currentSidebarWidth

  return (
    <div className="flex min-h-screen bg-[#FEFDFB]">
      <a
        href="#main-content"
        onClick={handleSkipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[#1E3A5F] focus:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
      >
        跳到主内容
      </a>
      <Header
        showMenuButton={isMobile}
        onMenuToggle={() => setMobileSidebarOpen((current) => !current)}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onNavigateComplete={() => setMobileSidebarOpen(false)}
      />
      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏遮罩"
          className="fixed inset-0 top-16 z-30 cursor-pointer bg-slate-950/30"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mt-16 min-h-[calc(100vh-64px)] w-full min-w-0 flex-1 overflow-x-hidden transition-all duration-200"
        style={{ marginLeft: `${mainMarginLeft}px` }}
      >
        {children}
      </main>
    </div>
  )
}
