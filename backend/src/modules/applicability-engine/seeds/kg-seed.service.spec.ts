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
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ControlPack) {
          return packRepository
        }

        if (entity === ApplicabilityRule) {
          return ruleRepository
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
    expect(summary.applicabilityRules).toBe(25)
  })

  it('should fail fast when required tables are missing', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false),
    }

    await expect(
      seedKgBaselineWithQueryRunner(queryRunner as never, seedData),
    ).rejects.toThrow('KG seed runner requires table control_packs')
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
