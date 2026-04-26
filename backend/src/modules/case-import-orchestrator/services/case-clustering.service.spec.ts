import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { FailureModeService } from '../../knowledge-graph/services/failure-mode.service'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { CaseClusteringService } from './case-clustering.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { ComplianceCaseClassificationRunService } from './compliance-case-classification-run.service'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'
import { LegacyCaseThemeFallbackService } from './legacy-case-theme-fallback.service'

describe('CaseClusteringService', () => {
  let service: CaseClusteringService

  const complianceCaseRepository = {
    find: jest.fn(),
    save: jest.fn(),
  }

  const controlPointRepository = {
    find: jest.fn(),
  }

  const caseControlMapRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const caseThemeIntelligenceService = {
    suggestMappings: jest.fn(),
  }

  const caseClusteringChainService = {
    mapCaseToControlPoints: jest.fn(),
    clearCache: jest.fn(),
  }

  const classificationRunService = {
    findLatestRun: jest.fn().mockResolvedValue({
      decisionTraceJson: {
        policySnapshot: {
          allowLegacyFallback: true,
        },
      },
    }),
  }

  const domainRolloutPolicyService = {
    shouldAllowLegacyFallback: jest.fn().mockResolvedValue(true),
  }

  const legacyCaseThemeFallbackService = {
    processLegacyFallback: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseClusteringService,
        {
          provide: getRepositoryToken(ComplianceCase),
          useValue: complianceCaseRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: getRepositoryToken(CaseControlMap),
          useValue: caseControlMapRepository,
        },
        {
          provide: CaseThemeIntelligenceService,
          useValue: caseThemeIntelligenceService,
        },
        {
          provide: CaseClusteringChainService,
          useValue: caseClusteringChainService,
        },
        {
          provide: ComplianceCaseClassificationRunService,
          useValue: classificationRunService,
        },
        {
          provide: DomainRolloutPolicyService,
          useValue: domainRolloutPolicyService,
        },
        {
          provide: LegacyCaseThemeFallbackService,
          useValue: legacyCaseThemeFallbackService,
        },
      ],
    }).compile()

    service = module.get(CaseClusteringService)
    jest.clearAllMocks()
    caseThemeIntelligenceService.suggestMappings.mockResolvedValue(null)
    legacyCaseThemeFallbackService.processLegacyFallback.mockResolvedValue({
      normalizedThemes: [],
      candidateControlPoints: [],
      autoMappings: [],
      llmTriggered: false,
      llmAssisted: false,
      llmFallbackUsed: false,
      unmapped: false,
    })
    // Default: new chain returns fallback (no mapping)
    caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
      autoMappedCount: 0,
      shouldFallback: true,
      source: 'FAILURE_MODE_CHAIN',
      writtenMappings: [],
    })
  })

  // ===========================================================================
  // Existing tests (preserved, adapted for new chain)
  // ===========================================================================

  it('should normalize themes, create mapping drafts, and keep unmatched control point candidates', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-1',
        importBatchId: 'batch-1',
        status: 'extracted',
        l2Code: null,
        violationThemes: ['客户身份识别不到位', '交易监测缺失'],
      },
    ])
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-1',
        controlCode: 'CP-001',
        controlName: 'AML KYC Control',
        controlDesc: '覆盖客户身份识别、反洗钱监测和尽职调查要求',
        controlFamily: 'GOV_RISK',
        aliases: ['客户身份识别管理'],
        keywords: ['客户身份识别', '反洗钱'],
        canonicalTheme: '反洗钱管理',
        status: 'ACTIVE',
      },
    ])
    caseControlMapRepository.findOne.mockResolvedValue(null)
    caseControlMapRepository.create.mockImplementation((entity) => entity)
    caseControlMapRepository.save.mockImplementation(async (entity) => entity)
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)

    legacyCaseThemeFallbackService.processLegacyFallback.mockResolvedValueOnce({
      normalizedThemes: ['反洗钱管理', '交易监测'],
      candidateControlPoints: [
        {
          controlName: '交易监测',
          sourceTheme: '交易监测',
          confidenceScore: 0.65,
          reason: '关键词匹配',
        },
      ],
      autoMappings: [
        {
          controlId: 'control-1',
          confidenceScore: 0.8,
          source: 'RULE',
        },
      ],
      llmTriggered: false,
      llmAssisted: false,
      llmFallbackUsed: false,
      unmapped: false,
    })

    const result = await service.clusterBatch('batch-1')

    expect(legacyCaseThemeFallbackService.processLegacyFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: undefined,
        violationThemes: ['客户身份识别不到位', '交易监测缺失'],
        allowLegacyFallback: true,
      }),
    )

    expect(result).toEqual({
      batchId: 'batch-1',
      processedCount: 1,
      skippedCount: 0,
      ruleMappedCaseCount: 1,
      llmTriggeredCaseCount: 0,
      llmAssistedRuleCaseCount: 0,
      llmFallbackCaseCount: 0,
      llmUnmappedCaseCount: 0,
      unmappedCaseCount: 0,
      ruleMapCount: 1,
      llmAssistedRuleMapCount: 0,
      llmFallbackMapCount: 0,
      chainMappedCaseCount: 0,
      chainMapCount: 0,
      fallbackToOldChainCount: 1,
    })
    expect(caseControlMapRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        controlId: 'control-1',
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
      }),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'clustered',
        normalizedThemes: expect.arrayContaining(['反洗钱管理', '交易监测']),
        candidateControlPoints: expect.arrayContaining([
          expect.objectContaining({
            controlName: '交易监测',
          }),
        ]),
        clusteredAt: expect.any(Date),
      }),
    )
  })

  it('should use llm fallback recommendations when rule matching finds no draft map', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-2',
        importBatchId: 'batch-2',
        status: 'extracted',
        l2Code: null,
        caseFacts: '向投资者承诺收益并传播虚假或误导性信息',
        penaltyReason: '未按规定保存微信监控记录',
        violationThemes: ['向投资者承诺收益', '传播虚假或误导性信息', '未按规定保存微信监控记录'],
      },
    ])
    controlPointRepository.find.mockResolvedValue([
      {
        controlId: 'control-2',
        controlCode: 'CTRL-FUND-SALES',
        controlName: 'Fund Sales Control',
        controlDesc: '规范宣传资料管理与投资者沟通留痕',
        controlFamily: 'OPS_CAPACITY',
        aliases: null,
        keywords: null,
        canonicalTheme: null,
        status: 'ACTIVE',
      },
    ])
    caseControlMapRepository.findOne.mockResolvedValue(null)
    caseControlMapRepository.create.mockImplementation((entity) => entity)
    caseControlMapRepository.save.mockImplementation(async (entity) => entity)
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    caseThemeIntelligenceService.suggestMappings.mockResolvedValue({
      normalizedThemes: ['销售行为管理', '记录留痕管理'],
      recommendedMappings: [
        {
          controlId: 'control-2',
          confidenceScore: 0.82,
          reason: '投资者承诺收益与销售宣传违规更接近销售行为控制',
        },
      ],
    })

    legacyCaseThemeFallbackService.processLegacyFallback.mockResolvedValueOnce({
      normalizedThemes: ['销售行为管理', '记录留痕管理'],
      candidateControlPoints: [],
      autoMappings: [
        {
          controlId: 'control-2',
          confidenceScore: 0.82,
          source: 'LLM_FALLBACK',
        },
      ],
      llmTriggered: true,
      llmAssisted: false,
      llmFallbackUsed: true,
      unmapped: false,
    })

    const result = await service.clusterBatch('batch-2')

    expect(result).toEqual({
      batchId: 'batch-2',
      processedCount: 1,
      skippedCount: 0,
      ruleMappedCaseCount: 0,
      llmTriggeredCaseCount: 1,
      llmAssistedRuleCaseCount: 0,
      llmFallbackCaseCount: 1,
      llmUnmappedCaseCount: 0,
      unmappedCaseCount: 0,
      ruleMapCount: 0,
      llmAssistedRuleMapCount: 0,
      llmFallbackMapCount: 1,
      chainMappedCaseCount: 0,
      chainMapCount: 0,
      fallbackToOldChainCount: 1,
    })
    expect(legacyCaseThemeFallbackService.processLegacyFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: undefined,
        violationThemes: ['向投资者承诺收益', '传播虚假或误导性信息', '未按规定保存微信监控记录'],
        allowLegacyFallback: true,
      }),
    )
    expect(caseControlMapRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-2',
        controlId: 'control-2',
        reviewStatus: 'PENDING',
      }),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedThemes: expect.arrayContaining(['销售行为管理', '记录留痕管理']),
        candidateControlPoints: [],
      }),
    )
  })

  // ===========================================================================
  // New chain dual-chain tests
  // ===========================================================================

  describe('dual-chain dispatch', () => {
    it('should use new chain for cases with l2Code and successful mapping', async () => {
      complianceCaseRepository.find.mockResolvedValue([
        {
          caseId: 'case-chain-001',
          importBatchId: 'batch-chain',
          status: 'extracted',
          l2Code: 'IT04',
          violationThemes: ['客户身份识别不到位'],
        },
      ])
      controlPointRepository.find.mockResolvedValue([])
      complianceCaseRepository.save.mockImplementation(async (entity) => entity)

      caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
        autoMappedCount: 2,
        shouldFallback: false,
        source: 'FAILURE_MODE_CHAIN',
        writtenMappings: [
          { caseId: 'case-chain-001', controlId: 'cp-001', relationType: 'VIOLATES', reviewStatus: 'PENDING', source: 'FAILURE_MODE_CHAIN' },
          { caseId: 'case-chain-001', controlId: 'cp-003', relationType: 'VIOLATES', reviewStatus: 'PENDING', source: 'FAILURE_MODE_CHAIN' },
        ],
      })

      const result = await service.clusterBatch('batch-chain')

      expect(result.chainMappedCaseCount).toBe(1)
      expect(result.chainMapCount).toBe(2)
      expect(result.fallbackToOldChainCount).toBe(0)
      expect(caseClusteringChainService.mapCaseToControlPoints).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-chain-001', l2Code: 'IT04' }),
      )
      // Old chain should NOT be invoked
      expect(caseThemeIntelligenceService.suggestMappings).not.toHaveBeenCalled()
    })

    it('should fallback to old chain when l2Code is null', async () => {
      complianceCaseRepository.find.mockResolvedValue([
        {
          caseId: 'case-fallback-001',
          importBatchId: 'batch-fallback',
          status: 'extracted',
          l2Code: null,
          violationThemes: ['内部控制不完善'],
        },
      ])
      controlPointRepository.find.mockResolvedValue([
        {
          controlId: 'control-1',
          controlCode: 'CP-001',
          controlName: '内部控制管理',
          controlDesc: '内部控制制度管理',
          controlFamily: 'GOV_ORG',
          aliases: ['内部控制管理'],
          keywords: ['内部控制'],
          canonicalTheme: '内部控制管理',
          status: 'ACTIVE',
        },
      ])
      caseControlMapRepository.findOne.mockResolvedValue(null)
      caseControlMapRepository.create.mockImplementation((entity) => entity)
      caseControlMapRepository.save.mockImplementation(async (entity) => entity)
      complianceCaseRepository.save.mockImplementation(async (entity) => entity)

      legacyCaseThemeFallbackService.processLegacyFallback.mockResolvedValueOnce({
        normalizedThemes: ['内部控制管理'],
        candidateControlPoints: [],
        autoMappings: [
          {
            controlId: 'control-1',
            confidenceScore: 0.86,
            source: 'RULE',
          },
        ],
        llmTriggered: false,
        llmAssisted: false,
        llmFallbackUsed: false,
        unmapped: false,
      })

      const result = await service.clusterBatch('batch-fallback')

      expect(result.chainMappedCaseCount).toBe(0)
      expect(result.fallbackToOldChainCount).toBe(1)
      expect(result.ruleMappedCaseCount).toBe(1)
    })

    it('should fallback to old chain when new chain returns shouldFallback=true', async () => {
      complianceCaseRepository.find.mockResolvedValue([
        {
          caseId: 'case-empty-chain-001',
          importBatchId: 'batch-empty',
          status: 'extracted',
          l2Code: 'IT99',
          violationThemes: ['外包管理不到位'],
        },
      ])
      controlPointRepository.find.mockResolvedValue([
        {
          controlId: 'control-1',
          controlCode: 'CP-OUT-001',
          controlName: '外包管理控制',
          controlDesc: '外包与第三方管理',
          controlFamily: 'OUTSOURCING_MGMT',
          aliases: ['外包管理'],
          keywords: ['外包'],
          canonicalTheme: '外包与第三方管理',
          status: 'ACTIVE',
        },
      ])
      caseControlMapRepository.findOne.mockResolvedValue(null)
      caseControlMapRepository.create.mockImplementation((entity) => entity)
      caseControlMapRepository.save.mockImplementation(async (entity) => entity)
      complianceCaseRepository.save.mockImplementation(async (entity) => entity)

      caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
        autoMappedCount: 0,
        shouldFallback: true,
        source: 'FAILURE_MODE_CHAIN',
        writtenMappings: [],
      })
      legacyCaseThemeFallbackService.processLegacyFallback.mockResolvedValueOnce({
        normalizedThemes: ['外包与第三方管理'],
        candidateControlPoints: [],
        autoMappings: [
          {
            controlId: 'control-1',
            confidenceScore: 0.88,
            source: 'RULE',
          },
        ],
        llmTriggered: false,
        llmAssisted: false,
        llmFallbackUsed: false,
        unmapped: false,
      })

      const result = await service.clusterBatch('batch-empty')

      expect(result.chainMappedCaseCount).toBe(0)
      expect(result.fallbackToOldChainCount).toBe(1)
      expect(result.ruleMappedCaseCount).toBe(1)
    })

    it('should handle mixed cases: some new chain, some fallback', async () => {
      complianceCaseRepository.find.mockResolvedValue([
        {
          caseId: 'case-chain-001',
          importBatchId: 'batch-mixed',
          status: 'extracted',
          l2Code: 'IT04',
          violationThemes: ['客户身份识别不到位'],
        },
        {
          caseId: 'case-fallback-001',
          importBatchId: 'batch-mixed',
          status: 'extracted',
          l2Code: null,
          violationThemes: ['内部控制不完善'],
        },
        {
          caseId: 'case-empty-chain-001',
          importBatchId: 'batch-mixed',
          status: 'extracted',
          l2Code: 'IT99',
          violationThemes: ['外包管理不到位'],
        },
      ])
      controlPointRepository.find.mockResolvedValue([
        {
          controlId: 'control-1',
          controlCode: 'CP-001',
          controlName: '内部控制管理',
          controlDesc: '内部控制制度管理',
          controlFamily: 'GOV_ORG',
          aliases: ['内部控制管理'],
          keywords: ['内部控制'],
          canonicalTheme: '内部控制管理',
          status: 'ACTIVE',
        },
        {
          controlId: 'control-2',
          controlCode: 'CP-OUT-001',
          controlName: '外包管理控制',
          controlDesc: '外包与第三方管理',
          controlFamily: 'OUTSOURCING_MGMT',
          aliases: ['外包管理'],
          keywords: ['外包'],
          canonicalTheme: '外包与第三方管理',
          status: 'ACTIVE',
        },
      ])
      caseControlMapRepository.findOne.mockResolvedValue(null)
      caseControlMapRepository.create.mockImplementation((entity) => entity)
      caseControlMapRepository.save.mockImplementation(async (entity) => entity)
      complianceCaseRepository.save.mockImplementation(async (entity) => entity)

      // case-chain-001 gets new chain result
      caseClusteringChainService.mapCaseToControlPoints
        .mockResolvedValueOnce({
          autoMappedCount: 2,
          shouldFallback: false,
          source: 'FAILURE_MODE_CHAIN',
          writtenMappings: [
            { caseId: 'case-chain-001', controlId: 'cp-001', relationType: 'VIOLATES', reviewStatus: 'PENDING', source: 'FAILURE_MODE_CHAIN' },
            { caseId: 'case-chain-001', controlId: 'cp-003', relationType: 'VIOLATES', reviewStatus: 'PENDING', source: 'FAILURE_MODE_CHAIN' },
          ],
        })
        // case-empty-chain-001 falls back (IT99 has no failure modes)
        .mockResolvedValueOnce({
          autoMappedCount: 0,
          shouldFallback: true,
          source: 'FAILURE_MODE_CHAIN',
          writtenMappings: [],
        })

      legacyCaseThemeFallbackService.processLegacyFallback
        .mockResolvedValueOnce({
          normalizedThemes: ['内部控制管理'],
          candidateControlPoints: [],
          autoMappings: [
            {
              controlId: 'control-1',
              confidenceScore: 0.86,
              source: 'RULE',
            },
          ],
          llmTriggered: false,
          llmAssisted: false,
          llmFallbackUsed: false,
          unmapped: false,
        })
        .mockResolvedValueOnce({
          normalizedThemes: ['外包与第三方管理'],
          candidateControlPoints: [],
          autoMappings: [
            {
              controlId: 'control-2',
              confidenceScore: 0.88,
              source: 'RULE',
            },
          ],
          llmTriggered: false,
          llmAssisted: false,
          llmFallbackUsed: false,
          unmapped: false,
        })

      const result = await service.clusterBatch('batch-mixed')

      expect(result.processedCount).toBe(3)
      expect(result.chainMappedCaseCount).toBe(1)
      expect(result.chainMapCount).toBe(2)
      expect(result.fallbackToOldChainCount).toBe(2)
    })

    it('should include new statistics fields in result', async () => {
      complianceCaseRepository.find.mockResolvedValue([])
      controlPointRepository.find.mockResolvedValue([])

      const result = await service.clusterBatch('batch-empty')

      expect(result).toHaveProperty('chainMappedCaseCount')
      expect(result).toHaveProperty('chainMapCount')
      expect(result).toHaveProperty('fallbackToOldChainCount')
    })

    it('should clear chain cache after batch completes', async () => {
      complianceCaseRepository.find.mockResolvedValue([])
      controlPointRepository.find.mockResolvedValue([])

      await service.clusterBatch('batch-test')

      expect(caseClusteringChainService.clearCache).toHaveBeenCalled()
    })
  })
})
