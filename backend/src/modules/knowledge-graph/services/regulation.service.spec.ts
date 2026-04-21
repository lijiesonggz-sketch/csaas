import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ClauseControlMap } from '../../../database/entities/clause-control-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { RegulationObligation } from '../../../database/entities/regulation-obligation.entity'
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
    find: jest.fn(),
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
          provide: getRepositoryToken(RegulationObligation),
          useValue: {},
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

  it('should build regulation graph with clauses, obligations and control points', async () => {
    regulationSourceRepository.findOne.mockResolvedValue({
      sourceId: 'source-1',
      sourceCode: 'SRC-001',
      sourceName: '监管指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
    })
    regulationClauseRepository.find.mockResolvedValue([
      {
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '4.1',
        sectionPath: '第四条/第一款',
        clauseText: '应当建立复核机制',
        clauseSummary: '建立复核机制',
        mandatoryLevel: 'MUST',
        obligations: [
          {
            obligationId: 'obl-1',
            obligationCode: 'OBL-001',
            obligationText: '应当建立监管报送复核机制',
            obligationType: 'MANDATORY',
            applicableSector: ['银行'],
            obligationControlMaps: [
              {
                coverage: 'FULL',
                controlPoint: {
                  controlId: 'cp-1',
                  controlCode: 'CP-001',
                  controlName: '监管报送复核控制',
                  maturityLevel: 'hard',
                  authoritativeScore: 0.92,
                  originType: 'regulation_derived',
                  applicableSector: ['银行'],
                },
              },
            ],
          },
        ],
      },
    ])

    const result = await service.getRegulationGraph('source-1')

    expect(result.source).toEqual({
      sourceId: 'source-1',
      sourceCode: 'SRC-001',
      sourceName: '监管指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
      clauseCount: 1,
      obligationCount: 1,
      controlPointCount: 1,
    })
    expect(result.clauses[0]).toEqual({
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      articleNo: '4.1',
      sectionPath: '第四条/第一款',
      clauseText: '应当建立复核机制',
      clauseSummary: '建立复核机制',
      mandatoryLevel: 'MUST',
      obligationCount: 1,
      controlPointCount: 1,
    })
    expect(result.obligations[0]).toEqual({
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      obligationText: '应当建立监管报送复核机制',
      obligationType: 'MANDATORY',
      applicableSector: ['银行'],
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
      clauseSummary: '建立复核机制',
      controlPointCount: 1,
    })
    expect(result.controlPoints[0]).toEqual({
      edgeId: 'clause-1:obl-1:cp-1',
      controlId: 'cp-1',
      controlCode: 'CP-001',
      controlName: '监管报送复核控制',
      maturityLevel: 'hard',
      authoritativeScore: 0.92,
      originType: 'regulation_derived',
      applicableSector: ['银行'],
      coverage: 'FULL',
      obligationId: 'obl-1',
      obligationCode: 'OBL-001',
      clauseId: 'clause-1',
      clauseCode: 'CLAUSE-001',
    })
  })
})
