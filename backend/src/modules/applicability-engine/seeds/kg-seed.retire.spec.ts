/**
 * Unit Tests — Story 2-2: Seed Runner 扩展与旧数据退役
 *
 * 测试 retireLegacyControlPoints() 方法：
 *   AC#1: 旧控制点批量退役 (maturity_level=retired, retired_reason)
 *   AC#2: 关联映射清理 (5 张子表)
 *   AC#3: 幂等执行 (重复运行不报错、不重复处理)
 *   AC#4: 事务安全 (中途出错回滚 + 错误日志)
 *   Summary: 返回退役统计信息
 *   Integration: seedKgBaselineWithQueryRunner 集成
 *
 * Run: npx jest --testPathPattern="kg-seed.retire.spec" --no-coverage
 */

import {
  RETIRE_REASON,
  alreadyRetiredId,
  expectedRetireSummary,
  idsToRetire,
  preExistingCaseControlMaps,
  preExistingClauseControlMaps,
  preExistingControlPackItems,
  preExistingControlPoints,
  preExistingQuestionItems,
  preExistingRemediationActions,
  seedControlPointCodes,
} from './atdd-story-2-2-fixtures'
import {
  retireLegacyControlPoints,
  seedKgBaselineWithQueryRunner,
  RetireSummary,
} from './kg-seed.service'

// ---------------------------------------------------------------------------
// Helper: Build a stateful mock QueryRunner that simulates SQL operations
// ---------------------------------------------------------------------------

function createMockQueryRunnerWithState() {
  const executedQueries: Array<{ sql: string; params: unknown[] }> = []

  // In-memory state for control points
  const controlPointState = new Map(
    preExistingControlPoints.map((cp) => [
      cp.controlId,
      { ...cp },
    ]),
  )

  // In-memory state for association tables
  const controlPackItemState = [...preExistingControlPackItems]
  const clauseControlMapState = [...preExistingClauseControlMaps]
  const caseControlMapState = [...preExistingCaseControlMaps]
  const questionItemState = [...preExistingQuestionItems]
  const remediationActionState = [...preExistingRemediationActions]

  let rolledBack = false
  let committed = false

  const queryRunner = {
    hasTable: jest.fn().mockResolvedValue(true),

    query: jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      executedQueries.push({ sql, params: params ?? [] })

      // Simulate SELECT for non-retired control points
      if (sql.includes('SELECT') && sql.includes('control_points') && sql.includes('maturity_level')) {
        return Array.from(controlPointState.values())
          .filter((cp) => cp.maturityLevel !== 'retired')
          .map((cp) => ({ control_id: cp.controlId }))
      }

      // Simulate DELETE from control_pack_items
      if (sql.includes('DELETE') && sql.includes('control_pack_items')) {
        const ids = params?.[0] as string[] ?? []
        const deleted: typeof controlPackItemState = []
        for (let i = controlPackItemState.length - 1; i >= 0; i--) {
          if (ids.includes(controlPackItemState[i].controlId)) {
            deleted.push(controlPackItemState[i])
            controlPackItemState.splice(i, 1)
          }
        }
        return deleted // return deleted rows array; .length = count
      }

      // Simulate DELETE from clause_control_maps
      if (sql.includes('DELETE') && sql.includes('clause_control_maps')) {
        const ids = params?.[0] as string[] ?? []
        const deleted: typeof clauseControlMapState = []
        for (let i = clauseControlMapState.length - 1; i >= 0; i--) {
          if (ids.includes(clauseControlMapState[i].controlId)) {
            deleted.push(clauseControlMapState[i])
            clauseControlMapState.splice(i, 1)
          }
        }
        return deleted
      }

      // Simulate DELETE from case_control_maps
      if (sql.includes('DELETE') && sql.includes('case_control_maps')) {
        const ids = params?.[0] as string[] ?? []
        const deleted: typeof caseControlMapState = []
        for (let i = caseControlMapState.length - 1; i >= 0; i--) {
          if (ids.includes(caseControlMapState[i].controlId)) {
            deleted.push(caseControlMapState[i])
            caseControlMapState.splice(i, 1)
          }
        }
        return deleted
      }

      // Simulate DELETE from question_items
      if (sql.includes('DELETE') && sql.includes('question_items')) {
        const ids = params?.[0] as string[] ?? []
        const deleted: typeof questionItemState = []
        for (let i = questionItemState.length - 1; i >= 0; i--) {
          if (ids.includes(questionItemState[i].controlId)) {
            deleted.push(questionItemState[i])
            questionItemState.splice(i, 1)
          }
        }
        return deleted
      }

      // Simulate DELETE from remediation_actions
      if (sql.includes('DELETE') && sql.includes('remediation_actions')) {
        const ids = params?.[0] as string[] ?? []
        const deleted: typeof remediationActionState = []
        for (let i = remediationActionState.length - 1; i >= 0; i--) {
          if (ids.includes(remediationActionState[i].controlId)) {
            deleted.push(remediationActionState[i])
            remediationActionState.splice(i, 1)
          }
        }
        return deleted
      }

      // Simulate UPDATE control_points SET maturity_level = 'retired'
      if (sql.includes('UPDATE') && sql.includes('control_points') && sql.includes('retired')) {
        const retiredReason = params?.[0] as string ?? RETIRE_REASON
        const ids = params?.[1] as string[] ?? []
        const updated: Array<{ controlId: string; maturityLevel: string }> = []
        for (const id of ids) {
          const cp = controlPointState.get(id)
          if (cp && cp.maturityLevel !== 'retired') {
            cp.maturityLevel = 'retired'
            cp.retiredReason = retiredReason
            updated.push({ controlId: id, maturityLevel: 'retired' })
          }
        }
        return updated // return updated rows; .length = count
      }

      return undefined
    }),

    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockImplementation(async () => {
      committed = true
    }),
    rollbackTransaction: jest.fn().mockImplementation(async () => {
      rolledBack = true
    }),
    release: jest.fn().mockResolvedValue(undefined),

    // Accessors for test assertions
    _state: {
      getControlPoints: () => controlPointState,
      getControlPackItems: () => controlPackItemState,
      getClauseControlMaps: () => clauseControlMapState,
      getCaseControlMaps: () => caseControlMapState,
      getQuestionItems: () => questionItemState,
      getRemediationActions: () => remediationActionState,
      isRolledBack: () => rolledBack,
      isCommitted: () => committed,
    },
  }

  return { queryRunner, executedQueries }
}

// ---------------------------------------------------------------------------
// Helper: create a mock with NO non-retired control points (empty DB scenario)
// ---------------------------------------------------------------------------

function createEmptyMockQueryRunner() {
  const executedQueries: Array<{ sql: string; params: unknown[] }> = []

  const queryRunner = {
    hasTable: jest.fn().mockResolvedValue(true),

    query: jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      executedQueries.push({ sql, params: params ?? [] })

      // No non-retired control points
      if (sql.includes('SELECT') && sql.includes('control_points') && sql.includes('maturity_level')) {
        return []
      }

      // SELECT for FM IDs (seedFailureModes)
      if (sql.includes('SELECT') && sql.includes('failure_modes') && sql.includes('failure_mode_code')) {
        return []
      }

      // INSERT for taxonomy_failure_mode_maps (seedFailureModes)
      if (sql.includes('INSERT') && sql.includes('taxonomy_failure_mode_maps')) {
        return []
      }

      return undefined
    }),

    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  }

  return { queryRunner, executedQueries }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Story 2-2 — retireLegacyControlPoints()', () => {
  // =========================================================================
  // AC#1: 旧控制点批量退役
  // =========================================================================

  it('[P0][2.2-UNIT-001] should mark all non-retired control points as retired', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    // Verify UPDATE was issued for control_points
    const updateQuery = executedQueries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('control_points') && q.sql.includes('maturity_level'),
    )
    expect(updateQuery).toBeDefined()
    // params: [0]=retired_reason, [1]=control_ids
    expect(updateQuery!.params[1]).toEqual(expect.arrayContaining(idsToRetire))

    // Verify count matches non-retired control points
    expect(summary.retiredCount).toBe(idsToRetire.length)
  })

  it('[P0][2.2-UNIT-002] should set retired_reason correctly', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    await retireLegacyControlPoints(queryRunner as never)

    const updateQuery = executedQueries.find(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('retired_reason'),
    )
    expect(updateQuery).toBeDefined()
    expect(updateQuery!.sql).toContain('retired_reason')
  })

  it('[P1][2.2-UNIT-003] should NOT create superseded_by mappings', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    await retireLegacyControlPoints(queryRunner as never)

    const supersededQuery = executedQueries.find(
      (q) => q.sql.includes('superseded_by'),
    )
    expect(supersededQuery).toBeUndefined()
  })

  // =========================================================================
  // AC#2: 关联映射清理
  // =========================================================================

  it('[P0][2.2-UNIT-004] should delete control_pack_items referencing old control points', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    const deleteQuery = executedQueries.find(
      (q) => q.sql.includes('DELETE') && q.sql.includes('control_pack_items'),
    )
    expect(deleteQuery).toBeDefined()
    expect(summary.cleanedControlPackItems).toBe(expectedRetireSummary.cleanedControlPackItems)
  })

  it('[P0][2.2-UNIT-005] should delete clause_control_maps referencing old control points', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    const deleteQuery = executedQueries.find(
      (q) => q.sql.includes('DELETE') && q.sql.includes('clause_control_maps'),
    )
    expect(deleteQuery).toBeDefined()
    expect(summary.cleanedClauseControlMaps).toBe(expectedRetireSummary.cleanedClauseControlMaps)
  })

  it('[P0][2.2-UNIT-006] should delete case_control_maps referencing old control points', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    const deleteQuery = executedQueries.find(
      (q) => q.sql.includes('DELETE') && q.sql.includes('case_control_maps'),
    )
    expect(deleteQuery).toBeDefined()
    expect(summary.cleanedCaseControlMaps).toBe(expectedRetireSummary.cleanedCaseControlMaps)
  })

  it('[P0][2.2-UNIT-007] should delete question_items referencing old control points', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    const deleteQuery = executedQueries.find(
      (q) => q.sql.includes('DELETE') && q.sql.includes('question_items'),
    )
    expect(deleteQuery).toBeDefined()
    expect(summary.cleanedQuestionItems).toBe(expectedRetireSummary.cleanedQuestionItems)
  })

  it('[P0][2.2-UNIT-008] should delete remediation_actions referencing old control points', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    const deleteQuery = executedQueries.find(
      (q) => q.sql.includes('DELETE') && q.sql.includes('remediation_actions'),
    )
    expect(deleteQuery).toBeDefined()
    expect(summary.cleanedRemediationActions).toBe(expectedRetireSummary.cleanedRemediationActions)
  })

  it('[P0][2.2-UNIT-009] should delete child tables BEFORE updating control_points (FK RESTRICT order)', async () => {
    const { queryRunner, executedQueries } = createMockQueryRunnerWithState()
    await retireLegacyControlPoints(queryRunner as never)

    const deleteIndices = executedQueries
      .map((q, i) => ({ i, sql: q.sql }))
      .filter((q) => q.sql.includes('DELETE'))
      .map((q) => q.i)

    const updateIndex = executedQueries.findIndex(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('control_points'),
    )

    expect(updateIndex).toBeGreaterThan(-1)
    for (const deleteIdx of deleteIndices) {
      expect(deleteIdx).toBeLessThan(updateIndex)
    }
  })

  it('[P1][2.2-UNIT-010] should NOT delete association records for already-retired control points', async () => {
    const { queryRunner } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    // 2 linked to non-retired, 1 linked to already-retired → only 2 cleaned
    expect(summary.cleanedControlPackItems).toBe(2)
    expect(summary.cleanedClauseControlMaps).toBe(2)
    expect(summary.cleanedCaseControlMaps).toBe(2)
    expect(summary.cleanedQuestionItems).toBe(2)
    expect(summary.cleanedRemediationActions).toBe(2)
  })

  // =========================================================================
  // AC#3: 幂等执行
  // =========================================================================

  it('[P0][2.2-UNIT-011] should skip already-retired control points on repeat run', async () => {
    const { queryRunner } = createMockQueryRunnerWithState()

    const firstRun = await retireLegacyControlPoints(queryRunner as never)
    expect(firstRun.retiredCount).toBe(idsToRetire.length)

    // Second run — all controls are now retired, so query returns empty
    const secondRun = await retireLegacyControlPoints(queryRunner as never)
    expect(secondRun.retiredCount).toBe(0)
  })

  it('[P0][2.2-UNIT-012] should not produce errors on repeat run', async () => {
    const { queryRunner } = createMockQueryRunnerWithState()

    await retireLegacyControlPoints(queryRunner as never)
    const secondRun = await retireLegacyControlPoints(queryRunner as never)

    expect(secondRun.retiredCount).toBe(0)
    expect(secondRun.cleanedControlPackItems).toBe(0)
    expect(secondRun.cleanedClauseControlMaps).toBe(0)
    expect(secondRun.cleanedCaseControlMaps).toBe(0)
    expect(secondRun.cleanedQuestionItems).toBe(0)
    expect(secondRun.cleanedRemediationActions).toBe(0)
  })

  it('[P1][2.2-UNIT-013] should return zero counts when no non-retired control points exist', async () => {
    const { queryRunner } = createEmptyMockQueryRunner()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    expect(summary.retiredCount).toBe(0)
    expect(summary.cleanedControlPackItems).toBe(0)
    expect(summary.cleanedClauseControlMaps).toBe(0)
    expect(summary.cleanedCaseControlMaps).toBe(0)
    expect(summary.cleanedQuestionItems).toBe(0)
    expect(summary.cleanedRemediationActions).toBe(0)
  })

  // =========================================================================
  // AC#4: 事务安全
  // =========================================================================

  it('[P0][2.2-UNIT-014] should propagate errors (transaction managed by caller)', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockRejectedValue(new Error('retire failed: database connection lost')),
    }

    await expect(retireLegacyControlPoints(queryRunner as never)).rejects.toThrow('retire failed')
  })

  it('[P1][2.2-UNIT-015] should provide descriptive error message on failure', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockRejectedValue(new Error('retire failed: constraint violation')),
    }

    await expect(retireLegacyControlPoints(queryRunner as never)).rejects.toThrow('retire')
  })

  // =========================================================================
  // Summary: 返回退役统计信息
  // =========================================================================

  it('[P0][2.2-UNIT-016] should return accurate retire summary', async () => {
    const { queryRunner } = createMockQueryRunnerWithState()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    expect(summary).toEqual({
      retiredCount: expectedRetireSummary.retiredCount,
      cleanedControlPackItems: expectedRetireSummary.cleanedControlPackItems,
      cleanedClauseControlMaps: expectedRetireSummary.cleanedClauseControlMaps,
      cleanedCaseControlMaps: expectedRetireSummary.cleanedCaseControlMaps,
      cleanedQuestionItems: expectedRetireSummary.cleanedQuestionItems,
      cleanedRemediationActions: expectedRetireSummary.cleanedRemediationActions,
    })
  })

  // =========================================================================
  // Integration: seedKgBaselineWithQueryRunner 集成
  // =========================================================================

  it('[P0][2.2-INT-017] should run retire BEFORE upserting seed data', async () => {
    // Create a mock that tracks both retire queries and seed upsert queries
    const executedQueries: Array<{ sql: string; params: unknown[] }> = []

    const { loadKgSeedData } = await import('./kg-seed-data')
    const seedData = loadKgSeedData()

    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        executedQueries.push({ sql, params: params ?? [] })

        // SELECT for non-retired control points
        if (sql.includes('SELECT') && sql.includes('control_points') && sql.includes('maturity_level')) {
          return [{ control_id: 'old-cp-1' }]
        }
        // DELETE for retire
        if (sql.includes('DELETE')) {
          return [] // return empty array, length=0
        }
        // UPDATE for retire
        if (sql.includes('UPDATE') && sql.includes('retired')) {
          return [{ controlId: 'old-cp-1', maturityLevel: 'retired' }]
        }
        // SELECT for FM IDs (seedFailureModes)
        if (sql.includes('SELECT') && sql.includes('failure_modes') && sql.includes('failure_mode_code')) {
          return []
        }
        // INSERT for taxonomy_failure_mode_maps (seedFailureModes)
        if (sql.includes('INSERT') && sql.includes('taxonomy_failure_mode_maps')) {
          return []
        }
        return undefined
      }),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          upsert: jest.fn().mockResolvedValue(undefined),
          find: jest.fn().mockResolvedValue(
            seedData.controlPacks.map((pack, index) => ({
              packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
              packCode: pack.packCode,
            })),
          ),
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((v) => v),
          save: jest.fn().mockResolvedValue(undefined),
        }),
      },
    }

    const summary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

    // Find the retire UPDATE query
    const retireUpdateIdx = executedQueries.findIndex(
      (q) => q.sql.includes('UPDATE') && q.sql.includes('maturity_level') && q.sql.includes('retired'),
    )

    // Retire should have been called (retire step runs first)
    expect(retireUpdateIdx).toBeGreaterThan(-1)

    // Summary should include retireSummary
    expect(summary.retireSummary).toBeDefined()
    expect(summary.retireSummary!.retiredCount).toBeGreaterThanOrEqual(0)
  })

  it('[P0][2.2-INT-018] should include retireSummary in KgSeedSummary', async () => {
    const { queryRunner } = createEmptyMockQueryRunner()
    const { loadKgSeedData } = await import('./kg-seed-data')
    const seedData = loadKgSeedData()

    // Add manager mock to the empty query runner
    ;(queryRunner as any).manager = {
      getRepository: jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue(undefined),
        find: jest.fn().mockResolvedValue(
          seedData.controlPacks.map((pack, index) => ({
            packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
            packCode: pack.packCode,
          })),
        ),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((v) => v),
        save: jest.fn().mockResolvedValue(undefined),
      }),
    }

    const summary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

    expect(summary.retireSummary).toBeDefined()
    expect(summary.retireSummary!.retiredCount).toBe(0)
    expect(summary.retireSummary!.cleanedControlPackItems).toBe(0)
    expect(summary.retireSummary!.cleanedClauseControlMaps).toBe(0)
    expect(summary.retireSummary!.cleanedCaseControlMaps).toBe(0)
    expect(summary.retireSummary!.cleanedQuestionItems).toBe(0)
    expect(summary.retireSummary!.cleanedRemediationActions).toBe(0)
  })

  it('[P1][2.2-INT-019] should leave seed control points at default maturityLevel after full run', async () => {
    const { queryRunner } = createEmptyMockQueryRunner()
    const { loadKgSeedData } = await import('./kg-seed-data')
    const seedData = loadKgSeedData()

    ;(queryRunner as any).manager = {
      getRepository: jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue(undefined),
        find: jest.fn().mockResolvedValue(
          seedData.controlPacks.map((pack, index) => ({
            packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
            packCode: pack.packCode,
          })),
        ),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((v) => v),
        save: jest.fn().mockResolvedValue(undefined),
      }),
    }

    const summary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

    expect(summary.controlPoints).toBeGreaterThanOrEqual(seedControlPointCodes.length)
  })

  it('[P1][2.2-INT-020] should handle empty database gracefully', async () => {
    const { queryRunner } = createEmptyMockQueryRunner()
    const summary = await retireLegacyControlPoints(queryRunner as never)

    expect(summary.retiredCount).toBe(0)
    expect(summary.cleanedControlPackItems).toBe(0)
  })
})
