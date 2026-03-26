import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseClusteringService } from './case-clustering.service'

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
      ],
    }).compile()

    service = module.get(CaseClusteringService)
    jest.clearAllMocks()
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
        controlName: '客户身份识别',
        controlDesc: '覆盖客户身份识别和尽职调查',
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
        normalizedThemes: expect.arrayContaining(['客户身份识别', '交易监测']),
        candidateControlPoints: expect.arrayContaining([
          expect.objectContaining({
            controlName: '交易监测',
          }),
        ]),
        clusteredAt: expect.any(Date),
      }),
    )
  })
})
