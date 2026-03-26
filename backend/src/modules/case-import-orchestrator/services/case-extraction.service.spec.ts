import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { CaseExtractionService } from './case-extraction.service'

describe('CaseExtractionService', () => {
  let service: CaseExtractionService

  const complianceCaseRepository = {
    find: jest.fn(),
    save: jest.fn(),
  }

  const regulationClauseRepository = {
    find: jest.fn(),
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
      ],
    }).compile()

    service = module.get(CaseExtractionService)
    jest.clearAllMocks()
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
})
