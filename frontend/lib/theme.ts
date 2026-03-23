import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#667eea', light: '#818cf8', dark: '#4f46e5' },
    secondary: { main: '#764ba2', light: '#a78bfa', dark: '#7c3aed' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
      disabled: '#94a3b8',
    },
    status: {
      success: '#10b981',
      'success-light': '#d1fae5',
      warning: '#f59e0b',
      'warning-light': '#fef3c7',
      error: '#ef4444',
      'error-light': '#fee2e2',
      info: '#3b82f6',
      'info-light': '#dbeafe',
      pending: '#6b7280',
      'pending-light': '#f3f4f6',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'var(--font-inter), "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shadows: [
    'none',
    '0 1px 3px rgba(0, 0, 0, 0.12)',
    '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05)', // card
    '0 4px 12px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.08)', // card-hover
    '0 4px 14px rgba(99, 102, 241, 0.4)', // purple
    '0 6px 20px rgba(102, 126, 234, 0.5)', // purple-lg
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '0 10px 25px -5px rgba(99, 102, 241, 0.3)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  ],
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
})
