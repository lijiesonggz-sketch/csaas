import { DataSource, QueryRunner } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ApplicabilityRuleSeedRecord, KgSeedData, loadKgSeedData } from './kg-seed-data'

export interface KgSeedSummary {
  controlPacks: number
  packFamilyMappings: number
  applicabilityRules: number
  demoProfiles: number
  expectedResults: number
  taxonomyL1: number
  taxonomyL2: number
  controlPoints: number
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
  const requiredTables = [
    'control_packs',
    'applicability_rules',
    'taxonomy_l1',
    'taxonomy_l2',
    'control_points',
  ]

  for (const table of requiredTables) {
    const exists = await queryRunner.hasTable(table)

    if (!exists) {
      throw new Error(`KG seed runner requires table ${table}; run migrations first`)
    }
  }

  const controlPackRepository = queryRunner.manager.getRepository(ControlPack)
  const applicabilityRuleRepository = queryRunner.manager.getRepository(ApplicabilityRule)
  const taxonomyL1Repository = queryRunner.manager.getRepository(TaxonomyL1)
  const taxonomyL2Repository = queryRunner.manager.getRepository(TaxonomyL2)
  const controlPointRepository = queryRunner.manager.getRepository(ControlPoint)

  await taxonomyL1Repository.upsert(
    seedData.taxonomyL1.map((taxonomy) => ({
      l1Code: taxonomy.l1Code,
      l1Name: taxonomy.l1Name,
      sortOrder: taxonomy.sortOrder,
      status: taxonomy.status,
    })),
    ['l1Code'],
  )

  await taxonomyL2Repository.upsert(
    seedData.taxonomyL2.map((taxonomy) => ({
      l2Code: taxonomy.l2Code,
      l1Code: taxonomy.l1Code,
      l2Name: taxonomy.l2Name,
      l2Desc: taxonomy.l2Desc ?? null,
      sortOrder: taxonomy.sortOrder,
      status: taxonomy.status,
    })),
    ['l2Code'],
  )

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

  await applicabilityRuleRepository.upsert(mapRules(seedData.applicabilityRules, packIdByCode), [
    'ruleCode',
  ])

  for (const controlPoint of seedData.controlPoints) {
    const existing = await controlPointRepository.findOne({
      where: { controlCode: controlPoint.controlCode },
    })

    if (existing && existing.controlId !== controlPoint.controlId) {
      throw new Error(
        `Control point ${controlPoint.controlCode} exists with mismatched controlId ${existing.controlId}`,
      )
    }

    await controlPointRepository.save(
      controlPointRepository.create({
        controlId: controlPoint.controlId,
        controlCode: controlPoint.controlCode,
        controlName: controlPoint.controlName,
        controlDesc: controlPoint.controlDesc ?? null,
        l1Code: controlPoint.l1Code,
        l2Code: controlPoint.l2Code,
        controlFamily: controlPoint.controlFamily,
        controlType: controlPoint.controlType,
        mandatoryDefault: controlPoint.mandatoryDefault,
        riskLevelDefault: controlPoint.riskLevelDefault,
        ownerRoleHint: controlPoint.ownerRoleHint ?? null,
        status: controlPoint.status,
      }),
    )
  }

  return {
    controlPacks: seedData.controlPacks.length,
    packFamilyMappings: seedData.packFamilyMappings.length,
    applicabilityRules: seedData.applicabilityRules.length,
    demoProfiles: seedData.demoProfiles.length,
    expectedResults: seedData.expectedResults.length,
    taxonomyL1: seedData.taxonomyL1.length,
    taxonomyL2: seedData.taxonomyL2.length,
    controlPoints: seedData.controlPoints.length,
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
