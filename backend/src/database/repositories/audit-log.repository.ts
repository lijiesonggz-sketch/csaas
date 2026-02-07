import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

/**
 * Audit Log Repository
 *
 * Provides data access methods for audit logs.
 *
 * @story 7-4
 * @module backend/src/database/repositories
 */
@Injectable()
export class AuditLogRepository extends Repository<AuditLog> {
  constructor(private dataSource: DataSource) {
    super(AuditLog, dataSource.createEntityManager());
  }

  /**
   * Create an audit log entry
   *
   * @param data - Audit log data
   * @returns Created audit log
   */
  async createAuditLog(data: {
    userId: string;
    organizationId?: string;
    tenantId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    details?: any;
  }): Promise<AuditLog> {
    const auditLog = this.dataSource.getRepository(AuditLog).create({
      userId: data.userId,
      organizationId: data.organizationId || null,
      tenantId: data.tenantId || null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      details: data.details || {},
    });

    return this.save(auditLog);
  }
}
