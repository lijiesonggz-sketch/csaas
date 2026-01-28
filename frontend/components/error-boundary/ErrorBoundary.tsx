'use client'

import React from 'react'
import { Box, Container, Typography, Button, Alert } from '@mui/material'
import { ErrorOutline } from '@mui/icons-material'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs errors, and displays a fallback UI.
 *
 * Usage: Wrap components that might throw errors during rendering
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              组件加载失败
            </Typography>
            {this.state.error && (
              <Typography variant="body2" color="text.secondary">
                错误信息: {this.state.error.message}
              </Typography>
            )}
          </Alert>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <ErrorOutline sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              哎呀，出错了
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              页面加载时遇到了问题，请刷新页面重试
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              color="primary"
            >
              刷新页面
            </Button>
          </Box>
        </Container>
      )
    }

    return this.props.children
  }
}

/**
 * withErrorBoundary HOC
 *
 * Higher-order component that wraps a component with ErrorBoundary
 *
 * @param Component - Component to wrap
 * @returns Wrapped component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode,
): React.ComponentType<P & { fallback?: React.ReactNode }> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
