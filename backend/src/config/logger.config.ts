import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston'
import * as winston from 'winston'

/**
 * Winston日志配置
 * - 开发环境：彩色控制台输出
 * - 生产环境：JSON格式，分级别文件输出
 */
export const loggerConfig = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production'

  const transports: winston.transport[] = []

  if (isDevelopment) {
    // 开发环境：彩色控制台输出
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('Csaas', {
            colors: true,
            prettyPrint: true,
          }),
        ),
      }),
    )
  } else {
    // 生产环境：JSON格式输出
    transports.push(
      // 错误日志文件
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      }),

      // 所有日志文件
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      }),

      // 控制台输出（JSON格式，便于日志收集）
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    )
  }

  return WinstonModule.createLogger({
    transports,
    // 默认日志级别
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    // 异常处理
    exceptionHandlers: [
      new winston.transports.File({
        filename: 'logs/exceptions.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    ],
    // 未捕获的Promise rejection处理
    rejectionHandlers: [
      new winston.transports.File({
        filename: 'logs/rejections.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    ],
  })
}
