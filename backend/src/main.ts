import { NestFactory } from '@nestjs/core'
import { ValidationPipe, BadRequestException } from '@nestjs/common'
import { AppModule } from './app.module'
import { initSentry } from './config/sentry.config'
import { loggerConfig } from './config/logger.config'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { NotFoundFilter } from './common/filters/not-found.filter'
import * as Sentry from '@sentry/node'

async function bootstrap() {
  // 初始化Sentry错误监控
  initSentry()

  // 创建应用实例，使用Winston日志
  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig(),
    bodyParser: true,
  })

  // 增加请求体大小限制（解决矩阵数据传递问题）
  app.use(require('express').json({ limit: '50mb' }))
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }))

  // 添加请求日志中间件（改进版：包含 User-Agent 和 Referer）
  app.use((req, res, next) => {
    console.log('[REQUEST]', req.method, req.url, {
      query: req.query,
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        referer: req.headers['referer'],
      },
      ip: req.ip,
    })
    next()
  })

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        console.error('[ValidationPipe] Validation errors:', JSON.stringify(errors, null, 2))
        return new BadRequestException(errors)
      },
    }),
  )

  // 全局响应转换拦截器
  app.useGlobalInterceptors(new TransformInterceptor())

  // 全局 404 异常过滤器
  app.useGlobalFilters(new NotFoundFilter())

  // CORS配置
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'http://localhost:3001',
    ].filter(Boolean),
    credentials: true,
  })

  const port = process.env.PORT || 3000
  await app.listen(port)

  console.log(`🚀 Backend server running on http://localhost:${port}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`✅ Health check: http://localhost:${port}/health`)
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error)
  Sentry.captureException(error)
  process.exit(1)
})
