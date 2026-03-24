import {
  expectedSeedSummary,
  resolverRequiredControls,
} from '../../knowledge-graph/testing/atdd-story-2-1.fixtures'

type SeedConsistencyResult = {
  alignedControlCodes: string[]
  reusedControlIds: string[]
  summary: Record<string, unknown>
}

type SeedConsistencySubject = {
  runSeedConsistencyCheck: (options?: Record<string, unknown>) => Promise<SeedConsistencyResult>
  runSeedTwice: () => Promise<{
    firstRun: Record<string, unknown>
    secondRun: Record<string, unknown>
  }>
  runResolverRegression: () => Promise<{
    source: 'fixture' | 'db'
    reusedFixtureControls: string[]
  }>
}

describe('Story 2.1 ATDD RED - KG seed and resolver consistency', () => {
  const createSubject = (): SeedConsistencySubject => {
    throw new Error(
      'RED PHASE: taxonomy/control-point seed extension, resolver consistency checks, and resolver regression guardrails are not implemented yet',
    )
  }

  test.skip('[P0][2.1-INT-009] should align the formal control-point seed with resolver-control-catalog fixture and reuse stable controlIds for required baseline controls', async () => {
    const subject = createSubject()

    const result = await subject.runSeedConsistencyCheck()

    expect(result.alignedControlCodes).toEqual(
      resolverRequiredControls.map((control) => control.controlCode),
    )
    expect(result.reusedControlIds).toEqual(
      resolverRequiredControls.map((control) => control.controlId),
    )
  })

  test.skip('[P0][2.1-INT-010] should fail fast when seeded control metadata drifts from resolver-control-catalog fixture for code, name, family, mandatory or priority semantics', async () => {
    const subject = createSubject()

    await expect(
      subject.runSeedConsistencyCheck({
        mutateFixture: {
          controlCode: 'CTRL-ACC-002',
          changedControlName: 'Unexpected Drifted Name',
          changedControlFamily: 'ACC_DRIFTED',
        },
      }),
    ).rejects.toThrow(
      'Knowledge graph seed drift detected for CTRL-ACC-002: controlName/controlFamily mismatch against resolver-control-catalog fixture',
    )
  })

  test.skip('[P1][2.1-INT-011] should keep the seed:kg extension idempotent and preserve a stable summary contract across repeated executions', async () => {
    const subject = createSubject()

    const result = await subject.runSeedTwice()

    expect(result.firstRun).toMatchObject({
      taxonomyL1: expectedSeedSummary.taxonomyL1,
      requiredResolverControls: expectedSeedSummary.requiredResolverControls,
    })
    expect(result.secondRun).toEqual(result.firstRun)
  })

  test.skip('[P1][2.1-REG-012A] should keep applicability-engine runtime fixture-backed and must not switch resolver production reads to control_points in Story 2.1', async () => {
    const subject = createSubject()

    const result = await subject.runResolverRegression()

    expect(result.source).toBe('fixture')
    expect(result.reusedFixtureControls).toEqual(
      expect.arrayContaining(['CTRL-ACC-002', 'CTRL-BCP-003', 'CTRL-DG-004', 'CTRL-DATA-011']),
    )
  })
})
