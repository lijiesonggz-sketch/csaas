import * as fs from 'fs'
import * as path from 'path'
import { DataSource, QueryRunner } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { FailureMode, FailureModeCategory } from '../../../database/entities/failure-mode.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { ApplicabilityRuleSeedRecord, KgSeedData, loadKgSeedData } from './kg-seed-data'

export interface RetireSummary {
  retiredCount: number
  cleanedControlPackItems: number
  cleanedClauseControlMaps: number
  cleanedCaseControlMaps: number
  cleanedQuestionItems: number
  cleanedRemediationActions: number
}

export interface FmSeedSummary {
  failureModes: number
  taxonomyFmMaps: number
}

export interface KgSeedSummary {
  controlPacks: number
  packFamilyMappings: number
  applicabilityRules: number
  demoProfiles: number
  expectedResults: number
  taxonomyL1: number
  taxonomyL2: number
  controlPoints: number
  retireSummary?: RetireSummary
  fmSummary?: FmSeedSummary
}

const RETIRE_REASON = 'KG V2 重构全量替换'

/**
 * 退役所有非 retired 的控制点，并清理关联子表。
 * 必须在 QueryRunner 事务内调用，由调用方管理事务生命周期。
 *
 * 执行顺序（FK RESTRICT 安全）：
 * 1. 查询所有非 retired 控制点 ID
 * 2. 清理 5 张子表（先删子表再更新主表）
 * 3. 更新主表 control_points 设置 maturity_level = 'retired'
 *
 * 幂等性：只处理 maturity_level != 'retired' 的控制点，
 * 重复运行时若全部已退役，返回全零统计。
 */
export async function retireLegacyControlPoints(
  queryRunner: QueryRunner,
): Promise<RetireSummary> {
  // Step 1: 查询所有非 retired 的控制点 ID
  const oldControlRows: Array<{ control_id: string }> = await queryRunner.query(
    `SELECT control_id FROM control_points WHERE maturity_level != 'retired'`,
  )

  const ids = oldControlRows.map((row) => row.control_id)

  // 幂等：如果没有任何非 retired 控制点，直接返回全零
  if (ids.length === 0) {
    return {
      retiredCount: 0,
      cleanedControlPackItems: 0,
      cleanedClauseControlMaps: 0,
      cleanedCaseControlMaps: 0,
      cleanedQuestionItems: 0,
      cleanedRemediationActions: 0,
    }
  }

  // Step 2: 清理子表（按 FK 约束安全顺序）— RETURNING 确保统计准确
  const cleanedControlPackItems = (await queryRunner.query(
    `DELETE FROM control_pack_items WHERE control_id = ANY($1) RETURNING 1`,
    [ids],
  )).length

  const cleanedClauseControlMaps = (await queryRunner.query(
    `DELETE FROM clause_control_maps WHERE control_id = ANY($1) RETURNING 1`,
    [ids],
  )).length

  const cleanedCaseControlMaps = (await queryRunner.query(
    `DELETE FROM case_control_maps WHERE control_id = ANY($1) RETURNING 1`,
    [ids],
  )).length

  const cleanedQuestionItems = (await queryRunner.query(
    `DELETE FROM question_items WHERE control_id = ANY($1) RETURNING 1`,
    [ids],
  )).length

  const cleanedRemediationActions = (await queryRunner.query(
    `DELETE FROM remediation_actions WHERE control_id = ANY($1) RETURNING 1`,
    [ids],
  )).length

  // Step 3: 更新主表（子表已清理完毕，FK RESTRICT 不再阻止）
  const retiredCount = (await queryRunner.query(
    `UPDATE control_points
     SET maturity_level = 'retired',
         retired_reason = $1
     WHERE control_id = ANY($2)
     RETURNING 1`,
    [RETIRE_REASON, ids],
  )).length

  return {
    retiredCount,
    cleanedControlPackItems,
    cleanedClauseControlMaps,
    cleanedCaseControlMaps,
    cleanedQuestionItems,
    cleanedRemediationActions,
  }
}

/**
 * 种子数据类型（failure mode 相关）
 */
interface FailureModeSeedRecord {
  failureModeCode: string
  name: string
  description: string
  category: string
  domain: string
}

interface TaxonomyFmMapSeedRecord {
  failureModeCode: string
  l2Code: string
}

const SEED_DATA_DIR = path.resolve(__dirname, 'data')

/**
 * 插入 8 域 failure mode 种子数据及 taxonomy 映射。
 * 必须在 QueryRunner 事务内调用，由调用方管理事务生命周期。
 *
 * 执行顺序：
 * 1. Upsert failure_modes 记录（ON CONFLICT DO UPDATE on failure_mode_code）
 * 2. 查询已持久化的 failure_mode_id（用于 FK 映射）
 * 3. 使用原生 SQL upsert taxonomy_failure_mode_maps（ON CONFLICT on l2_code + failure_mode_id）
 *
 * 幂等性：基于 ON CONFLICT DO UPDATE，重复运行不报错、不重复数据。
 */
export async function seedFailureModes(
  queryRunner: QueryRunner,
  fmRecords?: FailureModeSeedRecord[],
  mapRecords?: TaxonomyFmMapSeedRecord[],
): Promise<FmSeedSummary> {
  // Load seed data from JSON files if not provided
  const fmData =
    fmRecords ??
    (JSON.parse(
      fs.readFileSync(path.join(SEED_DATA_DIR, 'failure-mode.seed.json'), 'utf8'),
    ) as FailureModeSeedRecord[])

  const mapData =
    mapRecords ??
    (JSON.parse(
      fs.readFileSync(path.join(SEED_DATA_DIR, 'taxonomy-fm-map.seed.json'), 'utf8'),
    ) as TaxonomyFmMapSeedRecord[])

  // Step 1: Upsert failure_modes records
  const fmRepository = queryRunner.manager.getRepository(FailureMode)

  await fmRepository.upsert(
    fmData.map((fm) => ({
      failureModeCode: fm.failureModeCode,
      name: fm.name,
      description: fm.description,
      category: fm.category as FailureModeCategory,
      status: 'ACTIVE' as const,
    })),
    ['failureModeCode'],
  )

  // Step 2: Query persisted failure_mode_ids for mapping
  const persistedFms: Array<{ failure_mode_id: string; failure_mode_code: string }> =
    await queryRunner.query(
      `SELECT failure_mode_id, failure_mode_code FROM failure_modes WHERE failure_mode_code = ANY($1)`,
      [fmData.map((fm) => fm.failureModeCode)],
    )

  const fmIdByCode = new Map(persistedFms.map((fm) => [fm.failure_mode_code, fm.failure_mode_id]))

  // Step 3: Batch upsert taxonomy_failure_mode_maps using UNNEST (composite conflict target)
  const batchMaps = mapData
    .map((map) => ({
      l2Code: map.l2Code,
      failureModeId: fmIdByCode.get(map.failureModeCode),
    }))
    .filter((m): m is { l2Code: string; failureModeId: string } => !!m.failureModeId)

  if (batchMaps.length > 0) {
    await queryRunner.query(
      `INSERT INTO taxonomy_failure_mode_maps (id, l2_code, failure_mode_id, created_at, updated_at)
       SELECT gen_random_uuid(), unnest($1::varchar[]), unnest($2::uuid[]), now(), now()
       ON CONFLICT (l2_code, failure_mode_id) DO UPDATE SET updated_at = now()`,
      [batchMaps.map((m) => m.l2Code), batchMaps.map((m) => m.failureModeId)],
    )
  }

  return {
    failureModes: fmData.length,
    taxonomyFmMaps: batchMaps.length,
  }
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

  // ── Retire step: retire legacy control points BEFORE upserting new seed data ──
  const retireSummary = await retireLegacyControlPoints(queryRunner)

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
        aliases: controlPoint.aliases ?? null,
        keywords: controlPoint.keywords ?? null,
        canonicalTheme: controlPoint.canonicalTheme ?? null,
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

  // ── Failure Mode seed step: upsert failure modes + taxonomy maps (after retire) ──
  const fmSummary = await seedFailureModes(queryRunner)

  return {
    controlPacks: seedData.controlPacks.length,
    packFamilyMappings: seedData.packFamilyMappings.length,
    applicabilityRules: seedData.applicabilityRules.length,
    demoProfiles: seedData.demoProfiles.length,
    expectedResults: seedData.expectedResults.length,
    taxonomyL1: seedData.taxonomyL1.length,
    taxonomyL2: seedData.taxonomyL2.length,
    controlPoints: seedData.controlPoints.length,
    retireSummary,
    fmSummary,
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
