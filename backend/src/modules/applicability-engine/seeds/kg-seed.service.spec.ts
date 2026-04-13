import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { loadKgSeedData } from './kg-seed-data'
import { runKgSeed, seedKgBaselineWithQueryRunner } from './kg-seed.service'

// Helper: create a generic mock repository for seed runner tests
function createGenericMockRepository() {
  return {
    upsert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockResolvedValue(undefined),
  }
}

describe('seedKgBaselineWithQueryRunner', () => {
  const seedData = loadKgSeedData()

  it('should upsert packs and rules with idempotent conflict keys', async () => {
    const packRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue(
        seedData.controlPacks.map((pack, index) => ({
          packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          packCode: pack.packCode,
        })),
      ),
    }
    const ruleRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const taxonomyL1Repository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const taxonomyL2Repository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const controlPointRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    }
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TaxonomyL1') {
          return taxonomyL1Repository
        }

        if (entity.name === 'TaxonomyL2') {
          return taxonomyL2Repository
        }

        if (entity === ControlPack) {
          return packRepository
        }

        if (entity === ApplicabilityRule) {
          return ruleRepository
        }

        if (entity.name === 'ControlPoint') {
          return controlPointRepository
        }

        if (entity.name === 'FailureMode') {
          return createGenericMockRepository()
        }

        if (entity.name === 'TaxonomyFailureModeMap') {
          return createGenericMockRepository()
        }

        if (
          entity.name === 'RegulationSource' ||
          entity.name === 'RegulationClause' ||
          entity.name === 'QuestionItem' ||
          entity.name === 'RemediationAction'
        ) {
          return createGenericMockRepository()
        }

        throw new Error('Unexpected repository request')
      }),
    }
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      manager,
    }

    const summary = await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_packs')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('applicability_rules')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('taxonomy_l1')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('taxonomy_l2')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_points')
    expect(taxonomyL1Repository.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          l1Code: 'IT01',
          l1Name: '信息科技治理与风险管理',
        }),
      ]),
      ['l1Code'],
    )
    expect(taxonomyL2Repository.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          l2Code: 'IT02-03',
          l1Code: 'IT02',
        }),
      ]),
      ['l2Code'],
    )
    expect(packRepository.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          packCode: 'PACK-BASE-GOVERNANCE',
          packType: 'base',
        }),
      ]),
      ['packCode'],
    )
    expect(ruleRepository.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: 'RULE-PACK-BASE-GOVERNANCE-INCLUDE-001',
          targetType: 'pack',
        }),
      ]),
      ['ruleCode'],
    )
    expect(summary.controlPacks).toBe(25)
    expect(summary.packFamilyMappings).toBe(seedData.packFamilyMappings.length)
    expect(summary.applicabilityRules).toBe(25)
    expect(summary.demoProfiles).toBe(seedData.demoProfiles.length)
    expect(summary.expectedResults).toBe(seedData.expectedResults.length)
    expect(summary.taxonomyL1).toBe(seedData.taxonomyL1.length)
    expect(summary.taxonomyL2).toBe(seedData.taxonomyL2.length)
    expect(summary.controlPoints).toBe(seedData.controlPoints.length)
  })

  it('should fail fast when required tables are missing', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false),
    }

    await expect(seedKgBaselineWithQueryRunner(queryRunner as never, seedData)).rejects.toThrow(
      'KG seed runner requires table control_packs',
    )
  })

  it('should include KG2.4 hard-control artifact statistics in summary after baseline seeding', async () => {
    const packRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue(
        seedData.controlPacks.map((pack, index) => ({
          packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          packCode: pack.packCode,
        })),
      ),
    }
    const genericRepository = createGenericMockRepository()
    const controlPointRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
    }
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TaxonomyL1' || entity.name === 'TaxonomyL2') {
          return genericRepository
        }
        if (entity === ControlPack) {
          return packRepository
        }
        if (entity === ApplicabilityRule) {
          return genericRepository
        }
        if (entity.name === 'ControlPoint') {
          return controlPointRepository
        }
        return genericRepository
      }),
    }
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      manager,
    }

    const summary = (await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)) as {
      controlPackItems?: number
      failureModeControlMaps?: number
      clauseControlMaps?: number
      questionItems?: number
      remediationActions?: number
    }

    expect(summary).toEqual(
      expect.objectContaining({
        controlPackItems: expect.any(Number),
        failureModeControlMaps: expect.any(Number),
        clauseControlMaps: expect.any(Number),
        questionItems: expect.any(Number),
        remediationActions: expect.any(Number),
      }),
    )
  })
})

describe('runKgSeed', () => {
  it('should wrap seeding in a transaction', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'TaxonomyL1') {
            return {
              upsert: jest.fn().mockResolvedValue(undefined),
            }
          }

          if (entity.name === 'TaxonomyL2') {
            return {
              upsert: jest.fn().mockResolvedValue(undefined),
            }
          }

          if (entity === ControlPack) {
            return {
              upsert: jest.fn().mockResolvedValue(undefined),
              find: jest.fn().mockResolvedValue(
                loadKgSeedData().controlPacks.map((pack, index) => ({
                  packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
                  packCode: pack.packCode,
                })),
              ),
            }
          }

          if (entity.name === 'ControlPoint') {
            return {
              findOne: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation((row) => row),
              save: jest.fn().mockResolvedValue(undefined),
            }
          }

          return {
            upsert: jest.fn().mockResolvedValue(undefined),
          }
        }),
      },
    }
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    }

    await runKgSeed(dataSource as never, loadKgSeedData())

    expect(queryRunner.startTransaction).toHaveBeenCalled()
    expect(queryRunner.commitTransaction).toHaveBeenCalled()
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled()
    expect(queryRunner.release).toHaveBeenCalled()
  })
})
