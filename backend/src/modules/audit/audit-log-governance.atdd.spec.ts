import { AuditLogService } from './audit-log.service'
import { ThinkTankEventName } from '../advisory/events/thinktank-event-contract'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = new Date('2026-05-01T00:00:00.000Z')
const dateTo = new Date('2026-05-22T23:59:59.999Z')
const governanceEventNames = [
  ThinkTankEventName.AccessOpened,
  ThinkTankEventName.AccessDenied,
  ThinkTankEventName.WorkflowStarted,
  ThinkTankEventName.WorkflowCompleted,
  ThinkTankEventName.OutputExported,
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
    orderBy: jest.fn((sql: string, direction: string) => {
      calls.push({ method: 'orderBy', sql, params: { direction } })
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
      throw new Error('governance review must not use generic find')
    }),
  }
  return { service: new AuditLogService(repository as never), repository, queryBuilder }
}

describe('Story 6.5 AuditLogService governance query ATDD (RED)', () => {
  it('[6.5-INT-001][P1][AC1,AC3] queries audit_logs by row tenant and broad governance event candidates', async () => {
    const rows = [
      {
        id: 'audit-row',
        tenantId,
        details: { event_name: ThinkTankEventName.OutputExported },
      },
    ]
    const { service, repository, queryBuilder } = createService(rows)

    const result = await (service as any).findThinkTankGovernanceEvents({
      tenantId,
      dateFrom,
      dateTo,
      eventNames: governanceEventNames,
      actorId,
      eventType: ThinkTankEventName.OutputExported,
      outcome: 'success',
      workflowType: 'problem-solving',
    })

    expect(result).toBe(rows)
    expect(repository.createQueryBuilder).toHaveBeenCalledWith('audit')
    expect(queryBuilder.params).toEqual(
      expect.objectContaining({
        tenantId,
        dateFrom,
        dateTo,
        isoDatePattern: expect.any(String),
        eventNames: expect.arrayContaining(governanceEventNames),
      }),
    )
    const sql = queryBuilder.calls.map((call) => call.sql).join(' ')
    expect(sql).toContain('audit.tenantId')
    expect(sql).toContain('event_name')
    expect(sql).toContain('eventName')
    expect(sql).toContain('audit.entityType')
    expect(sql).toContain('occurred_at')
    expect(sql).toContain('occurredAt')
    expect(sql).toContain('audit.createdAt BETWEEN')
    expect(sql).not.toContain('actor_id')
    expect(sql).not.toContain("details ->> 'outcome' =")
    expect(sql).not.toContain('workflow_type')
    expect(sql).not.toMatch(
      /advisory_outputs|recommendation_feedback|output_ratings|ai_usage|provider_telemetry/i,
    )
  })

  it('[6.5-INT-002][P1][AC1,AC4] defaults to registered ThinkTank governance events and orders rows deterministically', async () => {
    const { service, repository, queryBuilder } = createService([])

    await (service as any).findThinkTankGovernanceEvents({ tenantId, dateFrom, dateTo })

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1)
    expect(queryBuilder.params.eventNames).toEqual(expect.arrayContaining(governanceEventNames))
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('audit.createdAt', 'ASC')
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1)
  })

  it('[6.5-INT-003][P0][AC1,AC4] uses audit_logs tenant_id row scope not details tenant_id as authorization boundary', async () => {
    const { service, queryBuilder } = createService([])

    await (service as any).findThinkTankGovernanceEvents({ tenantId, dateFrom, dateTo })

    const sql = queryBuilder.calls.map((call) => call.sql).join(' ')
    expect(sql).toContain('audit.tenantId = :tenantId')
    expect(sql).not.toMatch(/details\s*->>\s*'tenant_id'\s*=\s*:tenantId/)
  })
})
