import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { loadKgSeedData } from './kg-seed-data'
import { runKgSeed, seedKgBaselineWithQueryRunner } from './kg-seed.service'

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

        throw new Error('Unexpected repository request')
      }),
    }
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
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

  it('should remain idempotent across repeated executions with the same repository state', async () => {
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
      save: jest
        .fn()
        .mockImplementation(async (row: { controlId: string; controlCode: string }) => {
          controlPointState.set(row.controlCode, row)
          return row
        }),
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

        throw new Error('Unexpected repository request')
      }),
    }
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      manager,
    }

    await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)
    await seedKgBaselineWithQueryRunner(queryRunner as never, seedData)

    expect(controlPackState.size).toBe(seedData.controlPacks.length)
    expect(applicabilityRuleState.size).toBe(seedData.applicabilityRules.length)
    expect(taxonomyL1State.size).toBe(seedData.taxonomyL1.length)
    expect(taxonomyL2State.size).toBe(seedData.taxonomyL2.length)
    expect(controlPointState.size).toBe(seedData.controlPoints.length)
  })
})

describe('runKgSeed', () => {
  it('should wrap seeding in a transaction', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      hasTable: jest.fn().mockResolvedValue(true),
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
