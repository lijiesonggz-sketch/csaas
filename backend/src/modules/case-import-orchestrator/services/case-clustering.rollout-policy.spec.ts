import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseClusteringChainService } from './case-clustering-chain.service'
import { CaseClusteringService } from './case-clustering.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { ComplianceCaseClassificationRunService } from './compliance-case-classification-run.service'
import { DomainRolloutPolicyService } from './taxonomy-classification/domain-rollout-policy.service'

describe('CaseClusteringService rollout policy integration', () => {
  let service: CaseClusteringService

  const complianceCaseRepository = {
    find: jest.fn(),
    save: jest.fn().mockImplementation(async (entity: unknown) => entity),
  }
  const controlPointRepository = {
    find: jest.fn().mockResolvedValue([]),
  }
  const caseControlMapRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
  const caseThemeIntelligenceService = {
    suggestMappings: jest.fn().mockResolvedValue(null),
  }
  const caseClusteringChainService = {
    mapCaseToControlPoints: jest.fn(),
    clearCache: jest.fn(),
  }
  const classificationRunService = {
    findLatestRun: jest.fn(),
  }
  const domainRolloutPolicyService = {
    shouldAllowLegacyFallback: jest.fn(),
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
      ],
    }).compile()

    service = module.get(CaseClusteringService)
    jest.clearAllMocks()
  })

  it('should refuse old-chain fallback when rollout policy disallows legacy fallback', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-rollout-001',
        importBatchId: 'batch-rollout',
        status: 'extracted',
        l1Code: 'IT07',
        l2Code: 'IT07-06',
        violationThemes: ['后台修改'],
      },
    ])
    domainRolloutPolicyService.shouldAllowLegacyFallback.mockResolvedValue(false)
    caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
      autoMappedCount: 0,
      shouldFallback: true,
      source: 'FAILURE_MODE_CHAIN',
      writtenMappings: [],
    })

    const result = await service.clusterBatch('batch-rollout')

    expect(result.fallbackToOldChainCount).toBe(0)
    expect(caseThemeIntelligenceService.suggestMappings).not.toHaveBeenCalled()
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateControlPoints: [
          expect.objectContaining({
            reason: expect.stringContaining('禁止 legacy fallback'),
          }),
        ],
        status: 'clustered',
      }),
    )
  })

  it('should honor latest classification run policy snapshot even when latest case snapshot has null l1Code', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-rollout-null-l1-001',
        importBatchId: 'batch-rollout-null-l1',
        status: 'extracted',
        l1Code: null,
        l2Code: 'IT07-06',
        violationThemes: ['后台修改'],
      },
    ])
    classificationRunService.findLatestRun.mockResolvedValue({
      decisionTraceJson: {
        policySnapshot: {
          allowLegacyFallback: false,
        },
      },
    })
    caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
      autoMappedCount: 0,
      shouldFallback: true,
      source: 'FAILURE_MODE_CHAIN',
      writtenMappings: [],
    })

    const result = await service.clusterBatch('batch-rollout-null-l1')

    expect(result.fallbackToOldChainCount).toBe(0)
    expect(caseThemeIntelligenceService.suggestMappings).not.toHaveBeenCalled()
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateControlPoints: [
          expect.objectContaining({
            reason: expect.stringContaining('禁止 legacy fallback'),
          }),
        ],
      }),
    )
  })

  it('should fall back to the latest classification run l1Code when policy snapshot is absent', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-rollout-null-l1-002',
        importBatchId: 'batch-rollout-null-l1-via-run',
        status: 'extracted',
        l1Code: null,
        l2Code: 'IT07-06',
        violationThemes: ['后台修改'],
      },
    ])
    classificationRunService.findLatestRun.mockResolvedValue({
      l1Code: 'IT07',
      decisionTraceJson: {},
    })
    domainRolloutPolicyService.shouldAllowLegacyFallback.mockResolvedValue(false)
    caseClusteringChainService.mapCaseToControlPoints.mockResolvedValue({
      autoMappedCount: 0,
      shouldFallback: true,
      source: 'FAILURE_MODE_CHAIN',
      writtenMappings: [],
    })

    const result = await service.clusterBatch('batch-rollout-null-l1-via-run')

    expect(domainRolloutPolicyService.shouldAllowLegacyFallback).toHaveBeenCalledWith(
      'IT07',
    )
    expect(result.fallbackToOldChainCount).toBe(0)
    expect(caseThemeIntelligenceService.suggestMappings).not.toHaveBeenCalled()
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateControlPoints: [
          expect.objectContaining({
            reason: expect.stringContaining('禁止 legacy fallback'),
          }),
        ],
      }),
    )
  })

  it('should keep an explicit manual-review draft when legacy fallback is blocked before any new-chain attempt can run', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-rollout-abstain-001',
        importBatchId: 'batch-rollout-abstain',
        status: 'extracted',
        l1Code: null,
        l2Code: null,
        violationThemes: ['恢复演练不足'],
      },
    ])
    classificationRunService.findLatestRun.mockResolvedValue({
      decisionTraceJson: {
        policySnapshot: {
          allowLegacyFallback: false,
        },
      },
    })

    const result = await service.clusterBatch('batch-rollout-abstain')

    expect(result.fallbackToOldChainCount).toBe(0)
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateControlPoints: [
          expect.objectContaining({
            sourceTheme: '恢复演练不足',
            reason: expect.stringContaining('等待人工确认'),
          }),
        ],
      }),
    )
  })
})
