import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ClauseControlMap } from '../../../database/entities/clause-control-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { RegulationSource } from '../../../database/entities/regulation-source.entity'
import { RegulationService } from './regulation.service'

describe('RegulationService', () => {
  let service: RegulationService

  const regulationSourceRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const regulationClauseRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const clauseControlMapRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const controlPointRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegulationService,
        {
          provide: getRepositoryToken(RegulationSource),
          useValue: regulationSourceRepository,
        },
        {
          provide: getRepositoryToken(RegulationClause),
          useValue: regulationClauseRepository,
        },
        {
          provide: getRepositoryToken(ClauseControlMap),
          useValue: clauseControlMapRepository,
        },
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: controlPointRepository,
        },
      ],
    }).compile()

    service = module.get(RegulationService)
    jest.clearAllMocks()
  })

  it('should reject creating clause when source does not exist', async () => {
    regulationSourceRepository.findOne.mockResolvedValue(null)

    await expect(
      service.createClause({
        sourceId: '550e8400-e29b-41d4-a716-446655440000',
        clauseCode: 'CLAUSE-001',
        clauseText: 'Clause text',
      }),
    ).rejects.toThrow('regulation_source 550e8400-e29b-41d4-a716-446655440000 does not exist')
  })

  it('should reject duplicate clause-control map before save', async () => {
    regulationClauseRepository.findOne.mockResolvedValue({
      clauseId: 'clause-id',
    })
    controlPointRepository.findOne.mockResolvedValue({
      controlId: 'control-id',
    })
    clauseControlMapRepository.findOne.mockResolvedValue({
      id: 'existing-map',
      clauseId: 'clause-id',
      controlId: 'control-id',
    })

    await expect(
      service.createClauseControlMap({
        clauseId: 'clause-id',
        controlId: 'control-id',
        mappingType: 'direct',
      }),
    ).rejects.toThrow('clause_control_map clause-id/control-id already exists')
  })

  it('should return clause support rows grouped by controlId with source metadata', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'map-id',
          clauseId: 'clause-id',
          mappingType: 'direct',
          reviewStatus: 'APPROVED',
          confidenceScore: '0.9500',
          clause: {
            clauseCode: 'CLAUSE-001',
            articleNo: '第1条',
            sectionPath: '第一章/第一节',
            clauseText: 'Clause text',
            clauseSummary: 'Clause summary',
            mandatoryLevel: 'MUST',
            source: {
              sourceId: 'source-id',
              sourceCode: 'SRC-001',
              sourceName: '监管指引',
              sourceLevel: 'guideline',
              authorityName: '监管机构',
            },
          },
        },
      ]),
    }
    clauseControlMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)

    const result = await service.findClausesByControlId('control-id')

    expect(queryBuilder.where).toHaveBeenCalledWith('mapping.control_id = :controlId', {
      controlId: 'control-id',
    })
    expect(result).toEqual([
      {
        id: 'map-id',
        clauseId: 'clause-id',
        clauseCode: 'CLAUSE-001',
        articleNo: '第1条',
        sectionPath: '第一章/第一节',
        clauseText: 'Clause text',
        clauseSummary: 'Clause summary',
        mandatoryLevel: 'MUST',
        mappingType: 'direct',
        reviewStatus: 'APPROVED',
        confidenceScore: '0.9500',
        source: {
          sourceId: 'source-id',
          sourceCode: 'SRC-001',
          sourceName: '监管指引',
          sourceLevel: 'guideline',
          authorityName: '监管机构',
        },
      },
    ])
  })
})
