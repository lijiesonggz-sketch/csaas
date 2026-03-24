import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Test, TestingModule } from '@nestjs/testing'
import { Repository } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { OrganizationProfile } from '../../../database/entities/organization-profile.entity'
import {
  DemoProfileSeedRecord,
  loadKgSeedData,
  loadResolverRuntimeData,
  normalizeFixtureResolverRules,
} from '../seeds/kg-seed-data'
import { ApplicabilityEngineModule } from '../applicability-engine.module'
import { PackResolverService } from './pack-resolver.service'
import { RuleEvaluatorService } from './rule-evaluator.service'
import {
  NormalizedResolverRule,
  ResolvedControlSet,
} from '../types/applicability.types'

type MockRepository<T> = Partial<Record<keyof Repository<T>, jest.Mock>>

const seedData = loadKgSeedData()
const resolverRuntimeData = loadResolverRuntimeData()
const controlAssertionsByProfile = new Map(
  resolverRuntimeData.controlAssertions.map((assertion) => [assertion.profileCode, assertion] as const),
)

type PackResolverServiceWhiteBox = {
  resolveCore(
    profile: Record<string, unknown>,
    options: {
      profileCode?: string
      packRules?: NormalizedResolverRule[]
      controlRules?: NormalizedResolverRule[]
      runtimeData?: typeof resolverRuntimeData
      matchedPackCodes?: string[]
      skipProfileValidation?: boolean
    },
  ): Promise<ResolvedControlSet>
  loadActivePackRules(currentDate?: Date, timeZone?: string): Promise<NormalizedResolverRule[]>
}

function sortCodes(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function expectSeededControlAssertions(result: ResolvedControlSet, profileCode: string): void {
  const controlAssertions = controlAssertionsByProfile.get(profileCode)

  expect(controlAssertions).toBeDefined()

  const controlsByCode = new Map(
    result.controls.map((control) => [control.controlCode, control] as const),
  )

  for (const controlCode of controlAssertions!.mustContainControlCodes) {
    expect(controlsByCode.has(controlCode)).toBe(true)
  }

  for (const controlCode of controlAssertions!.mustHaveMandatoryControlCodes) {
    expect(controlsByCode.get(controlCode)?.mandatory).toBe(true)
  }

  for (const controlCode of controlAssertions!.mustHaveHighPriorityControlCodes) {
    expect(controlsByCode.get(controlCode)?.priority).toBe('HIGH')
  }

  for (const controlCode of controlAssertions!.mustExcludeControlCodes) {
    expect(controlsByCode.has(controlCode)).toBe(false)
  }
}

function toOrganizationProfileEntity(
  profile: DemoProfileSeedRecord['profile'],
  orgId: string,
): OrganizationProfile {
  return {
    orgId,
    industry: profile.industry,
    legalPersonType: profile.legalPersonType,
    assetBucket: profile.assetBucket,
    hasPersonalInfo: profile.hasPersonalInfo,
    crossBorderData: profile.crossBorderData,
    importantDataStatus: profile.importantDataStatus,
    ciioStatus: profile.ciioStatus,
    hasDatacenter: profile.hasDatacenter,
    usesCloud: profile.usesCloud,
    outsourcingLevel: profile.outsourcingLevel,
    criticalSystemLevel: profile.criticalSystemLevel,
    hasOnlineTrading: profile.hasOnlineTrading,
    hasAiServices: profile.hasAiServices,
    publicServiceScope: profile.publicServiceScope,
    regulatoryAttentionLevel: profile.regulatoryAttentionLevel,
    recentMajorIncident: profile.recentMajorIncident,
    updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    organization: undefined as never,
    extendedProfile: null,
  }
}

function createPackRepositoryState() {
  const packs = seedData.controlPacks.map((pack, index) => ({
    packId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    packCode: pack.packCode,
    packName: pack.packName,
    packType: pack.packType,
    maturityLevel: pack.maturityLevel,
    priority: pack.priority,
    description: pack.description,
    status: 'ACTIVE',
  }))

  const packIdByCode = new Map(packs.map((pack) => [pack.packCode, pack.packId] as const))

  const rules = seedData.applicabilityRules.map((rule) => ({
    ruleId: `10000000-0000-0000-0000-${String(
      seedData.applicabilityRules.findIndex((candidate) => candidate.ruleCode === rule.ruleCode) +
        1,
    ).padStart(12, '0')}`,
    ruleCode: rule.ruleCode,
    targetType: rule.targetType,
    targetId: packIdByCode.get(rule.targetCode)!,
    ruleType: rule.ruleType,
    predicateJson: rule.predicate,
    resultJson: rule.result ?? null,
    priority: rule.priority,
    effectiveFrom: rule.effectiveFrom ?? null,
    effectiveTo: rule.effectiveTo ?? null,
    status: rule.status ?? 'ACTIVE',
  }))

  return { packs, rules }
}

function createTestingMocks() {
  const { packs, rules } = createPackRepositoryState()

  const profileRepository: MockRepository<OrganizationProfile> = {
    findOne: jest.fn(),
  }
  const ruleRepository: MockRepository<ApplicabilityRule> = {
    find: jest.fn().mockResolvedValue(rules),
  }
  const packRepository: MockRepository<ControlPack> = {
    find: jest.fn().mockResolvedValue(packs),
  }

  return {
    profileRepository,
    ruleRepository,
    packRepository,
    packs,
    rules,
  }
}

async function createService() {
  const mocks = createTestingMocks()
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      PackResolverService,
      RuleEvaluatorService,
      {
        provide: getRepositoryToken(OrganizationProfile),
        useValue: mocks.profileRepository,
      },
      {
        provide: getRepositoryToken(ApplicabilityRule),
        useValue: mocks.ruleRepository,
      },
      {
        provide: getRepositoryToken(ControlPack),
        useValue: mocks.packRepository,
      },
    ],
  }).compile()

  return {
    service: moduleRef.get(PackResolverService),
    ruleEvaluator: moduleRef.get(RuleEvaluatorService),
    moduleRef,
    ...mocks,
  }
}

describe('PackResolverService', () => {
  it('should be exported by ApplicabilityEngineModule and expose both resolver entrypoints', async () => {
    const exportsMetadata =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, ApplicabilityEngineModule) ?? []
    const { service } = await createService()

    expect(exportsMetadata).toEqual(
      expect.arrayContaining([PackResolverService, RuleEvaluatorService]),
    )
    expect(service).toBeDefined()
    expect(typeof service.resolveByOrganizationId).toBe('function')
    expect(typeof service.resolveFromProfile).toBe('function')
  })

  it('should resolve all six demo profiles into the expected matched pack sets in alphabetical order', async () => {
    const { service } = await createService()

    for (const scenario of seedData.demoProfiles) {
      const expected = seedData.expectedResults.find(
        (candidate) => candidate.profileCode === scenario.profileCode,
      )

      const result = await service.resolveFromProfile(scenario.profile, {
        profileCode: scenario.profileCode,
      })

      const expectedPackCodes = sortCodes(expected?.matchedPackCodes ?? [])

      expect(result.matchedPacks).toEqual(expectedPackCodes)
      expect(result.matchedPacks).toEqual(sortCodes(result.matchedPacks))
      expect(result.summary.matchedPacks).toBe(expectedPackCodes.length)
    }
  })

  it('should resolveByOrganizationId through the production repository path and preserve story 1.4 contract', async () => {
    const { service, profileRepository } = await createService()
    const scenario = seedData.demoProfiles[0]
    const orgId = '00000000-0000-0000-0000-000000000114'

    profileRepository.findOne!.mockResolvedValue(toOrganizationProfileEntity(scenario.profile, orgId))

    const result = await service.resolveByOrganizationId(orgId)
    const expectedPackCodes = sortCodes(
      seedData.expectedResults.find((candidate) => candidate.profileCode === scenario.profileCode)
        ?.matchedPackCodes ?? [],
    )

    expect(profileRepository.findOne).toHaveBeenCalledWith({
      where: { orgId },
    })
    expect(result.matchedPacks).toEqual(expectedPackCodes)
    expect(result.summary.matchedPacks).toBe(expectedPackCodes.length)
    expect(result.debugLog[0]).toEqual(
      expect.objectContaining({
        ruleCode: expect.any(String),
        targetType: expect.any(String),
        targetCode: expect.any(String),
        ruleType: expect.any(String),
        matched: expect.any(Boolean),
        traceEntries: expect.any(Array),
        appliedEffect: expect.objectContaining({
          addedPackCodes: expect.any(Array),
          addedControlCodes: expect.any(Array),
          strengthenedControlCodes: expect.any(Array),
          excludedControlCodes: expect.any(Array),
        }),
      }),
    )
    expectSeededControlAssertions(result, scenario.profileCode)
  })

  it('should enforce seeded control assertions for all six demo profiles', async () => {
    const { service } = await createService()

    for (const scenario of seedData.demoProfiles) {
      const result = await service.resolveFromProfile(scenario.profile, {
        profileCode: scenario.profileCode,
      })

      expectSeededControlAssertions(result, scenario.profileCode)
    }
  })

  it('should throw NotFoundException when resolveByOrganizationId cannot find organization_profile', async () => {
    const { service, profileRepository } = await createService()
    profileRepository.findOne!.mockResolvedValue(null)

    await expect(
      service.resolveByOrganizationId('00000000-0000-0000-0000-000000000404'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('should throw BadRequestException when resolveFromProfile receives an invalid profile payload', async () => {
    const { service } = await createService()

    await expect(
      service.resolveFromProfile(
        {
          legalPersonType: 'legal_person',
          hasAiServices: false,
        } as unknown as DemoProfileSeedRecord['profile'],
        { profileCode: 'invalid-profile' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('should return an empty ResolvedControlSet with NO_ACTIVE_RULES debug entry when active rules are unavailable', async () => {
    const { service } = await createService()
    const whiteBoxService = service as unknown as PackResolverServiceWhiteBox

    const result = await whiteBoxService.resolveCore(
      seedData.demoProfiles[0].profile as unknown as Record<string, unknown>,
      {
        profileCode: seedData.demoProfiles[0].profileCode,
        packRules: [],
        controlRules: [],
        runtimeData: resolverRuntimeData,
        matchedPackCodes: [],
      },
    )

    expect(result).toMatchObject({
      matchedPacks: [],
      matchedRules: [],
      controls: [],
      summary: {
        totalControls: 0,
        mandatoryCount: 0,
        matchedPacks: 0,
        matchedRules: 0,
        excludedControls: 0,
      },
      debugLog: [
        expect.objectContaining({
          ruleCode: 'NO_ACTIVE_RULES',
        }),
      ],
    })
  })

  it('should merge strengthen rules into control effects and keep summary counters aligned with matched semantics', async () => {
    const { service } = await createService()

    const result = await service.resolveFromProfile(seedData.demoProfiles[0].profile, {
      profileCode: seedData.demoProfiles[0].profileCode,
    })

    expect(result.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlCode: 'CTRL-ACC-002',
          mandatory: true,
          priority: 'HIGH',
        }),
        expect.objectContaining({
          controlCode: 'CTRL-BCP-003',
          mandatory: true,
          priority: 'HIGH',
        }),
        expect.objectContaining({
          controlCode: 'CTRL-DG-004',
          mandatory: true,
          priority: 'HIGH',
        }),
      ]),
    )
    expect(result.summary.matchedRules).toBe(result.matchedRules.length)
    expect(result.summary.matchedPacks).toBe(result.matchedPacks.length)
  })

  it('should exclude AI controls with structured appliedEffect and excludedControls summary when PACK-SCENE-AI is pre-matched', async () => {
    const { service } = await createService()
    const whiteBoxService = service as unknown as PackResolverServiceWhiteBox

    const result = await whiteBoxService.resolveCore(
      {
        industry: 'bank',
        hasAiServices: false,
      },
      {
        profileCode: 'synthetic-ai-exclude',
        packRules: [],
        controlRules: normalizeFixtureResolverRules(resolverRuntimeData),
        runtimeData: resolverRuntimeData,
        matchedPackCodes: ['PACK-SCENE-AI'],
        skipProfileValidation: true,
      },
    )

    expect(
      result.controls.map((control: { controlCode: string }) => control.controlCode),
    ).not.toEqual(expect.arrayContaining(['CTRL-AI-001', 'CTRL-AI-002']))
    expect(result.summary.excludedControls).toBeGreaterThanOrEqual(2)
    expect(result.debugLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: 'RULE-CTRL-AI-EXCLUDE-NO-AI-001',
          matched: true,
          appliedEffect: expect.objectContaining({
            excludedControlCodes: expect.arrayContaining(['CTRL-AI-001', 'CTRL-AI-002']),
          }),
        }),
      ]),
    )
  })

  it('should keep matched no-op exclude rules in matchedRules and debugLog when no active target controls are present', async () => {
    const { service } = await createService()
    const whiteBoxService = service as unknown as PackResolverServiceWhiteBox

    const result = await whiteBoxService.resolveCore(
      {
        industry: 'insurance',
        ciioStatus: 'unknown',
        criticalSystemLevel: 'low',
        hasOnlineTrading: false,
        regulatoryAttentionLevel: 'low',
        crossBorderData: false,
        hasAiServices: false,
      },
      {
        profileCode: 'synthetic-exclude-noop',
        packRules: [],
        controlRules: normalizeFixtureResolverRules(resolverRuntimeData),
        runtimeData: resolverRuntimeData,
        matchedPackCodes: [],
        skipProfileValidation: true,
      },
    )

    expect(result.matchedPacks).toEqual([])
    expect(result.controls).toEqual([])
    expect(result.matchedRules).toContain('RULE-CTRL-AI-EXCLUDE-NO-AI-001')
    expect(result.summary.excludedControls).toBe(0)
    expect(result.debugLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleCode: 'RULE-CTRL-AI-EXCLUDE-NO-AI-001',
          matched: true,
          appliedEffect: expect.objectContaining({
            excludedControlCodes: [],
            noOpReason: 'matched but no active target controls removed',
          }),
        }),
      ]),
    )
  })

  it('should fail fast with a configuration error when a matched pack or family cannot expand into catalog controls', async () => {
    const { service } = await createService()
    const whiteBoxService = service as unknown as PackResolverServiceWhiteBox

    await expect(
      whiteBoxService.resolveCore(
        {
          industry: 'bank',
          hasAiServices: true,
        },
        {
          profileCode: 'config-error-pack',
          packRules: [],
          controlRules: normalizeFixtureResolverRules(resolverRuntimeData),
          runtimeData: resolverRuntimeData,
          matchedPackCodes: ['PACK-SCENE-AI', 'PACK-UNMAPPED-TEST'],
          skipProfileValidation: true,
        },
      ),
    ).rejects.toThrow(
      'Resolver configuration error: matched pack is missing family mapping or mapped controls',
    )
  })

  it('should evaluate effective date windows against the configured local timezone instead of UTC rollover', async () => {
    const { service, ruleRepository, rules } = await createService()
    const whiteBoxService = service as unknown as PackResolverServiceWhiteBox

    ruleRepository.find!.mockResolvedValue([
      {
        ...rules[0],
        effectiveFrom: '2026-03-24',
        effectiveTo: '2026-03-24',
      },
    ])

    const activeRules = await whiteBoxService.loadActivePackRules(
      new Date('2026-03-23T16:30:00.000Z'),
      'Asia/Shanghai',
    )

    expect(activeRules).toHaveLength(1)
    expect(activeRules[0].ruleCode).toBe(rules[0].ruleCode)
  })
})
