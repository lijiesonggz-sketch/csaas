import { BadRequestException, ConflictException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseHumanReviewService } from './case-human-review.service'

describe('CaseHumanReviewService', () => {
  let service: CaseHumanReviewService
  let dataSource: jest.Mocked<DataSource>

  const mockEntityManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockDataSource = {
    transaction: jest.fn((callback) => callback(mockEntityManager)),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockEntityManager.findOne.mockReset()
    mockEntityManager.find.mockReset()
    mockEntityManager.create.mockReset()
    mockEntityManager.save.mockReset()
    mockDataSource.transaction.mockImplementation((callback) => callback(mockEntityManager))

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseHumanReviewService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile()

    service = module.get(CaseHumanReviewService)
    dataSource = module.get(DataSource)
  })

  it('should review a clustered case inside a transaction and lock the case row', async () => {
    mockEntityManager.findOne
      .mockResolvedValueOnce({
        caseId: 'case-1',
        status: 'clustered',
        humanReviewed: false,
        candidateControlPoints: [{ controlName: '交易监测' }],
      } as ComplianceCase)
      .mockResolvedValueOnce({
        controlId: 'control-3',
      } as ControlPoint)

    mockEntityManager.find.mockResolvedValue([
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
    ] as CaseControlMap[])

    mockEntityManager.create.mockImplementation((_entity, payload) => payload)
    mockEntityManager.save.mockImplementation(async (entity) => entity)

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

    expect(dataSource.transaction).toHaveBeenCalledTimes(1)
    expect(mockEntityManager.findOne).toHaveBeenCalledWith(
      ComplianceCase,
      expect.objectContaining({
        where: { caseId: 'case-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    )
    expect(mockEntityManager.create).toHaveBeenCalledWith(
      CaseControlMap,
      expect.objectContaining({
        caseId: 'case-1',
        controlId: 'control-3',
        relationType: 'RELATED',
        reviewStatus: 'APPROVED',
      }),
    )
    expect(mockEntityManager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        status: 'reviewed',
        humanReviewed: true,
        reviewedBy: 'reviewer-1',
        reviewedAt: expect.any(Date),
        candidateControlPoints: [],
      }),
    )
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
  })

  it('should reject cases that were already human-reviewed', async () => {
    mockEntityManager.findOne.mockResolvedValue({
      caseId: 'case-1',
      status: 'reviewed',
      humanReviewed: true,
      candidateControlPoints: [],
    } as ComplianceCase)

    await expect(
      service.reviewCase('case-1', 'reviewer-1', {
        approvedMapIds: ['draft-1'],
      }),
    ).rejects.toThrow(ConflictException)

    expect(mockEntityManager.find).not.toHaveBeenCalled()
    expect(mockEntityManager.save).not.toHaveBeenCalled()
  })

  it('should reject overlapping approve and reject decisions for the same mapping', async () => {
    mockEntityManager.findOne.mockResolvedValue({
      caseId: 'case-1',
      status: 'clustered',
      humanReviewed: false,
      candidateControlPoints: [],
    } as ComplianceCase)
    mockEntityManager.find.mockResolvedValue([
      {
        id: 'draft-1',
        caseId: 'case-1',
        controlId: 'control-1',
        reviewStatus: 'PENDING',
        relationType: 'VIOLATES',
        confidenceScore: '0.9000',
      },
    ] as CaseControlMap[])

    await expect(
      service.reviewCase('case-1', 'reviewer-1', {
        approvedMapIds: ['draft-1'],
        rejectedMapIds: ['draft-1'],
      }),
    ).rejects.toThrow(BadRequestException)

    expect(mockEntityManager.save).not.toHaveBeenCalled()
  })

  it('should reject manual mappings that target controls already selected for approve or reject', async () => {
    mockEntityManager.findOne.mockResolvedValue({
      caseId: 'case-1',
      status: 'clustered',
      humanReviewed: false,
      candidateControlPoints: [],
    } as ComplianceCase)
    mockEntityManager.find.mockResolvedValue([
      {
        id: 'draft-1',
        caseId: 'case-1',
        controlId: 'control-1',
        reviewStatus: 'PENDING',
        relationType: 'VIOLATES',
        confidenceScore: '0.9000',
      },
    ] as CaseControlMap[])

    await expect(
      service.reviewCase('case-1', 'reviewer-1', {
        approvedMapIds: ['draft-1'],
        manualMappings: [
          {
            controlId: 'control-1',
            relationType: 'RELATED',
            confidenceScore: 0.8,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException)

    expect(mockEntityManager.save).not.toHaveBeenCalled()
  })
})
