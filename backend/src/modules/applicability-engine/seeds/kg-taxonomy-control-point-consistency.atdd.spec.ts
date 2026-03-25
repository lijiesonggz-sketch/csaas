import { loadKgSeedData, loadResolverRuntimeData, normalizeFixtureResolverRules, validateResolverRuntimeData } from './kg-seed-data'
import { seedKgBaselineWithQueryRunner } from './kg-seed.service'
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildSummaryProjection(summary: {
  controlPacks: number
  packFamilyMappings: number
  applicabilityRules: number
  demoProfiles: number
  expectedResults: number
  taxonomyL1: number
  taxonomyL2: number
  controlPoints: number
}): Record<string, unknown> {
  return {
    ...summary,
    requiredResolverControls: resolverRequiredControls.map((control) => control.controlCode),
    reusedControlIds: resolverRequiredControls.map((control) => control.controlId),
  }
}

function createStatefulQueryRunner() {
  const seedData = loadKgSeedData()
  const controlPackState = new Map<string, { packId: string; packCode: string }>()
  const applicabilityRuleState = new Map<string, { ruleCode: string }>()
  const taxonomyL1State = new Map<string, { l1Code: string }>()
  const taxonomyL2State = new Map<string, { l2Code: string }>()
  const controlPointState = new Map<string, { controlId: string; controlCode: string }>()

  const packRepository = {
    upsert: jest.fn().mockImplementation(async (rows: Array<{ packCode: string }>) => {
      rows.forEach((row, index) => {
        const existing = controlPackState.get(row.packCode)
        controlPackState.set(
          row.packCode,
          existing || {
            packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
            packCode: row.packCode,
          },
        )
      })
    }),
    find: jest.fn().mockImplementation(async () => Array.from(controlPackState.values())),
  }

  const ruleRepository = {
    upsert: jest.fn().mockImplementation(async (rows: Array<{ ruleCode: string }>) => {
      rows.forEach((row) => {
        applicabilityRuleState.set(row.ruleCode, { ruleCode: row.ruleCode })
      })
    }),
  }

  const taxonomyL1Repository = {
    upsert: jest.fn().mockImplementation(async (rows: Array<{ l1Code: string }>) => {
      rows.forEach((row) => {
        taxonomyL1State.set(row.l1Code, { l1Code: row.l1Code })
      })
    }),
  }

  const taxonomyL2Repository = {
    upsert: jest.fn().mockImplementation(async (rows: Array<{ l2Code: string }>) => {
      rows.forEach((row) => {
        taxonomyL2State.set(row.l2Code, { l2Code: row.l2Code })
      })
    }),
  }

  const controlPointRepository = {
    findOne: jest
      .fn()
      .mockImplementation(async ({ where }: { where: { controlCode: string } }) => {
        return controlPointState.get(where.controlCode) ?? null
      }),
    create: jest.fn().mockImplementation((row) => row),
    save: jest.fn().mockImplementation(
      async (row: { controlId: string; controlCode: string }) => {
        controlPointState.set(row.controlCode, row)
        return row
      },
    ),
  }

  const manager = {
    getRepository: jest.fn((entity: { name?: string }) => {
      switch (entity.name) {
        case 'TaxonomyL1':
          return taxonomyL1Repository
        case 'TaxonomyL2':
          return taxonomyL2Repository
        case 'ControlPack':
          return packRepository
        case 'ApplicabilityRule':
          return ruleRepository
        case 'ControlPoint':
          return controlPointRepository
        default:
          throw new Error(`Unexpected repository request for ${entity.name}`)
      }
    }),
  }

  return {
    queryRunner: {
      hasTable: jest.fn().mockResolvedValue(true),
      manager,
    },
    seedData,
  }
}

describe('Story 2.1 ATDD GREEN - KG seed and resolver consistency', () => {
  const createSubject = (): SeedConsistencySubject => ({
    async runSeedConsistencyCheck(options?: {
      mutateFixture?: {
        controlCode: string
        changedControlName?: string
        changedControlFamily?: string
      }
    }) {
      const seedData = loadKgSeedData()
      const runtimeData = deepClone(loadResolverRuntimeData(seedData))
      const mutation = options?.mutateFixture

      if (mutation) {
        const targetControl = runtimeData.controlCatalog.find(
          (control) => control.controlCode === mutation.controlCode,
        )

        if (!targetControl) {
          throw new Error(`Unable to find runtime control ${mutation.controlCode}`)
        }

        if (mutation.changedControlName) {
          targetControl.controlName = mutation.changedControlName
        }

        if (mutation.changedControlFamily) {
          targetControl.controlFamily = mutation.changedControlFamily
        }
      }

      validateResolverRuntimeData(runtimeData, seedData)

      const runtimeControlsByCode = new Map(
        runtimeData.controlCatalog.map((control) => [control.controlCode, control] as const),
      )

      return {
        alignedControlCodes: resolverRequiredControls
          .filter((control) => runtimeControlsByCode.has(control.controlCode))
          .map((control) => control.controlCode),
        reusedControlIds: resolverRequiredControls
          .map((control) => runtimeControlsByCode.get(control.controlCode))
          .filter((control): control is NonNullable<typeof control> => Boolean(control))
          .map((control) => control.controlId),
        summary: buildSummaryProjection({
          controlPacks: seedData.controlPacks.length,
          packFamilyMappings: seedData.packFamilyMappings.length,
          applicabilityRules: seedData.applicabilityRules.length,
          demoProfiles: seedData.demoProfiles.length,
          expectedResults: seedData.expectedResults.length,
          taxonomyL1: seedData.taxonomyL1.length,
          taxonomyL2: seedData.taxonomyL2.length,
          controlPoints: seedData.controlPoints.length,
        }),
      }
    },

    async runSeedTwice() {
      const { queryRunner, seedData } = createStatefulQueryRunner()

      const firstSummary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)
      const secondSummary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

      return {
        firstRun: buildSummaryProjection(firstSummary),
        secondRun: buildSummaryProjection(secondSummary),
      }
    },

    async runResolverRegression() {
      const runtimeData = loadResolverRuntimeData()
      const normalizedRules = normalizeFixtureResolverRules(runtimeData)

      return {
        source: normalizedRules.every((rule) => rule.source === 'fixture') ? 'fixture' : 'db',
        reusedFixtureControls: resolverRequiredControls
          .filter((requiredControl) =>
            runtimeData.controlCatalog.some(
              (runtimeControl) => runtimeControl.controlCode === requiredControl.controlCode,
            ),
          )
          .map((control) => control.controlCode),
      }
    },
  })

  test('[P0][2.1-INT-009] should align the formal control-point seed with resolver-control-catalog fixture and reuse stable controlIds for required baseline controls', async () => {
    const subject = createSubject()

    const result = await subject.runSeedConsistencyCheck()

    expect(result.alignedControlCodes).toEqual(
      resolverRequiredControls.map((control) => control.controlCode),
    )
    expect(result.reusedControlIds).toEqual(
      resolverRequiredControls.map((control) => control.controlId),
    )
  })

  test('[P0][2.1-INT-010] should fail fast when seeded control metadata drifts from resolver-control-catalog fixture for code, name, family, mandatory or priority semantics', async () => {
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

  test('[P1][2.1-INT-011] should keep the seed:kg extension idempotent and preserve a stable summary contract across repeated executions', async () => {
    const subject = createSubject()

    const result = await subject.runSeedTwice()

    expect(result.firstRun).toMatchObject({
      taxonomyL1: expectedSeedSummary.taxonomyL1,
      requiredResolverControls: expectedSeedSummary.requiredResolverControls,
    })
    expect(result.secondRun).toEqual(result.firstRun)
  })

  test('[P1][2.1-REG-012A] should keep applicability-engine runtime fixture-backed and must not switch resolver production reads to control_points in Story 2.1', async () => {
    const subject = createSubject()

    const result = await subject.runResolverRegression()

    expect(result.source).toBe('fixture')
    expect(result.reusedFixtureControls).toEqual(
      expect.arrayContaining(['CTRL-ACC-002', 'CTRL-BCP-003', 'CTRL-DG-004', 'CTRL-DATA-011']),
    )
  })
})
