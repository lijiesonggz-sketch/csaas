'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Box, Container, CircularProgress } from '@mui/material'
import { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

// Sidebar width constants - must match Sidebar component
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!session) {
    return null
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: 8, // Header height (64px = 8 * 8px)
          minHeight: 'calc(100vh - 64px)',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
