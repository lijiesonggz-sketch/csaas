import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog, AuditAction } from '@/database/entities'

export interface AuditLogParams {
  userId: string
  projectId?: string
  action: AuditAction | string
  success: boolean
  errorMessage?: string
  req: any
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
        projectId: params.projectId,
        action: params.action as any,
        success: params.success,
        errorMessage: params.errorMessage,
        ipAddress: this.extractIp(params.req),
        userAgent: params.req.headers?.['user-agent'],
      })

      await this.auditLogRepo.save(auditLog)
      this.logger.log(
        `Audit log: ${params.userId} - ${params.action} - ${params.success ? 'SUCCESS' : 'FAILED'}`,
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
