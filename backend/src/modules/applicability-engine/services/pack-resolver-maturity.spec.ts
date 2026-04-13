/**
 * ATDD Tests — Story 2.1: PackResolver maturity_level 过滤集成
 *
 * Acceptance Criteria covered:
 *   AC1: resolve-controls 只返回 hard/draft-hard 控制点
 *   AC3: 向后兼容 — ResolvedControl 包含 maturityLevel，旧数据默认 candidate 被过滤
 */
import { getRepositoryToken } from '@nestjs/typeorm'
import { Test, TestingModule } from '@nestjs/testing'
import { Repository } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { OrganizationProfile } from '../../../database/entities/organization-profile.entity'
import {
  loadResolverRuntimeData,
  ResolverRuntimeData,
} from '../seeds/kg-seed-data'
import { PackResolverService } from './pack-resolver.service'
import { RuleEvaluatorService } from './rule-evaluator.service'
import {
  NormalizedResolverRule,
  ResolvedControlSet,
  ResolverControlCatalogRecord,
} from '../types/applicability.types'

type PackResolverServiceWhiteBox = {
  resolveCore(
    profile: Record<string, unknown>,
    options: {
      profileCode?: string
      packRules?: NormalizedResolverRule[]
      controlRules?: NormalizedResolverRule[]
      runtimeData?: ResolverRuntimeData
      matchedPackCodes?: string[]
      skipProfileValidation?: boolean
    },
  ): Promise<ResolvedControlSet>
}

const baseRuntimeData = loadResolverRuntimeData()

// Build runtime data with custom maturity_level catalog entries
function makeRuntimeData(
  entries: Array<Partial<ResolverControlCatalogRecord> & { maturityLevel?: string }>,
): ResolverRuntimeData {
  // Build pack-family mapping: one pack that maps to the TEST family
  const packFamilyMappings = [
    { packCode: 'PACK-BASE-TEST', controlFamilies: ['TEST'] },
  ]

  const controlCatalog: ResolverControlCatalogRecord[] = entries.map((e, i) => ({
    controlId: e.controlId ?? `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
    controlCode: e.controlCode ?? `CTRL-TEST-${String(i + 1).padStart(3, '0')}`,
    controlName: e.controlName ?? `Test Control ${i + 1}`,
    controlFamily: e.controlFamily ?? 'TEST',
    mandatoryDefault: e.mandatoryDefault ?? false,
    priorityDefault: e.priorityDefault ?? 'MEDIUM',
    questionPackCodes: e.questionPackCodes ?? [],
    evidencePackCodes: e.evidencePackCodes ?? [],
    remediationPackCodes: e.remediationPackCodes ?? [],
    maturityLevel: e.maturityLevel,
  }))

  return {
    ...baseRuntimeData,
    controlCatalog,
    packFamilyMappings,
  } as ResolverRuntimeData
}

const MINIMAL_PROFILE: Record<string, unknown> = {
  industry: '银行',
  legalPersonType: 'corporation',
  assetBucket: 'large',
  hasPersonalInfo: true,
  crossBorderData: false,
  importantDataStatus: 'yes',
  ciioStatus: 'ciio',
  hasDatacenter: true,
  usesCloud: false,
  outsourcingLevel: 'none',
  criticalSystemLevel: 'level3',
  hasOnlineTrading: false,
  hasAiServices: false,
  publicServiceScope: 'none',
  regulatoryAttentionLevel: 'normal',
  recentMajorIncident: false,
}

async function createService(): Promise<{ service: PackResolverServiceWhiteBox }> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      PackResolverService,
      RuleEvaluatorService,
      { provide: getRepositoryToken(OrganizationProfile), useValue: { findOne: jest.fn() } },
      { provide: getRepositoryToken(ApplicabilityRule), useValue: { find: jest.fn().mockResolvedValue([]) } },
      { provide: getRepositoryToken(ControlPack), useValue: { find: jest.fn().mockResolvedValue([]) } },
    ],
  }).compile()

  return { service: moduleRef.get(PackResolverService) as unknown as PackResolverServiceWhiteBox }
}

describe('[Story 2.1 ATDD] PackResolver maturity_level 过滤', () => {
  let service: PackResolverServiceWhiteBox

  beforeEach(async () => {
    const svc = await createService()
    service = svc.service
  })

  // T01 — AC1: hard 控制点出现在结果中
  it('[T01][P0] 应该保留 maturity_level=hard 的控制点', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-HARD-001', maturityLevel: 'hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    expect(result.controls.some((c) => c.controlCode === 'CTRL-HARD-001')).toBe(true)
  })

  // T02 — AC1: candidate 控制点不出现在结果中
  it('[T02][P0] 应该过滤掉 maturity_level=candidate 的控制点', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-CAND-001', maturityLevel: 'candidate' },
      { controlCode: 'CTRL-HARD-001', maturityLevel: 'hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    expect(result.controls.some((c) => c.controlCode === 'CTRL-CAND-001')).toBe(false)
    expect(result.controls.some((c) => c.controlCode === 'CTRL-HARD-001')).toBe(true)
  })

  // T03 — AC1: retired 控制点不出现在结果中
  it('[T03][P0] 应该过滤掉 maturity_level=retired 的控制点', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-RET-001', maturityLevel: 'retired' },
      { controlCode: 'CTRL-HARD-001', maturityLevel: 'hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    expect(result.controls.some((c) => c.controlCode === 'CTRL-RET-001')).toBe(false)
  })

  // T04 — AC3: ResolvedControl 包含 maturityLevel 字段
  it('[T04][P0] ResolvedControl 应该包含 maturityLevel 字段', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-HARD-001', maturityLevel: 'hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    const hardControl = result.controls.find((c) => c.controlCode === 'CTRL-HARD-001')
    expect(hardControl).toBeDefined()
    expect(hardControl!.maturityLevel).toBe('hard')
  })

  // T05 — AC3: 旧数据(无 maturityLevel)默认 candidate 被过滤
  it('[T05][P1] 没有 maturityLevel 的控制点应该默认为 candidate 并被过滤', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-NO-ML-001' }, // no maturityLevel
      { controlCode: 'CTRL-HARD-001', maturityLevel: 'hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    expect(result.controls.some((c) => c.controlCode === 'CTRL-NO-ML-001')).toBe(false)
    expect(result.controls.some((c) => c.controlCode === 'CTRL-HARD-001')).toBe(true)
  })

  // T10 — AC1: draft-hard 控制点应该出现在结果中
  it('[T10][P0] 应该保留 maturity_level=draft-hard 的控制点', async () => {
    const rt = makeRuntimeData([
      { controlCode: 'CTRL-DH-001', maturityLevel: 'draft-hard' },
    ])

    const result = await service.resolveCore(MINIMAL_PROFILE, {
      runtimeData: rt,
      matchedPackCodes: ['PACK-BASE-TEST'],
      skipProfileValidation: true,
    })

    expect(result.controls.some((c) => c.controlCode === 'CTRL-DH-001')).toBe(true)
  })
})
