'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

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
        <div className="min-h-screen bg-[#FEFDFB] flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6">
            <Alert variant="destructive" className="border-[#FECACA] bg-[#FEF2F2]">
              <AlertCircle className="h-4 w-4 text-[#DC2626]" />
              <AlertTitle className="text-[#991B1B] font-semibold">
                组件加载失败
              </AlertTitle>
              {this.state.error && (
                <AlertDescription className="text-[#7F1D1D] mt-2">
                  错误信息: {this.state.error.message}
                </AlertDescription>
              )}
            </Alert>

            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-[#DC2626]" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-[#1E3A5F]">
                哎呀，出错了
              </h2>
              <p className="text-sm text-[#64748B]">
                页面加载时遇到了问题，请刷新页面重试
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新页面
              </Button>
            </div>
          </div>
        </div>
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
