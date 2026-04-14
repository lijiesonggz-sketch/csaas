import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { CaseExtractionService } from './case-extraction.service'
import { CaseThemeIntelligenceService } from './case-theme-intelligence.service'
import { It04TaxonomyClassifierService } from './it04-taxonomy-classifier.service'

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

  const it04TaxonomyClassifierService = {
    classifyCaseText: jest.fn(),
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
          provide: It04TaxonomyClassifierService,
          useValue: it04TaxonomyClassifierService,
        },
      ],
    }).compile()

    service = module.get(CaseExtractionService)
    jest.clearAllMocks()
    caseThemeIntelligenceService.refineViolationThemes.mockResolvedValue(null)
    it04TaxonomyClassifierService.classifyCaseText.mockReturnValue(null)
  })

  it('should extract violation themes and clause candidates for pending cases', async () => {
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

  it('should persist IT04 taxonomy classification when classifier returns confident result', async () => {
    complianceCaseRepository.find.mockResolvedValue([
      {
        caseId: 'case-3',
        importBatchId: 'batch-3',
        status: 'pending',
        caseFacts: '监管登记信息补录和更新没有时效监控，补录超期且无人催办。',
        penaltyReason: '导致信息更新不及时不规范。',
      },
    ])
    regulationClauseRepository.find.mockResolvedValue([])
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)
    it04TaxonomyClassifierService.classifyCaseText.mockReturnValue({
      l1Code: 'IT04',
      l2Code: 'IT04-10',
      l2Name: '信息登记/录入/更新不及时不规范',
      score: 9,
      scoreGap: 5,
      decisionSource: 'rule',
      matchedPhrases: ['登记录入更新', '更新不及时'],
      matchedTokens: [],
    })

    await service.extractBatch('batch-3')

    expect(it04TaxonomyClassifierService.classifyCaseText).toHaveBeenCalledWith(
      expect.stringContaining('监管登记信息补录和更新没有时效监控'),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Code: 'IT04',
        l2Code: 'IT04-10',
        confidenceScore: '9.0000',
        status: 'extracted',
      }),
    )
  })
})
