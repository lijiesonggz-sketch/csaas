import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseClusteringService } from './case-clustering.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'

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
      ],
    }).compile()

    service = module.get(CaseClusteringService)
    jest.clearAllMocks()
    caseThemeIntelligenceService.suggestMappings.mockResolvedValue(null)
  })

  it('should normalize themes, create mapping drafts, and keep unmatched control point candidates', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-1',
        importBatchId: 'batch-1',
        status: 'extracted',
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

    const result = await service.clusterBatch('batch-1')

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
    })
    expect(caseThemeIntelligenceService.suggestMappings).toHaveBeenCalled()
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
})
