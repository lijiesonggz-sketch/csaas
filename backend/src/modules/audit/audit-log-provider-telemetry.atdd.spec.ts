import { AuditLogService } from './audit-log.service'
import { ThinkTankEventName } from '../advisory/events/thinktank-event-contract'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const dateFrom = new Date('2026-05-01T00:00:00.000Z')
const dateTo = new Date('2026-05-22T23:59:59.999Z')
const providerEventNames = [
  ThinkTankEventName.ProviderCallCompleted,
  ThinkTankEventName.ProviderCallFailed,
  ThinkTankEventName.ProviderCallRetried,
  ThinkTankEventName.PromptCacheHit,
  ThinkTankEventName.PromptCacheMiss,
]

function createQueryBuilder(rows: unknown[] = []) {
  const calls: Array<{ method: string; sql?: string; params?: Record<string, unknown> }> = []
  const params: Record<string, unknown> = {}
  const queryBuilder = {
    calls,
    params,
    where: jest.fn((sql: string, nextParams?: Record<string, unknown>) => {
      calls.push({ method: 'where', sql, params: nextParams })
      Object.assign(params, nextParams)
      return queryBuilder
    }),
    andWhere: jest.fn((sql: string, nextParams?: Record<string, unknown>) => {
      calls.push({ method: 'andWhere', sql, params: nextParams })
      Object.assign(params, nextParams)
      return queryBuilder
    }),
    orderBy: jest.fn((sql: string) => {
      calls.push({ method: 'orderBy', sql })
      return queryBuilder
    }),
    getMany: jest.fn().mockResolvedValue(rows),
  }
  return queryBuilder
}

function createService(rows: unknown[] = []) {
  const queryBuilder = createQueryBuilder(rows)
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    find: jest.fn(() => {
      throw new Error('provider telemetry aggregation must not use generic find')
    }),
  }
  return { service: new AuditLogService(repository as never), repository, queryBuilder }
}

/*
 * Provider Scrutiny Evidence:
 * - Source: backend/src/modules/audit/audit-log.service.ts currently has findThinkTankUsageEvents for Story 6.1.
 * - Expected new method: findThinkTankProviderTelemetryEvents(query).
 * - Source table: audit_logs through Repository<AuditLog>.createQueryBuilder('audit').
 * - Shape: returns AuditLog[] rows only; no new provider telemetry table, job queue, or generic AI usage dependency.
 * - Filtering: audit.tenantId, provider/cache event names, occurred_at/occurredAt/date window, and createdAt candidate window for gap diagnosis.
 */
describe('Story 6.2 AuditLogService provider telemetry query ATDD', () => {
  test('[P1][6.2-INT-007][AC1,AC2] queries only registered provider and prompt cache telemetry rows by row tenant date and event names', async () => {
    const rows = [
      {
        id: 'provider-row',
        tenantId,
        details: { event_name: ThinkTankEventName.ProviderCallCompleted },
      },
    ]
    const { service, repository, queryBuilder } = createService(rows)

    const result = await (service as any).findThinkTankProviderTelemetryEvents({
      tenantId,
      dateFrom,
      dateTo,
      eventNames: providerEventNames,
    })

    expect(result).toBe(rows)
    expect(repository.createQueryBuilder).toHaveBeenCalledWith('audit')
    expect(queryBuilder.params).toEqual(
      expect.objectContaining({
        tenantId,
        dateFrom,
        dateTo,
        eventNames: expect.arrayContaining(providerEventNames),
      }),
    )
    const sql = queryBuilder.calls.map((call) => call.sql).join(' ')
    expect(sql).toContain('audit.tenantId')
    expect(sql).toContain('event_name')
    expect(sql).toContain('eventName')
    expect(sql).toContain('occurred_at')
    expect(sql).toContain('occurredAt')
    expect(sql).toContain('audit.createdAt')
    expect(sql).not.toMatch(/ai_usage|provider_telemetry|glm_calls/i)
  })

  test('[P1][6.2-INT-008][AC2] defaults to the Story 6.2 provider telemetry whitelist and orders rows deterministically', async () => {
    const { service, repository, queryBuilder } = createService([])

    await (service as any).findThinkTankProviderTelemetryEvents({ tenantId, dateFrom, dateTo })

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1)
    expect(queryBuilder.params.eventNames).toEqual(expect.arrayContaining(providerEventNames))
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('audit.createdAt', 'ASC')
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1)
  })
})
