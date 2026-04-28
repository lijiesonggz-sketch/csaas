import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ComplianceCaseService } from './compliance-case.service'

describe('ComplianceCaseService', () => {
  let service: ComplianceCaseService

  const complianceCaseRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const caseControlMapRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(),
    },
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  const taxonomyL1Repository = {
    findOne: jest.fn(),
  }

  const taxonomyL2Repository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceCaseService,
        {
          provide: getRepositoryToken(ComplianceCase),
          useValue: complianceCaseRepository,
        },
        {
          provide: getRepositoryToken(CaseControlMap),
          useValue: caseControlMapRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
        {
          provide: getRepositoryToken(TaxonomyL1),
          useValue: taxonomyL1Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyL2),
          useValue: taxonomyL2Repository,
        },
      ],
    }).compile()

    service = module.get(ComplianceCaseService)
    jest.clearAllMocks()
  })

  it('should reject l2Code without l1Code when creating a compliance case', async () => {
    complianceCaseRepository.findOne.mockResolvedValue(null)

    await expect(
      service.createCase({
        caseCode: 'CASE-001',
        l2Code: 'IT02-03',
      }),
    ).rejects.toThrow('l1Code is required when l2Code is provided')
  })

  it('should reject duplicate case-control map before save', async () => {
    complianceCaseRepository.findOne.mockResolvedValue({
      caseId: 'case-id',
    })
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })
    caseControlMapRepository.findOne.mockResolvedValue({
      id: 'existing-map',
      caseId: 'case-id',
      controlId: 'control-id',
    })

    await expect(
      service.createCaseControlMap({
        caseId: 'case-id',
        controlId: 'control-id',
      }),
    ).rejects.toThrow('case_control_map case-id/control-id already exists')
  })

  it('should filter compliance cases by import batch id', async () => {
    complianceCaseRepository.findAndCount.mockResolvedValue([[], 0])

    await service.findAllCases({
      batchId: 'PBOC-batch-001',
      page: 1,
      limit: 20,
    })

    expect(complianceCaseRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          importBatchId: 'PBOC-batch-001',
        }),
      }),
    )
  })

  it('should return empty array when a control point has no mapped cases', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }
    caseControlMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findCasesByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('mapping.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('mapping.review_status = :reviewStatus', {
      reviewStatus: 'APPROVED',
    })
    expect(result).toEqual([])
  })

  it('should tolerate mapped cases whose joined case record is missing', async () => {
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'map-1',
          caseId: 'case-1',
          relationType: 'VIOLATES',
          reviewStatus: 'APPROVED',
          confidenceScore: '0.9100',
          caseRecord: null,
        },
      ]),
    }
    caseControlMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findCasesByControlId('control-id')

    expect(result).toEqual([
      {
        id: 'map-1',
        caseId: 'case-1',
        caseCode: null,
        caseTitle: null,
        sourceOrg: null,
        penalizedPerson: null,
        industry: null,
        authorityName: null,
        caseDate: null,
        relationType: 'VIOLATES',
        reviewStatus: 'APPROVED',
        confidenceScore: '0.9100',
      },
    ])
  })

  it('should return structured extraction results for a case', async () => {
    complianceCaseRepository.findOne.mockResolvedValue({
      caseId: 'case-id',
      caseCode: 'PBOC-CASE-001',
      status: 'extracted',
      violationThemes: ['客户身份识别不到位'],
      clauseCandidates: [
        {
          clauseId: 'clause-id',
          clauseCode: 'CLAUSE-001',
        },
      ],
      extractedAt: new Date('2026-03-26T00:00:00.000Z'),
    })

    const result = await service.getCaseExtractionResult('case-id')

    expect(result).toEqual({
      caseId: 'case-id',
      caseCode: 'PBOC-CASE-001',
      status: 'extracted',
      violationThemes: ['客户身份识别不到位'],
      clauseCandidates: [
        {
          clauseId: 'clause-id',
          clauseCode: 'CLAUSE-001',
        },
      ],
      extractedAt: new Date('2026-03-26T00:00:00.000Z'),
    })
  })

  it('should return clustering drafts for a case', async () => {
    complianceCaseRepository.findOne.mockResolvedValue({
      caseId: 'case-id',
      caseCode: 'PBOC-CASE-001',
      status: 'clustered',
      normalizedThemes: ['客户身份识别'],
      candidateControlPoints: [
        {
          controlName: '交易监测',
        },
      ],
      clusteredAt: new Date('2026-03-26T01:00:00.000Z'),
      humanReviewed: false,
      reviewedBy: null,
      reviewedAt: null,
    })
    caseControlMapRepository.find.mockResolvedValue([
      {
        id: 'draft-id',
        controlId: 'control-id',
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
        confidenceScore: '0.9000',
        source: 'RULE',
        controlPoint: {
          controlCode: 'CP-001',
          controlName: '客户身份识别',
        },
      },
    ])

    const result = await service.getCaseClusteringResult('case-id')

    expect(result).toEqual({
      caseId: 'case-id',
      caseCode: 'PBOC-CASE-001',
      status: 'clustered',
      normalizedThemes: ['客户身份识别'],
      candidateControlPoints: [
        {
          controlName: '交易监测',
        },
      ],
      clusteredAt: new Date('2026-03-26T01:00:00.000Z'),
      humanReviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      caseControlMapDrafts: [
        {
          id: 'draft-id',
          controlId: 'control-id',
          controlCode: 'CP-001',
          controlName: '客户身份识别',
          relationType: 'VIOLATES',
          reviewStatus: 'PENDING',
          confidenceScore: '0.9000',
          source: 'RULE',
        },
      ],
    })
  })

  it('should include derived failure mode metadata for failure-mode-chain drafts', async () => {
    complianceCaseRepository.findOne.mockResolvedValue({
      caseId: 'case-id',
      caseCode: 'PBOC-CASE-001',
      status: 'clustered',
      l2Code: 'IT04-06',
      normalizedThemes: ['监管报送准确性控制'],
      candidateControlPoints: [],
      clusteredAt: new Date('2026-03-26T01:00:00.000Z'),
      humanReviewed: false,
      reviewedBy: null,
      reviewedAt: null,
    })
    caseControlMapRepository.find.mockResolvedValue([
      {
        id: 'draft-id',
        controlId: 'control-id',
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
        confidenceScore: '0.9000',
        source: 'FAILURE_MODE_CHAIN',
        controlPoint: {
          controlCode: 'CP-001',
          controlName: '监管报送复核控制',
        },
      },
    ])
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          controlId: 'control-id',
          failureMode: {
            failureModeId: 'fm-1',
            failureModeCode: 'FM-REP-001',
            name: '报送口径定义错误',
          },
        },
      ]),
    }
    caseControlMapRepository.manager.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.getCaseClusteringResult('case-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('fcm.control_id IN (:...controlIds)', {
      controlIds: ['control-id'],
    })
    expect(result.caseControlMapDrafts[0]).toMatchObject({
      id: 'draft-id',
      controlId: 'control-id',
      source: 'FAILURE_MODE_CHAIN',
      derivedFailureMode: {
        failureModeId: 'fm-1',
        failureModeCode: 'FM-REP-001',
        failureModeName: '报送口径定义错误',
      },
    })
  })
})
