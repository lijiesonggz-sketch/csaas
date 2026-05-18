import { AuditLogService } from '../../audit/audit-log.service'

export const THINKTANK_AUDIT_RETENTION_MIN_DAYS = 180
export const THINKTANK_AUDIT_RETENTION_DAYS = 365

export function normalizeThinkTankAuditRetentionDays(retentionDays?: number): number {
  if (retentionDays === undefined) return THINKTANK_AUDIT_RETENTION_DAYS
  if (!Number.isInteger(retentionDays) || retentionDays < THINKTANK_AUDIT_RETENTION_MIN_DAYS) {
    throw new Error(
      `ThinkTank audit retention must be at least ${THINKTANK_AUDIT_RETENTION_MIN_DAYS} days`,
    )
  }
  return retentionDays
}

export async function archiveOldThinkTankAuditLogs(
  auditLogService: Pick<AuditLogService, 'archiveOldLogs'>,
  retentionDays?: number,
): Promise<number> {
  return auditLogService.archiveOldLogs(normalizeThinkTankAuditRetentionDays(retentionDays))
}
