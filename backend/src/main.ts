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
  })

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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port)

  const logger = app.get('Logger')
  logger.log(`🚀 Backend server running on http://localhost:${port}`)
  logger.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.log(`✅ Health check: http://localhost:${port}/health`)
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error)
  Sentry.captureException(error)
  process.exit(1)
})
