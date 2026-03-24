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
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
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

  it('should return empty array when a control point has no mapped cases', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }
    caseControlMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findCasesByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('mapping.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(result).toEqual([])
  })
})
