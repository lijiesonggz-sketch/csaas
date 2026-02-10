'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Box, Container, CircularProgress } from '@mui/material'
import { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

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
          ml: sidebarCollapsed ? 8 : 25, // 64px or 200px
          transition: (theme) =>
            theme.transitions.create('margin-left', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            p: 3,
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  )
}
