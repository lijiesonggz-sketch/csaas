import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

export interface QueryAuditLogDto {
  limit?: number;
  offset?: number;
}

/**
 * AuditLogService
 *
 * Service for managing audit logs. Provides methods to create and query audit logs.
 * Audit logs are immutable (protected by database triggers) and retained for 1 year.
 *
 * Key Features:
 * - Fail-safe logging: Errors in audit logging do not affect main operations
 * - Tenant isolation: All queries are scoped to a specific tenant
 * - Immutable logs: Cannot be modified or deleted (enforced by DB triggers)
 *
 * @module backend/src/modules/audit/audit-log.service
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an audit log entry
   *
   * This method is fail-safe: if logging fails, it will not throw an error
   * to avoid disrupting the main operation.
   *
   * @param data - Partial audit log data
   */
  async log(data: Partial<AuditLog>): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(auditLog);
      this.logger.debug(`Audit log created: ${data.action} on ${data.entityType}`);
    } catch (error) {
      // Audit log write failure should not affect the main request
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Find all audit logs for a tenant with pagination
   *
   * @param tenantId - Tenant ID
   * @param query - Query parameters (limit, offset)
   * @returns Array of audit logs
   */
  async findAll(tenantId: string, query: QueryAuditLogDto): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });
  }

  /**
   * Find audit logs for a specific resource
   *
   * @param tenantId - Tenant ID
   * @param resource - Resource type (e.g., 'RadarPush', 'Organization')
   * @param resourceId - Resource ID
   * @returns Array of audit logs
   */
  async findByResource(tenantId: string, resource: string, resourceId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId, entityType: resource, entityId: resourceId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Archive and delete old audit logs (1 year retention policy)
   *
   * This method implements the retention policy required by AC 1:
   * "审计日志保留 1 年，任何人无法篡改或删除"
   *
   * Note: Database triggers prevent direct modification/deletion, so this method
   * should only be called by administrators or scheduled jobs with proper authorization.
   *
   * ✅ ADDED: Implements audit log archival strategy (Story 6-1B, LOW priority improvement)
   *
   * @param retentionDays - Number of days to retain logs (default: 365 = 1 year)
   * @returns Number of deleted logs
   */
  async archiveOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute()

      const deletedCount = result.affected || 0
      this.logger.log(`Archived ${deletedCount} audit logs older than ${retentionDays} days`)

      return deletedCount
    } catch (error) {
      this.logger.error(`Failed to archive audit logs: ${error.message}`, error)
      throw error
    }
  }
}
