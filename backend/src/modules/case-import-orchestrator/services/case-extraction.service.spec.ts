import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { ClassificationTelemetryService } from './classification-telemetry.service'
import { CaseExtractionService } from './case-extraction.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { ComplianceCaseClassificationRunService } from './compliance-case-classification-run.service'
import { RuntimeDomainSelectorService } from './runtime-domain-selector.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { TaxonomyClassifierService } from './taxonomy-classification/taxonomy-classifier.service'
import { CaseNormalizationService } from './taxonomy-classification/case-normalization.service'
import { TypeOrmBackedMappingRepository } from './taxonomy-classification/typeorm-backed-mapping.repository'
import { TaxonomyClassifierEngine } from './taxonomy-classification/taxonomy-classifier.engine'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'

describe('CaseExtractionService', () => {
  let service: CaseExtractionService

  const complianceCaseRepository = {
    find: jest.fn(),
    save: jest.fn(),
  }

  const regulationClauseRepository = {
    find: jest.fn(),
  }

  const caseThemeIntelligenceService = {
    refineViolationThemes: jest.fn(),
  }

  const taxonomyClassifierService = {
    classifyCaseText: jest.fn(),
  }

  const runtimeDomainSelectorService = {
    getSupportedDomains: jest.fn(),
  }

  const classificationRunService = {
    appendRunAndRefreshLatest: jest.fn(),
  }

  const classificationTelemetryService = {
    publishLatestSnapshotWritten: jest.fn(),
  }

  const caseNormalizationService = {
    normalize: jest.fn(),
  }

  const domainRolloutPolicyService = {
    resolvePolicyDecision: jest.fn(),
  }

  const failureModeService = {
    findByL2Code: jest.fn(),
  }

  const caseClusteringChainService = {
    resolveControlPointsByL2Code: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseExtractionService,
        {
          provide: getRepositoryToken(ComplianceCase),
          useValue: complianceCaseRepository,
        },
        {
          provide: getRepositoryToken(RegulationClause),
          useValue: regulationClauseRepository,
        },
        {
          provide: CaseThemeIntelligenceService,
          useValue: caseThemeIntelligenceService,
        },
        {
          provide: TaxonomyClassifierService,
          useValue: taxonomyClassifierService,
        },
        {
          provide: RuntimeDomainSelectorService,
          useValue: runtimeDomainSelectorService,
        },
        {
          provide: ComplianceCaseClassificationRunService,
          useValue: classificationRunService,
        },
        {
          provide: ClassificationTelemetryService,
          useValue: classificationTelemetryService,
        },
        {
          provide: CaseNormalizationService,
          useValue: caseNormalizationService,
        },
        {
          provide: DomainRolloutPolicyService,
          useValue: domainRolloutPolicyService,
        },
        {
          provide: FailureModeService,
          useValue: failureModeService,
        },
        {
          provide: CaseClusteringChainService,
          useValue: caseClusteringChainService,
        },
      ],
    }).compile()

    service = module.get(CaseExtractionService)
    jest.clearAllMocks()
    caseThemeIntelligenceService.refineViolationThemes.mockResolvedValue(null)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    caseNormalizationService.normalize.mockReturnValue({
      rawText: 'normalized input',
      caseFacts: null,
      penaltyReason: null,
      mergedText: 'normalized input',
      normalizedText: 'normalizedinput',
      normalizedTokens: ['normalized', 'input'],
      normalizedPhrases: [],
    })
    failureModeService.findByL2Code.mockResolvedValue({
      items: [{ failureModeCode: 'FM-DEFAULT' }],
    })
    caseClusteringChainService.resolveControlPointsByL2Code.mockResolvedValue({
      items: [{ controlCode: 'CTRL-DEFAULT' }],
      total: 1,
    })
    taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT04',
      l2Code: null,
      l2Name: null,
      score: 0,
      confidenceScore: 0,
      scoreGap: 0,
      decisionSource: 'none',
      matchedSignals: [],
      matchedPhrases: [],
      matchedTokens: [],
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'UNCLASSIFIED',
      failureSemantics: 'NO_MATCH',
    })
    domainRolloutPolicyService.resolvePolicyDecision.mockImplementation(
      async ({
        l1Code,
        classifierResult,
        primaryExecutability,
      }: {
        l1Code: string
        classifierResult: {
          classifierVersion: string
          failureSemantics: string | null
          pathDecision: 'PRIMARY_CHAIN' | 'LEGACY_FALLBACK' | 'ABSTAIN' | 'UNCLASSIFIED'
        }
        primaryExecutability: { isExecutable: boolean }
      }) => ({
        policy: {
          l1Code,
          rolloutState: 'domain-primary',
          allowLegacyFallback: true,
          primaryThreshold: 0.7,
          shadowWindowDays: 14,
          killSwitchEnabled: false,
          activeClassifierVersion: classifierResult.classifierVersion,
        },
        rolloutState: 'domain-primary',
        stateAllowsPrimary: true,
        pathDecision:
          classifierResult.pathDecision === 'PRIMARY_CHAIN' && primaryExecutability.isExecutable
            ? 'PRIMARY_CHAIN'
            : classifierResult.pathDecision,
        failureSemantic:
          classifierResult.pathDecision === 'PRIMARY_CHAIN' && !primaryExecutability.isExecutable
            ? 'MAPPING_MISSING'
            : classifierResult.failureSemantics,
        primaryExecutability,
        reason: 'test-double',
      }),
    )
    classificationRunService.appendRunAndRefreshLatest.mockResolvedValue(undefined)
    classificationTelemetryService.publishLatestSnapshotWritten.mockResolvedValue(undefined)
  })

  it('should extract violation themes and clause candidates for pending cases without blocking on unclassified snapshot outcomes', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-1',
        importBatchId: 'batch-1',
        status: 'pending',
        penaltyReason: '客户身份识别不到位；反洗钱监测缺失',
        caseFacts: '未及时上报可疑交易',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([
      {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        clauseSummary: '客户身份识别要求',
        clauseText: '机构应加强客户身份识别和尽职调查',
        keywords: ['客户身份识别', '尽职调查'],
      },
      {
        clauseId: 'clause-2',
        clauseCode: 'CLAUSE-002',
        clauseSummary: '可疑交易报告',
        clauseText: '机构应及时上报可疑交易',
        keywords: ['可疑交易', '及时上报'],
      },
    ])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.extractBatch('batch-1')

    expect(result).toEqual({
      batchId: 'batch-1',
      processedCount: 1,
      skippedCount: 0,
    })
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'extracted',
        l1Code: null,
        l2Code: null,
        confidenceScore: null,
        classificationSource: 'none',
        classificationVersion: 'taxonomy-classifier-6.3',
        fallbackReason: 'NO_MATCH',
        violationThemes: expect.arrayContaining([
          '客户身份识别不到位',
          '反洗钱监测缺失',
          '未及时上报可疑交易',
        ]),
        clauseCandidates: expect.arrayContaining([
          expect.objectContaining({
            clauseCode: 'CLAUSE-001',
          }),
          expect.objectContaining({
            clauseCode: 'CLAUSE-002',
          }),
        ]),
        extractedAt: expect.any(Date),
      }),
    )
  })

  it('should avoid saving procedural phrases as violation themes', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-2',
        importBatchId: 'batch-2',
        status: 'pending',
        caseFacts:
          '你公司在尽职调查过程中，对发行人对外担保相关内部控制运行情况核查有效性不足，对发行人对外担保信息披露准确性督促不到位',
        penaltyReason:
          '根据《公司债券发行与交易管理办法》等规定，我局近期对你公司开展了相关债券承销业务专项检查；违反了《公司债券发行与交易管理办法》第七条的有关规定',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)

    await service.extractBatch('batch-2')

    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        violationThemes: expect.arrayContaining([
          '发行人对外担保内部控制核查有效性不足',
          '发行人对外担保信息披露准确性督促不到位',
        ]),
      }),
    )
    expect(complianceCaseRepository.save).not.toHaveBeenCalledWith(
      expect.objectContaining({
        violationThemes: expect.arrayContaining(['你公司在尽职调查过程中']),
      }),
    )
  })

  it('should preserve extraction snapshot outputs when classifier is backed by hydrated runtime profile data', async () => {
    const runtimeProfileRepository = {
      find: jest.fn().mockResolvedValue([
        {
          l2Code: 'IT04-10',
          definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
          canonicalTheme: '信息登记与更新管理',
          aliasesJson: ['信息登记', '录入更新', '维护及时性'],
          keywordsJson: ['录入不及时', '更新不及时', '补录'],
          sourceVersion: '2026-04-07',
          taxonomyL2: {
            l2Code: 'IT04-10',
            l1Code: 'IT04',
            l2Name: '信息登记/录入/更新不及时不规范',
            parent: {
              l1Code: 'IT04',
              l1Name: '数据治理与监管数据报送',
            },
          },
        },
      ]),
    }
    const dbBackedRepository = new TypeOrmBackedMappingRepository(runtimeProfileRepository as never)
    await dbBackedRepository.refreshCache()
    const realClassifier = new TaxonomyClassifierService(
      new CaseNormalizationService(),
      dbBackedRepository,
      new TaxonomyClassifierEngine(),
    )

    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-db-backed-1',
        importBatchId: 'batch-db-backed-1',
        status: 'pending',
        penaltyReason: '监管登记信息补录和更新没有时效监控',
        caseFacts: '补录超期且无人催办，导致信息更新不及时不规范',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    taxonomyClassifierService.classifyCaseText.mockImplementation((request) =>
      realClassifier.classifyCaseText(request),
    )

    domainRolloutPolicyService.resolvePolicyDecision.mockResolvedValue({
      policy: {
        l1Code: 'IT04',
        rolloutState: 'domain-primary',
        allowLegacyFallback: true,
        primaryThreshold: 0.7,
        shadowWindowDays: 14,
        killSwitchEnabled: false,
        activeClassifierVersion: 'taxonomy-classifier-6.3',
      },
      rolloutState: 'domain-primary',
      stateAllowsPrimary: true,
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantic: null,
      primaryExecutability: {
        failureModeCount: 1,
        controlCandidateCount: 1,
        isExecutable: true,
        reason: 'READY',
      },
      reason: 'test-double',
    })

    const result = await service.extractBatch('batch-db-backed-1')

    expect(result.processedCount).toBe(1)
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        confidenceScore: '9.0000',
        classificationSource: 'rule',
        classificationVersion: 'taxonomy-classifier-6.3',
        fallbackReason: null,
      }),
    )
  })

  it('should fan out across supported runtime domains and persist the strongest primary snapshot instead of hardcoding IT04', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-3',
        importBatchId: 'batch-3',
        status: 'pending',
        regulatorCode: 'NFRA',
        industry: 'banking',
        caseFacts: '运维人员通过后台直接修改核心业务系统数据，绕过前台控制且没有形成可审计留痕。',
        penaltyReason: '后台修改核心业务数据、越权操作和留痕缺失。',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT02', 'IT07'])
    taxonomyClassifierService.classifyCaseText.mockImplementation(
      ({ preferredL1Code }: { preferredL1Code: string }) => {
        if (preferredL1Code === 'IT07') {
          return {
            l1Code: 'IT07',
            l2Code: 'IT07-06',
            l2Name: '核心业务系统数据被后台修改/篡改',
            score: 9,
            confidenceScore: 0.92,
            scoreGap: 4,
            decisionSource: 'rule',
            matchedSignals: ['后台直接修改', '绕过前台控制'],
            matchedPhrases: ['后台直接修改核心业务系统数据', '绕过前台控制'],
            matchedTokens: ['后台', '修改'],
            classifierVersion: 'taxonomy-classifier-6.3',
            mappingVersion: '2026-04-07',
            rulebookVersion: 'it07-rulebook-v1',
            classifiedAt: new Date().toISOString(),
            pathDecision: 'PRIMARY_CHAIN',
            failureSemantics: null,
          }
        }

        return {
          l1Code: preferredL1Code,
          l2Code: null,
          l2Name: null,
          score: 0,
          confidenceScore: 0,
          scoreGap: 0,
          decisionSource: 'none',
          matchedSignals: [],
          matchedPhrases: [],
          matchedTokens: [],
          classifierVersion: 'taxonomy-classifier-6.3',
          mappingVersion: '2026-04-07',
          rulebookVersion: 'it02-rulebook-v1',
          classifiedAt: new Date().toISOString(),
          pathDecision: 'UNCLASSIFIED',
          failureSemantics: 'NO_MATCH',
        }
      },
    )

    await service.extractBatch('batch-3')

    expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith(
      expect.objectContaining({ preferredL1Code: 'IT02' }),
    )
    expect(taxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith(
      expect.objectContaining({ preferredL1Code: 'IT07' }),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT07',
        l2Code: 'IT07-06',
        confidenceScore: '0.9200',
        classificationSource: 'rule',
        classificationVersion: 'taxonomy-classifier-6.3',
        fallbackReason: null,
        status: 'extracted',
      }),
    )
    expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-3',
        pathDecision: 'PRIMARY_CHAIN',
        classificationStatus: 'SUCCEEDED',
        fallbackReason: null,
        decisionTrace: expect.objectContaining({
          chosenDomain: 'IT07',
        }),
      }),
    )
  })

  it('should persist classifier confidenceScore instead of raw score when the two diverge', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-4',
        importBatchId: 'batch-4',
        status: 'pending',
        caseFacts: '监管登记信息补录和更新没有时效监控。',
        penaltyReason: '导致信息更新不及时不规范。',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      l2Name: '信息登记/录入/更新不及时不规范',
      score: 9,
      confidenceScore: 0.875,
      scoreGap: 5,
      decisionSource: 'rule',
      matchedSignals: ['登记录入更新', '更新不及时'],
      matchedPhrases: ['登记录入更新', '更新不及时'],
      matchedTokens: [],
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    })

    await service.extractBatch('batch-4')

    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        confidenceScore: '0.8750',
        classificationSource: 'rule',
        classificationVersion: 'taxonomy-classifier-6.3',
      }),
    )
  })

  it('should keep extraction batch progressing and normalize engine errors to PENDING_RECLASSIFY without changing ComplianceCase.status semantics', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-5',
        importBatchId: 'batch-5',
        status: 'pending',
        caseFacts: '监管登记信息补录和更新没有时效监控。',
        penaltyReason: '导致信息更新不及时不规范。',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT04',
      l2Code: null,
      l2Name: null,
      score: 0,
      confidenceScore: 0,
      scoreGap: 0,
      decisionSource: 'none',
      matchedSignals: [],
      matchedPhrases: [],
      matchedTokens: [],
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'UNCLASSIFIED',
      failureSemantics: 'ENGINE_ERROR',
    })

    const result = await service.extractBatch('batch-5')

    expect(result).toEqual({
      batchId: 'batch-5',
      processedCount: 1,
      skippedCount: 0,
    })
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: null,
        l2Code: null,
        confidenceScore: null,
        classificationSource: 'none',
        classificationVersion: 'taxonomy-classifier-6.3',
        fallbackReason: 'PENDING_RECLASSIFY',
        status: 'extracted',
      }),
    )
    expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-5',
        pathDecision: 'UNCLASSIFIED',
        classificationStatus: 'FAILED',
        fallbackReason: 'PENDING_RECLASSIFY',
      }),
    )
  })

  it('should preserve classification run trace when telemetry publishing fails after DB persistence', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-6',
        importBatchId: 'batch-6',
        status: 'pending',
        caseFacts: '监管登记信息补录和更新没有时效监控。',
        penaltyReason: '导致信息更新不及时不规范。',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    runtimeDomainSelectorService.getSupportedDomains.mockReturnValue(['IT04'])
    taxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      l2Name: '信息登记/录入/更新不及时不规范',
      score: 9,
      confidenceScore: 0.875,
      scoreGap: 5,
      decisionSource: 'rule',
      matchedSignals: ['登记录入更新'],
      matchedPhrases: ['登记录入更新'],
      matchedTokens: [],
      classifierVersion: 'taxonomy-classifier-6.3',
      mappingVersion: '2026-04-07',
      rulebookVersion: 'it04-rulebook-v1',
      classifiedAt: new Date().toISOString(),
      pathDecision: 'PRIMARY_CHAIN',
      failureSemantics: null,
    })
    classificationTelemetryService.publishLatestSnapshotWritten.mockRejectedValue(
      new Error('telemetry sink unavailable'),
    )

    const result = await service.extractBatch('batch-6')

    expect(result.processedCount).toBe(1)
    expect(classificationRunService.appendRunAndRefreshLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-6',
        pathDecision: 'PRIMARY_CHAIN',
      }),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        status: 'extracted',
      }),
    )
  })
})
