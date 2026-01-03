import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { initSentry } from './config/sentry.config'
import { loggerConfig } from './config/logger.config'
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

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

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
