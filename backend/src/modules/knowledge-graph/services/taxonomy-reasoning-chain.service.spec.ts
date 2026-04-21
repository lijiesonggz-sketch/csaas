import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { ObligationControlMap } from '../../../database/entities/obligation-control-map.entity'
import { TaxonomyService } from './taxonomy.service'

describe('TaxonomyService - getReasoningChain', () => {
  let service: TaxonomyService

  const taxonomyL1Repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const taxonomyL2Repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const taxonomyFailureModeMapRepository = {
    find: jest.fn(),
  }

  const mockFmcCountQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }

  const mockFmcQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }

  let fmcCreateQueryBuilderCallCount = 0
  const failureModeControlMapRepository = {
    createQueryBuilder: jest.fn().mockImplementation(() => {
      fmcCreateQueryBuilderCallCount++
      if (fmcCreateQueryBuilderCallCount % 2 === 1) {
        return mockFmcCountQueryBuilder
      }
      return mockFmcQueryBuilder
    }),
  }

  const mockOcmQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }

  const obligationControlMapRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockOcmQueryBuilder),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxonomyService,
        {
          provide: getRepositoryToken(TaxonomyL1),
          useValue: taxonomyL1Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyL2),
          useValue: taxonomyL2Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyFailureModeMap),
          useValue: taxonomyFailureModeMapRepository,
        },
        {
          provide: getRepositoryToken(FailureModeControlMap),
          useValue: failureModeControlMapRepository,
        },
        {
          provide: getRepositoryToken(ObligationControlMap),
          useValue: obligationControlMapRepository,
        },
      ],
    }).compile()

    service = module.get(TaxonomyService)
    fmcCreateQueryBuilderCallCount = 0
    jest.clearAllMocks()
  })

  describe('getReasoningChain', () => {
    it('[P0] should return complete reasoning chain data', async () => {
      const mockL2 = {
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
        l1Code: 'IT01',
        parent: {
          l1Code: 'IT01',
          l1Name: '信息科技治理',
        },
      }

      const mockTfmMaps = [
        {
          l2Code: 'IT01-01',
          failureModeId: 'fm-uuid-1',
          failureMode: {
            failureModeId: 'fm-uuid-1',
            failureModeCode: 'FM-001',
            name: '战略不一致',
            category: 'STRATEGIC',
          },
        },
      ]

      const mockFmcMaps = [
        {
          failureModeId: 'fm-uuid-1',
          controlId: 'cp-uuid-1',
          relevance: 'PRIMARY',
          controlPoint: {
            controlId: 'cp-uuid-1',
            controlCode: 'CP-001',
            controlName: '战略规划流程',
            maturityLevel: 'hard',
            authoritativeScore: 0.95,
            originType: 'both',
          },
        },
      ]

      const mockOcMaps = [
        {
          controlId: 'cp-uuid-1',
          obligationId: 'obl-uuid-1',
          coverage: 'FULL',
          obligation: {
            obligationId: 'obl-uuid-1',
            obligationCode: 'OBL-001',
            obligationText: '应当建立IT战略规划流程',
            obligationType: 'MANDATORY',
          },
        },
      ]

      taxonomyL2Repository.findOne.mockResolvedValue(mockL2)
      taxonomyFailureModeMapRepository.find.mockResolvedValue(mockTfmMaps)
      mockFmcCountQueryBuilder.getRawMany.mockResolvedValue([
        { failureModeId: 'fm-uuid-1', count: '1' },
      ])
      mockFmcQueryBuilder.getMany.mockResolvedValue(mockFmcMaps)
      mockOcmQueryBuilder.getMany.mockResolvedValue(mockOcMaps)

      const result = await service.getReasoningChain('IT01-01')

      expect(result.taxonomy).toEqual({
        l1Code: 'IT01',
        l1Name: '信息科技治理',
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
      })

      expect(result.failureModes).toHaveLength(1)
      expect(result.failureModes[0]).toEqual({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-001',
        name: '战略不一致',
        category: 'STRATEGIC',
        controlPointCount: 1,
      })

      expect(result.controlPoints).toHaveLength(1)
      expect(result.controlPoints[0]).toEqual({
        controlId: 'cp-uuid-1',
        controlCode: 'CP-001',
        controlName: '战略规划流程',
        maturityLevel: 'hard',
        authoritativeScore: 0.95,
        originType: 'both',
        failureModeRelevance: 'PRIMARY',
        failureModeId: 'fm-uuid-1',
      })

      expect(result.obligations).toHaveLength(1)
      expect(result.obligations[0]).toEqual({
        obligationId: 'obl-uuid-1',
        obligationCode: 'OBL-001',
        obligationText: '应当建立IT战略规划流程',
        obligationType: 'MANDATORY',
        controlId: 'cp-uuid-1',
        coverage: 'FULL',
      })
    })

    it('[P1] should return 404 when l2Code does not exist', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(null)

      await expect(service.getReasoningChain('INVALID-CODE')).rejects.toThrow(
        new NotFoundException('taxonomy_l2 INVALID-CODE not found'),
      )
    })

    it('[P1] should handle empty failure modes', async () => {
      const mockL2 = {
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
        l1Code: 'IT01',
        parent: {
          l1Code: 'IT01',
          l1Name: '信息科技治理',
        },
      }

      taxonomyL2Repository.findOne.mockResolvedValue(mockL2)
      taxonomyFailureModeMapRepository.find.mockResolvedValue([])

      const result = await service.getReasoningChain('IT01-01')

      expect(result.taxonomy).toBeDefined()
      expect(result.failureModes).toEqual([])
      expect(result.controlPoints).toEqual([])
      expect(result.obligations).toEqual([])
    })

    it('[P1] should handle null authoritativeScore', async () => {
      const mockL2 = {
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
        l1Code: 'IT01',
        parent: {
          l1Code: 'IT01',
          l1Name: '信息科技治理',
        },
      }

      const mockTfmMaps = [
        {
          l2Code: 'IT01-01',
          failureModeId: 'fm-uuid-1',
          failureMode: {
            failureModeId: 'fm-uuid-1',
            failureModeCode: 'FM-001',
            name: '战略不一致',
            category: 'STRATEGIC',
          },
        },
      ]

      const mockFmcMaps = [
        {
          failureModeId: 'fm-uuid-1',
          controlId: 'cp-uuid-1',
          relevance: 'PRIMARY',
          controlPoint: {
            controlId: 'cp-uuid-1',
            controlCode: 'CP-001',
            controlName: '战略规划流程',
            maturityLevel: 'candidate',
            authoritativeScore: null,
            originType: 'manual',
          },
        },
      ]

      taxonomyL2Repository.findOne.mockResolvedValue(mockL2)
      taxonomyFailureModeMapRepository.find.mockResolvedValue(mockTfmMaps)
      mockFmcCountQueryBuilder.getRawMany.mockResolvedValue([
        { failureModeId: 'fm-uuid-1', count: '1' },
      ])
      mockFmcQueryBuilder.getMany.mockResolvedValue(mockFmcMaps)
      mockOcmQueryBuilder.getMany.mockResolvedValue([])

      const result = await service.getReasoningChain('IT01-01')

      expect(result.controlPoints[0].authoritativeScore).toBe(0)
    })
  })
})

