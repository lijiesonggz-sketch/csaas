import { NestFactory } from '@nestjs/core'
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { initSentry } from './config/sentry.config'
import { loggerConfig } from './config/logger.config'
import { validateJwtConfig } from './config/jwt.config'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { NotFoundFilter } from './common/filters/not-found.filter'
import * as Sentry from '@sentry/node'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

const bootstrapLogger = new Logger('Bootstrap')
const requestLogger = new Logger('Request')

async function bootstrap() {
  // 验证 JWT 配置（必须在应用启动前完成）
  validateJwtConfig()

  // 初始化Sentry错误监控
  initSentry()

  // 创建应用实例，使用Winston日志
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: loggerConfig(),
    bodyParser: true,
  })

  // 配置静态资源服务 (Story 6.3 - 文件上传)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  })

  // 增加请求体大小限制（解决矩阵数据传递问题）
  app.use(require('express').json({ limit: '50mb' }))
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }))

  // 添加请求日志中间件（改进版：包含 User-Agent 和 Referer）
  app.use((req, res, next) => {
    requestLogger.debug(
      `[REQUEST] ${req.method} ${req.url} ${JSON.stringify({
        query: req.query,
        headers: {
          authorization: req.headers.authorization ? 'Bearer ***' : undefined,
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          referer: req.headers['referer'],
        },
        ip: req.ip,
      })}`,
    )
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

  bootstrapLogger.log(`Backend server running on http://localhost:${port}`)
  bootstrapLogger.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  bootstrapLogger.log(`Health check: http://localhost:${port}/health`)
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error)
  Sentry.captureException(error)
  process.exit(1)
})
