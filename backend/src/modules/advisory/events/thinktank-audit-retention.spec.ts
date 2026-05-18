import {
  THINKTANK_AUDIT_RETENTION_DAYS,
  archiveOldThinkTankAuditLogs,
  normalizeThinkTankAuditRetentionDays,
} from './thinktank-audit-retention'

describe('ThinkTank audit retention', () => {
  it('defaults to at least the 180-day NFR and preserves the existing 365-day audit behavior', () => {
    expect(THINKTANK_AUDIT_RETENTION_DAYS).toBeGreaterThanOrEqual(180)
    expect(THINKTANK_AUDIT_RETENTION_DAYS).toBeGreaterThanOrEqual(365)
    expect(normalizeThinkTankAuditRetentionDays(undefined)).toBe(THINKTANK_AUDIT_RETENTION_DAYS)
  })

  it('rejects cleanup retention lower than 180 days', () => {
    expect(() => normalizeThinkTankAuditRetentionDays(90)).toThrow(/180/)
    expect(normalizeThinkTankAuditRetentionDays(180)).toBe(180)
  })

  it('delegates cleanup to the existing audit log archive path without adding external sinks', async () => {
    const auditLogService = {
      archiveOldLogs: jest.fn().mockResolvedValue(3),
    }

    await expect(archiveOldThinkTankAuditLogs(auditLogService, 365)).resolves.toBe(3)
    expect(auditLogService.archiveOldLogs).toHaveBeenCalledWith(365)
  })
})
