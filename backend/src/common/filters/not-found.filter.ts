import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common'
import { Request, Response } from 'express'

/**
 * 404 Not Found 异常过滤器
 * 记录所有未找到的端点请求，帮助识别可疑请求来源
 */
@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()

    // 记录 404 请求的详细信息
    console.warn('[404 NOT FOUND]', {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      referer: request.headers['referer'],
      ip: request.ip,
    })

    // 返回标准的 404 响应
    response.status(404).json({
      statusCode: 404,
      message: 'Not Found',
      path: request.url,
    })
  }
}
