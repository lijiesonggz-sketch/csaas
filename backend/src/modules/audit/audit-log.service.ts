import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../../database/entities/audit-log.entity'

export interface QueryAuditLogDto {
  limit?: number
  offset?: number
}

export type TaxonomyRolloutReportHistoryType =
  | 'retirement'
  | 'rollback'
  | 'reclassify'
  | 'backfill'
  | 'smoke'
  | 'evidence'

export interface FindTaxonomyRolloutReportsQuery {
  tenantId?: string | null
  l1Code?: string
  page: number
  limit: number
  dateFrom?: Date
  dateTo?: Date
}

export interface TaxonomyRolloutReportHistoryItem {
  id: string
  type: TaxonomyRolloutReportHistoryType
  l1Code: string
  occurredAt: string
  outcome: string
  status: string
  summary: string
  reportPath?: string | null
  evidenceLink?: string | null
}

export interface TaxonomyRolloutReportHistoryResult {
  items: TaxonomyRolloutReportHistoryItem[]
  page: number
  limit: number
  total: number
  hasNextPage: boolean
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
  private readonly logger = new Logger(AuditLogService.name)

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
      const auditLog = this.auditLogRepository.create(data)
      await this.auditLogRepository.save(auditLog)
      this.logger.debug(`Audit log created: ${data.action} on ${data.entityType}`)
    } catch (error) {
      // Audit log write failure should not affect the main request
      this.logger.error('Failed to write audit log', error)
    }
  }

  /**
   * Create an audit log entry and propagate persistence failures.
   *
   * Control-plane operations that must not proceed without a durable audit
   * record should call this strict variant instead of the fail-safe `log`.
   */
  async logStrict(data: Partial<AuditLog>): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(data)
    const saved = await this.auditLogRepository.save(auditLog)
    this.logger.debug(`Strict audit log created: ${data.action} on ${data.entityType}`)
    return saved
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
    })
  }

  /**
   * Find audit logs for a specific resource
   *
   * @param tenantId - Tenant ID
   * @param resource - Resource type (e.g., 'RadarPush', 'Organization')
   * @param resourceId - Resource ID
   * @returns Array of audit logs
   */
  async findByResource(
    tenantId: string,
    resource: string,
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId, entityType: resource, entityId: resourceId },
      order: { createdAt: 'DESC' },
    })
  }

  async findRecentByEventNames(
    tenantId: string,
    eventNames: string[],
    limit: number = 5,
  ): Promise<AuditLog[]> {
    if (!eventNames.length) return []

    return this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.tenantId = :tenantId', { tenantId })
      .andWhere("audit.details ->> 'eventName' IN (:...eventNames)", { eventNames })
      .orderBy('audit.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 20))
      .getMany()
  }

  async findTaxonomyRolloutReports(
    query: FindTaxonomyRolloutReportsQuery,
  ): Promise<TaxonomyRolloutReportHistoryResult> {
    if (!query.tenantId) {
      throw new Error('tenant scope is required for taxonomy rollout report history.')
    }

    const page = Math.min(Math.max(1, query.page), 10000)
    const limit = Math.min(Math.max(1, query.limit), 50)
    const offset = (page - 1) * limit
    const entityTypes = ['TaxonomyRolloutRetirement', 'TaxonomyRolloutRecovery']

    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.entityType IN (:...entityTypes)', { entityTypes })
      .andWhere("(audit.details ->> 'stage') IS DISTINCT FROM 'requested'")
      .orderBy('audit.createdAt', 'DESC')
      .skip(offset)
      .take(limit)

    queryBuilder.andWhere('audit.tenantId = :tenantId', { tenantId: query.tenantId })

    if (query.l1Code) {
      queryBuilder.andWhere("audit.details ->> 'l1Code' = :l1Code", {
        l1Code: query.l1Code,
      })
    }

    if (query.dateFrom) {
      queryBuilder.andWhere('audit.createdAt >= :dateFrom', { dateFrom: query.dateFrom })
    }

    if (query.dateTo) {
      queryBuilder.andWhere('audit.createdAt <= :dateTo', { dateTo: query.dateTo })
    }

    const [auditLogs, total] = await queryBuilder.getManyAndCount()

    return {
      items: auditLogs.map((auditLog) => this.toTaxonomyRolloutReportHistoryItem(auditLog)),
      page,
      limit,
      total,
      hasNextPage: offset + auditLogs.length < total,
    }
  }

  private toTaxonomyRolloutReportHistoryItem(auditLog: AuditLog): TaxonomyRolloutReportHistoryItem {
    const details = auditLog.details ?? {}
    const operation = this.readString(details.operation)
    const l1Code = this.readString(details.l1Code) ?? 'UNKNOWN'
    const outcome = this.readString(details.outcome) ?? 'unknown'
    const type = this.resolveTaxonomyRolloutReportType(auditLog.entityType, operation, details)
    const reportPath =
      this.readString(details.reportPath) ?? this.readString(details.lastRetirementReportPath)
    const evidenceLink =
      this.readString(details.evidenceLink) ??
      this.readString(details.smokeEvidencePath) ??
      (details.smokeVerification ? reportPath : null)
    const summary =
      this.readString(details.summary) ??
      this.buildTaxonomyRolloutReportSummary(type, l1Code, outcome, details)

    return {
      id: auditLog.id,
      type,
      l1Code,
      occurredAt: auditLog.createdAt.toISOString(),
      outcome,
      status: outcome === 'success' ? 'completed' : outcome,
      summary,
      reportPath,
      evidenceLink,
    }
  }

  private resolveTaxonomyRolloutReportType(
    entityType: string,
    operation: string | null,
    details: Record<string, any>,
  ): TaxonomyRolloutReportHistoryType {
    if (operation === 'reclassify' || operation === 'backfill') return operation
    if (operation === 'rollback') return 'rollback'
    if (operation === 'dry-run') return 'evidence'
    if (details.smokeVerification || operation === 'smoke') return 'smoke'
    if (operation === 'evidence' || operation === 'report-view') return 'evidence'
    if (entityType === 'TaxonomyRolloutRetirement') return 'retirement'
    return 'evidence'
  }

  private buildTaxonomyRolloutReportSummary(
    type: TaxonomyRolloutReportHistoryType,
    l1Code: string,
    outcome: string,
    details: Record<string, any>,
  ): string {
    const processedCount =
      typeof details.processedCount === 'number' ? details.processedCount : undefined
    if (processedCount !== undefined) {
      return `${type} ${outcome} for ${processedCount} cases in ${l1Code}.`
    }

    return `${type} ${outcome} for ${l1Code}.`
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
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
