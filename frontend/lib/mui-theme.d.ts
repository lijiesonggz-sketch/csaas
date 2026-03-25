import '@mui/material/styles'

declare module '@mui/material/styles' {
  interface Palette {
    status: {
      success: string
      'success-light': string
      warning: string
      'warning-light': string
      error: string
      'error-light': string
      info: string
      'info-light': string
      pending: string
      'pending-light': string
    }
  }

  interface PaletteOptions {
    status?: {
      success: string
      'success-light': string
      warning: string
      'warning-light': string
      error: string
      'error-light': string
      info: string
      'info-light': string
      pending: string
      'pending-light': string
    }
  }
}
