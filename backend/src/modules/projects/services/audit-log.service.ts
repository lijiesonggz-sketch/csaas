import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog, AuditAction } from '@/database/entities'

export interface AuditLogParams {
  userId: string
  organizationId?: string
  projectId?: string
  action: AuditAction | string
  entityType?: string
  entityId?: string
  changes?: Record<string, any>
  details?: Record<string, any>
  success?: boolean
  errorMessage?: string
  req?: any
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        userId: params.userId,
        organizationId: params.organizationId,
        projectId: params.projectId,
        action: params.action as any,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes,
        details: params.details,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        ipAddress: params.req ? this.extractIp(params.req) : undefined,
        userAgent: params.req?.headers?.['user-agent'],
        req: params.req ? {
          method: params.req.method,
          url: params.req.url,
          params: params.req.params,
          query: params.req.query,
        } : undefined,
      })

      await this.auditLogRepo.save(auditLog)
      this.logger.log(
        `Audit log: ${params.userId} - ${params.action} - ${params.success ?? true ? 'SUCCESS' : 'FAILED'}`,
      )
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`)
    }
  }

  async queryProjectAccess(projectId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: 100,
    })
  }

  private extractIp(req: any): string {
    return (
      req.headers?.['x-forwarded-for']?.split(',')[0] ||
      req.headers?.['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip
    )
  }
}
