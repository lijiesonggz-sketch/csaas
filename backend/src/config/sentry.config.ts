import * as Sentry from '@sentry/node'

/**
 * Sentry错误监控配置
 */
export const initSentry = () => {
  const sentryDsn = process.env.SENTRY_DSN

  if (!sentryDsn) {
    console.warn('⚠️ SENTRY_DSN not configured, error monitoring disabled')
    return
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',

    // 性能监控采样率
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // 集成配置（使用新版本API）
    integrations: [
      // HTTP请求追踪
      Sentry.httpIntegration(),
      // Express集成
      Sentry.expressIntegration(),
    ],

    // 错误过滤
    beforeSend(event, hint) {
      // 过滤掉某些不需要上报的错误
      const error = hint.originalException

      if (error instanceof Error) {
        // 不上报404错误
        if (error.message?.includes('404') || error.message?.includes('Not Found')) {
          return null
        }

        // 不上报401/403认证错误
        if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
          return null
        }
      }

      return event
    },

    // 附加上下文信息
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb
    },
  })

  console.log('✅ Sentry initialized successfully')
}

/**
 * 捕获Sentry错误
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  })
}

/**
 * 捕获Sentry消息
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level)
}

/**
 * 设置Sentry用户上下文
 */
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  Sentry.setUser(user)
}

/**
 * 清除Sentry用户上下文
 */
export const clearUser = () => {
  Sentry.setUser(null)
}
