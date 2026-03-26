import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseHumanReviewService } from './case-human-review.service'

describe('CaseHumanReviewService', () => {
  let service: CaseHumanReviewService

  const complianceCaseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  }

  const caseControlMapRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseHumanReviewService,
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
      ],
    }).compile()

    service = module.get(CaseHumanReviewService)
    jest.clearAllMocks()
  })

  it('should approve, reject, and manually add mappings while marking the case reviewed', async () => {
    complianceCaseRepository.findOne.mockResolvedValue({
      caseId: 'case-1',
      status: 'clustered',
      candidateControlPoints: [
        {
          controlName: '交易监测',
        },
      ],
    })
    caseControlMapRepository.find.mockResolvedValue([
      {
        id: 'draft-1',
        caseId: 'case-1',
        controlId: 'control-1',
        reviewStatus: 'PENDING',
        relationType: 'VIOLATES',
        confidenceScore: '0.9000',
      },
      {
        id: 'draft-2',
        caseId: 'case-1',
        controlId: 'control-2',
        reviewStatus: 'PENDING',
        relationType: 'VIOLATES',
        confidenceScore: '0.6000',
      },
    ])
    caseControlMapRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-3',
    })
    caseControlMapRepository.create.mockImplementation((entity) => entity)
    caseControlMapRepository.save.mockImplementation(async (entity) => entity)
    complianceCaseRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.reviewCase('case-1', 'reviewer-1', {
      approvedMapIds: ['draft-1'],
      rejectedMapIds: ['draft-2'],
      manualMappings: [
        {
          controlId: 'control-3',
          relationType: 'RELATED',
          confidenceScore: 0.95,
        },
      ],
      candidateControlPoints: [],
    })

    expect(result).toEqual({
      caseId: 'case-1',
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: 'reviewer-1',
      reviewedAt: expect.any(Date),
      approvedCount: 2,
      rejectedCount: 1,
      manualMappingCount: 1,
    })
    expect(caseControlMapRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        controlId: 'control-3',
        relationType: 'RELATED',
        reviewStatus: 'APPROVED',
      }),
    )
    expect(complianceCaseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'reviewed',
        humanReviewed: true,
        reviewedBy: 'reviewer-1',
        reviewedAt: expect.any(Date),
        candidateControlPoints: [],
      }),
    )
  })
})
