'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { BrandProvider } from '@/components/layout/BrandProvider'
import { theme } from './theme'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandProvider>
        <MuiThemeProvider theme={theme}>
          {children}
        </MuiThemeProvider>
      </BrandProvider>
    </SessionProvider>
  )
}
