import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable } from '@nestjs/common'
import { Request, Response } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AuditLogService } from '../../audit/audit-log.service'

type RequestUser = {
  id?: string
  userId?: string
}

type RequestWithAuditContext = Request & {
  tenantId?: string
  user?: RequestUser
}

@Catch(HttpException)
@Injectable()
export class CaseImportAuditFilter implements ExceptionFilter {
  constructor(private readonly auditLogService: AuditLogService) {}

  async catch(exception: HttpException, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<RequestWithAuditContext>()
    const response = ctx.getResponse<Response>()
    const status = exception.getStatus()
    const payload = exception.getResponse()

    await this.auditLogService.log({
      userId: request.user?.id || request.user?.userId,
      tenantId: request.tenantId,
      action: AuditAction.CREATE,
      entityType: 'ComplianceCaseImportJob',
      entityId: null,
      details: {
        statusCode: status,
        method: request.method,
        path: request.url,
        body: request.body,
        error: payload,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string | undefined,
    })

    if (typeof payload === 'string') {
      response.status(status).json({
        statusCode: status,
        message: payload,
      })
      return
    }

    response.status(status).json(payload)
  }
}
