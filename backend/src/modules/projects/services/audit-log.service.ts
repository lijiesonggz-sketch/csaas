import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog, AuditAction } from '@/database/entities'

export interface AuditLogParams {
  userId: string
  organizationId?: string
  action: AuditAction | string
  entityType?: string
  entityId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  // Deprecated properties - will be stored in details
  success?: boolean
  req?: any
  changes?: Record<string, any>
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
      // Merge deprecated properties into details
      const details = {
        ...params.details,
        ...(params.success !== undefined && { success: params.success }),
        ...(params.changes && { changes: params.changes }),
        ...(params.req && {
          request: {
            method: params.req.method,
            url: params.req.url,
            params: params.req.params,
            query: params.req.query,
          },
        }),
      }

      const auditLog = this.auditLogRepo.create({
        userId: params.userId,
        organizationId: params.organizationId || null,
        action: params.action as any,
        entityType: params.entityType,
        entityId: params.entityId,
        details: Object.keys(details).length > 0 ? details : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      })

      await this.auditLogRepo.save(auditLog)
      this.logger.log(`Audit log: ${params.userId} - ${params.action}`)
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`)
    }
  }

  async queryByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: 100,
    })
  }
}
