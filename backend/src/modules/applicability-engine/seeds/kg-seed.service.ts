import { DataSource, QueryRunner } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { ApplicabilityRuleSeedRecord, KgSeedData, loadKgSeedData } from './kg-seed-data'

export interface KgSeedSummary {
  controlPacks: number
  packFamilyMappings: number
  applicabilityRules: number
  demoProfiles: number
  expectedResults: number
}

function mapRules(
  rules: ApplicabilityRuleSeedRecord[],
  packIdByCode: Map<string, string>,
): Array<Partial<ApplicabilityRule>> {
  return rules.map((rule) => {
    if (rule.targetType !== 'pack') {
      throw new Error(
        `Story 1.2 seed runner only supports pack-target rules, got ${rule.targetType} for ${rule.ruleCode}`,
      )
    }

    const targetId = packIdByCode.get(rule.targetCode)

    if (!targetId) {
      throw new Error(`Unable to resolve target pack ${rule.targetCode} for rule ${rule.ruleCode}`)
    }

    return {
      ruleCode: rule.ruleCode,
      targetType: rule.targetType,
      targetId,
      ruleType: rule.ruleType,
      predicateJson: rule.predicate,
      resultJson: rule.result ? (rule.result as Record<string, unknown>) : null,
      priority: rule.priority,
      effectiveFrom: rule.effectiveFrom || null,
      effectiveTo: rule.effectiveTo || null,
      status: rule.status || 'ACTIVE',
    }
  })
}

export async function seedKgBaselineWithQueryRunner(
  queryRunner: QueryRunner,
  seedData: KgSeedData = loadKgSeedData(),
): Promise<KgSeedSummary> {
  const requiredTables = ['control_packs', 'applicability_rules']

  for (const table of requiredTables) {
    const exists = await queryRunner.hasTable(table)

    if (!exists) {
      throw new Error(`KG seed runner requires table ${table}; run migrations first`)
    }
  }

  const controlPackRepository = queryRunner.manager.getRepository(ControlPack)
  const applicabilityRuleRepository = queryRunner.manager.getRepository(ApplicabilityRule)

  await controlPackRepository.upsert(
    seedData.controlPacks.map((pack) => ({
      packCode: pack.packCode,
      packName: pack.packName,
      packType: pack.packType,
      maturityLevel: pack.maturityLevel,
      priority: pack.priority,
      description: pack.description,
      status: pack.status || 'ACTIVE',
    })),
    ['packCode'],
  )

  const persistedPacks = await controlPackRepository.find({
    select: {
      packId: true,
      packCode: true,
    },
  })

  const packIdByCode = new Map(
    persistedPacks.map((pack) => [pack.packCode, pack.packId] satisfies [string, string]),
  )

  await applicabilityRuleRepository.upsert(
    mapRules(seedData.applicabilityRules, packIdByCode),
    ['ruleCode'],
  )

  return {
    controlPacks: seedData.controlPacks.length,
    packFamilyMappings: seedData.packFamilyMappings.length,
    applicabilityRules: seedData.applicabilityRules.length,
    demoProfiles: seedData.demoProfiles.length,
    expectedResults: seedData.expectedResults.length,
  }
}

export async function runKgSeed(
  dataSource: DataSource,
  seedData: KgSeedData = loadKgSeedData(),
): Promise<KgSeedSummary> {
  const queryRunner = dataSource.createQueryRunner()

  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    const summary = await seedKgBaselineWithQueryRunner(queryRunner, seedData)
    await queryRunner.commitTransaction()
    return summary
  } catch (error) {
    await queryRunner.rollbackTransaction()
    throw error
  } finally {
    await queryRunner.release()
  }
}
