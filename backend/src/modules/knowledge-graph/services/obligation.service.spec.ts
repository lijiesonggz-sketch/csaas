/**
 * ATDD Acceptance Tests — Story 3-2: ObligationService 业务逻辑
 *
 * 覆盖 AC: 1 / 3 / 4
 */

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { Brackets, QueryFailedError } from 'typeorm'
import { ClauseControlMap } from '../../../database/entities/clause-control-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { ObligationControlMap } from '../../../database/entities/obligation-control-map.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { RegulationObligation } from '../../../database/entities/regulation-obligation.entity'
import { loadKgSeedData } from '../../applicability-engine/seeds/kg-seed-data'

const loadService = async () => {
  const mod = await import('./obligation.service')
  return mod.ObligationService as new (
    ...args: unknown[]
  ) => InstanceType<typeof mod.ObligationService>
}

function createMockRepos() {
  const queryBuilderMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
  }

  return {
    obligationRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    obligationControlMapRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    clauseRepo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    controlPointRepo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    clauseControlMapRepo: {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    queryBuilderMock,
  }
}

describe('ObligationService', () => {
  let service: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mocks: ReturnType<typeof createMockRepos>

  beforeEach(async () => {
    mocks = createMockRepos()
    const ObligationServiceClass = await loadService()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObligationServiceClass,
        { provide: getRepositoryToken(RegulationObligation), useValue: mocks.obligationRepo },
        {
          provide: getRepositoryToken(ObligationControlMap),
          useValue: mocks.obligationControlMapRepo,
        },
        { provide: getRepositoryToken(RegulationClause), useValue: mocks.clauseRepo },
        { provide: getRepositoryToken(ControlPoint), useValue: mocks.controlPointRepo },
        { provide: getRepositoryToken(ClauseControlMap), useValue: mocks.clauseControlMapRepo },
      ],
    }).compile()

    service = module.get(ObligationServiceClass)
    jest.clearAllMocks()
  })

  describe('[P0][AC-1] findAll', () => {
    it('should return paginated obligations with filters passed through query builder', async () => {
      const qb = mocks.queryBuilderMock
      const mockItems = [{ obligationId: 'obl-1', obligationCode: 'OBL-001' }]
      mocks.obligationRepo.createQueryBuilder.mockReturnValue(qb)
      qb.getManyAndCount.mockResolvedValue([mockItems, 1])

      const result = await service.findAll({
        obligationType: 'MANDATORY',
        status: 'ACTIVE',
        applicableSector: '银行',
        keyword: '复核',
        page: 1,
        limit: 20,
      })

      expect(result).toEqual({
        items: mockItems,
        total: 1,
        page: 1,
        limit: 20,
      })
      expect(qb.andWhere).toHaveBeenCalled()
      expect(mocks.obligationRepo.createQueryBuilder).toHaveBeenCalledWith('obl')
    })

    it('should escape wildcard characters in keyword filters so literal % and _ do not expand the search unexpectedly', async () => {
      const qb = mocks.queryBuilderMock
      mocks.obligationRepo.createQueryBuilder.mockReturnValue(qb)
      qb.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        keyword: '%_',
        page: 1,
        limit: 20,
      })

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.any(Brackets),
      )

      const bracket = qb.andWhere.mock.calls.find(
        (call) => call[0] instanceof Brackets,
      )?.[0] as Brackets

      const nested = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      }

      ;(bracket as any).whereFactory(nested)

      expect(nested.where).toHaveBeenCalledWith(
        expect.stringContaining(`ILIKE :keyword ESCAPE '\\'`),
        { keyword: `%\\%\\_%` },
      )
    })
  })

  describe('[P0][AC-1] findById', () => {
    it('should return obligation detail with clause and control maps', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
        obligationText: '应当建立复核机制',
        obligationType: 'MANDATORY',
        applicableSector: ['银行'],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        clause: {
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
          articleNo: '第1条',
          clauseText: '条文全文',
          clauseSummary: '条文摘要',
          source: {
            sourceId: 'source-1',
            sourceCode: 'SRC-001',
            sourceName: '监管指引',
          },
        },
        obligationControlMaps: [
          {
            id: 'map-1',
            controlId: 'control-1',
            coverage: 'FULL',
            controlPoint: {
              controlId: 'control-1',
              controlCode: 'CTRL-001',
              controlName: '复核控制',
              originType: 'regulation_derived',
              maturityLevel: 'hard',
              authoritativeScore: 0.9,
            },
          },
        ],
      })

      const result = await service.findById('obl-1')
      expect(result.clause).toEqual(
        expect.objectContaining({
          clauseId: 'clause-1',
          clauseCode: 'CLAUSE-001',
        }),
      )
      expect(result.controlMaps[0]).toEqual(
        expect.objectContaining({
          controlId: 'control-1',
          coverage: 'FULL',
          controlCode: 'CTRL-001',
        }),
      )
    })

    it('should throw NotFoundException when obligation does not exist', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue(null)
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('[P0][AC-1] create', () => {
    it('should create obligation after clause existence and uniqueness checks', async () => {
      mocks.clauseRepo.findOne.mockResolvedValue({ clauseId: 'clause-1' })
      mocks.obligationRepo.findOne.mockResolvedValue(null)
      mocks.obligationRepo.create.mockReturnValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.obligationRepo.save.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })

      const result = await service.create({
        clauseId: '550e8400-e29b-41d4-a716-446655440000',
        obligationCode: 'OBL-001',
        obligationText: '应当建立复核机制',
        obligationType: 'MANDATORY',
      })

      expect(result.obligationCode).toBe('OBL-001')
    })

    it('should throw ConflictException on duplicate obligationCode', async () => {
      mocks.clauseRepo.findOne.mockResolvedValue({ clauseId: 'clause-1' })
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'existing',
        obligationCode: 'OBL-001',
      })

      await expect(
        service.create({
          clauseId: '550e8400-e29b-41d4-a716-446655440000',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('should convert database unique constraint violation into ConflictException', async () => {
      mocks.clauseRepo.findOne.mockResolvedValue({ clauseId: 'clause-1' })
      mocks.obligationRepo.findOne.mockResolvedValue(null)
      mocks.obligationRepo.create.mockReturnValue({
        obligationCode: 'OBL-001',
      })
      const dbError = new QueryFailedError(
        'INSERT INTO regulation_obligations',
        [],
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      )
      mocks.obligationRepo.save.mockRejectedValue(dbError)

      await expect(
        service.create({
          clauseId: '550e8400-e29b-41d4-a716-446655440000',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('[P0][AC-1] update', () => {
    it('should reject null updates for non-nullable fields', async () => {
      await expect(
        service.update('obl-1', { obligationCode: null as unknown as string }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('should convert database unique constraint violation on update into ConflictException', async () => {
      const existing = {
        obligationId: 'obl-1',
        clauseId: 'clause-1',
        obligationCode: 'OBL-001',
        obligationText: '原始义务',
        obligationType: 'MANDATORY',
        applicableSector: ['银行'],
        status: 'ACTIVE',
      }
      mocks.obligationRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null)
      mocks.clauseRepo.findOne.mockResolvedValue({ clauseId: 'clause-1' })
      const dbError = new QueryFailedError(
        'UPDATE regulation_obligations',
        [],
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      )
      mocks.obligationRepo.save.mockRejectedValue(dbError)

      await expect(
        service.update('obl-1', {
          obligationCode: 'OBL-001-UPDATED',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('[P0][AC-1] findByClauseId', () => {
    it('should throw NotFoundException when clause does not exist', async () => {
      mocks.clauseRepo.findOne.mockResolvedValue(null)
      await expect(
        service.findByClauseId('missing-clause', { page: 1, limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('[P0][AC-1] findControlPointsByObligation', () => {
    it('should return mapped control points with coverage and governance metadata', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      const qb = mocks.queryBuilderMock
      mocks.obligationControlMapRepo.createQueryBuilder.mockReturnValue(qb)
      qb.getManyAndCount.mockResolvedValue([
        [
          {
            id: 'map-1',
            controlId: 'control-1',
            coverage: 'FULL',
            controlPoint: {
              controlId: 'control-1',
              controlCode: 'CTRL-001',
              controlName: '复核控制',
              originType: 'regulation_derived',
              maturityLevel: 'hard',
              authoritativeScore: 0.9,
            },
          },
        ],
        1,
      ])

      const result = await service.findControlPointsByObligation('obl-1', { page: 1, limit: 20 })
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          controlId: 'control-1',
          coverage: 'FULL',
          originType: 'regulation_derived',
        }),
      )
    })
  })

  describe('[P0][AC-4] createControlMap', () => {
    it('should create a control map after validating obligation, control point, and uniqueness', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue({
        controlId: 'control-1',
        controlCode: 'CTRL-001',
      })
      mocks.obligationControlMapRepo.findOne.mockResolvedValue(null)
      mocks.obligationControlMapRepo.create.mockReturnValue({
        id: 'map-1',
        obligationId: 'obl-1',
        controlId: 'control-1',
        coverage: 'FULL',
      })
      mocks.obligationControlMapRepo.save.mockResolvedValue({
        id: 'map-1',
        obligationId: 'obl-1',
        controlId: 'control-1',
        coverage: 'FULL',
      })

      const result = await service.createControlMap('obl-1', {
        controlId: 'control-1',
        coverage: 'FULL',
      })

      expect(mocks.obligationControlMapRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          obligationId: 'obl-1',
          controlId: 'control-1',
          coverage: 'FULL',
        }),
      )
      expect(result).toEqual(
        expect.objectContaining({
          controlId: 'control-1',
          coverage: 'FULL',
        }),
      )
    })

    it('should reject duplicate obligation control maps', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue({
        controlId: 'control-1',
        controlCode: 'CTRL-001',
      })
      mocks.obligationControlMapRepo.findOne.mockResolvedValue({
        id: 'map-1',
        obligationId: 'obl-1',
        controlId: 'control-1',
      })

      await expect(
        service.createControlMap('obl-1', {
          controlId: 'control-1',
          coverage: 'FULL',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('should reject createControlMap when control point does not exist', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createControlMap('obl-1', {
          controlId: 'missing-control',
          coverage: 'FULL',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('should reject createControlMap when obligation does not exist', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createControlMap('missing-obligation', {
          controlId: 'control-1',
          coverage: 'FULL',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(mocks.controlPointRepo.findOne).not.toHaveBeenCalled()
    })
  })

  describe('[P0][AC-3] getCoverageAnalysis', () => {
    it('should aggregate totals, origin distribution, sector coverage, and blind spots', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '应当建立报送复核控制',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          clause: {
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            articleNo: '第1条',
            clauseSummary: '条文摘要',
            source: {
              sourceId: 'source-1',
              sourceCode: 'SRC-001',
              sourceName: '监管指引',
            },
          },
          obligationControlMaps: [
            {
              controlId: 'control-1',
              controlPoint: {
                controlId: 'control-1',
                originType: 'regulation_derived',
                applicableSector: ['银行'],
              },
            },
          ],
        },
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-002',
          obligationText: '不得绕过质量校验',
          obligationType: 'PROHIBITIVE',
          applicableSector: ['证券'],
          clause: {
            clauseId: 'clause-2',
            clauseCode: 'CLAUSE-002',
            articleNo: '第2条',
            clauseSummary: '禁止绕过质量校验',
            source: {
              sourceId: 'source-2',
              sourceCode: 'SRC-002',
              sourceName: '补充规定',
            },
          },
          obligationControlMaps: [],
        },
      ])

      const result = await service.getCoverageAnalysis()
      expect(result.totals).toEqual(
        expect.objectContaining({
          obligations: 2,
          covered: 1,
          uncovered: 1,
        }),
      )
      expect(result.originDistribution.regulation_derived).toBe(1)
      expect(result.sectorCoverage).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sector: '银行', obligations: 1, covered: 1 }),
        ]),
      )
      expect(result.blindSpots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            obligationId: 'obl-2',
            obligationCode: 'OBL-002',
            obligationType: 'PROHIBITIVE',
            source: expect.objectContaining({
              sourceCode: 'SRC-002',
            }),
          }),
        ]),
      )
    })

    it('should surface uncovered obligations from Story 3.3 seed data', async () => {
      const seedData = loadKgSeedData()
      const controlByCode = new Map(
        seedData.controlPoints.map((control) => [control.controlCode, control] as const),
      )

      const obligations = seedData.regulationObligations
        .filter((obligation) => obligation.sourceCode === 'SRC-IT04-REPORTING-001')
        .map((obligation) => {
          const maps = seedData.obligationControlMaps
            .filter((mapping) => mapping.obligationCode === obligation.obligationCode)
            .map((mapping) => ({
              controlId: controlByCode.get(mapping.controlCode)?.controlId ?? mapping.controlCode,
              controlPoint: controlByCode.get(mapping.controlCode) ?? null,
            }))

          return {
            obligationId: obligation.obligationCode,
            applicableSector: obligation.applicableSector ?? [],
            obligationControlMaps: maps,
          }
        })

      const expectedUncovered = obligations.filter(
        (obligation) => obligation.obligationControlMaps.length === 0,
      )

      expect(expectedUncovered.length).toBeGreaterThan(0)

      mocks.obligationRepo.find.mockResolvedValue(obligations as never)

      const result = await service.getCoverageAnalysis()
      expect(result.totals.uncovered).toBe(expectedUncovered.length)
      expect(result.blindSpots).toHaveLength(expectedUncovered.length)
    })

    it('should keep manual origin visible and de-duplicate origin counts by unique controlId', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          clause: null,
          obligationControlMaps: [
            {
              controlId: 'control-1',
              controlPoint: {
                controlId: 'control-1',
                originType: 'manual',
                applicableSector: ['银行'],
              },
            },
            {
              controlId: 'control-1',
              controlPoint: {
                controlId: 'control-1',
                originType: 'manual',
                applicableSector: ['银行'],
              },
            },
          ],
        },
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-002',
          obligationText: '应当建立补充校验',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          clause: null,
          obligationControlMaps: [
            {
              controlId: 'control-2',
              controlPoint: {
                controlId: 'control-2',
                originType: 'candidate',
                applicableSector: ['银行'],
              },
            },
          ],
        },
      ])

      const result = await service.getCoverageAnalysis()

      expect(result.originDistribution.manual).toBe(1)
      expect(result.originDistribution.candidate).toBe(1)
    })

    it('should apply 通用 and empty-sector semantics to sector coverage and blind spots', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '应当建立复核机制',
          obligationType: 'MANDATORY',
          applicableSector: ['通用'],
          clause: null,
          obligationControlMaps: [],
        },
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-002',
          obligationText: '应当建立基金行业专项检查',
          obligationType: 'MANDATORY',
          applicableSector: [],
          clause: null,
          obligationControlMaps: [
            {
              controlId: 'control-2',
              controlPoint: {
                controlId: 'control-2',
                originType: 'regulation_derived',
                applicableSector: [],
              },
            },
          ],
        },
      ])

      const result = await service.getCoverageAnalysis()
      const bankingCoverage = result.sectorCoverage.find((item: any) => item.sector === '银行')
      const fundCoverage = result.sectorCoverage.find((item: any) => item.sector === '基金')

      expect(bankingCoverage).toEqual(
        expect.objectContaining({
          obligations: 2,
          covered: 1,
          coverageRate: 0.5,
        }),
      )
      expect(fundCoverage).toEqual(
        expect.objectContaining({
          obligations: 2,
          covered: 1,
          coverageRate: 0.5,
        }),
      )
      expect(result.blindSpots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            obligationId: 'obl-1',
            applicableSector: ['通用'],
          }),
        ]),
      )
    })

    it('should return zero totals, empty blindSpots, and all-zero originDistribution when no obligations exist', async () => {
      mocks.obligationRepo.find.mockResolvedValue([])

      const result = await service.getCoverageAnalysis()

      expect(result.totals).toEqual({
        obligations: 0,
        covered: 0,
        uncovered: 0,
        coverageRate: 0,
      })
      expect(result.blindSpots).toEqual([])
      Object.values(result.originDistribution).forEach((count) => {
        expect(count).toBe(0)
      })
      expect(result.sectorCoverage.every((s) => s.obligations === 0 && s.covered === 0)).toBe(true)
    })

    it('should return empty blindSpots when all obligations have at least one control map', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '已覆盖的义务',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          clause: null,
          obligationControlMaps: [
            {
              controlId: 'control-1',
              controlPoint: {
                controlId: 'control-1',
                originType: 'case_derived',
                applicableSector: ['银行'],
              },
            },
          ],
        },
        {
          obligationId: 'obl-2',
          obligationCode: 'OBL-002',
          obligationText: '另一个已覆盖的义务',
          obligationType: 'PROHIBITIVE',
          applicableSector: ['证券'],
          clause: null,
          obligationControlMaps: [
            {
              controlId: 'control-2',
              controlPoint: {
                controlId: 'control-2',
                originType: 'regulation_derived',
                applicableSector: ['证券'],
              },
            },
          ],
        },
      ])

      const result = await service.getCoverageAnalysis()

      expect(result.totals.covered).toBe(2)
      expect(result.totals.uncovered).toBe(0)
      expect(result.blindSpots).toEqual([])
    })

    it('should map blind spot with null clause to null clause and null source', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '没有关联条款的义务',
          obligationType: 'RECOMMENDED',
          applicableSector: ['基金'],
          clause: null,
          obligationControlMaps: [],
        },
      ])

      const result = await service.getCoverageAnalysis()

      expect(result.blindSpots).toHaveLength(1)
      expect(result.blindSpots[0]).toEqual(
        expect.objectContaining({
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          clause: null,
          source: null,
        }),
      )
    })

    it('should map blind spot with clause but no source gracefully', async () => {
      mocks.obligationRepo.find.mockResolvedValue([
        {
          obligationId: 'obl-1',
          obligationCode: 'OBL-001',
          obligationText: '有条款无来源的义务',
          obligationType: 'MANDATORY',
          applicableSector: ['银行'],
          clause: {
            clauseId: 'clause-1',
            clauseCode: 'CLAUSE-001',
            articleNo: '第1条',
            clauseSummary: '条款摘要',
            source: null,
          },
          obligationControlMaps: [],
        },
      ])

      const result = await service.getCoverageAnalysis()

      expect(result.blindSpots[0].clause).toEqual({
        clauseId: 'clause-1',
        clauseCode: 'CLAUSE-001',
        articleNo: '第1条',
        clauseSummary: '条款摘要',
      })
      expect(result.blindSpots[0].source).toBeNull()
    })
  })

  describe('[P0][AC-4] findRegulatoryLinksByControlId', () => {
    it('should return obligations as primary source and clauses as fallback source', async () => {
      const obligationQb = mocks.queryBuilderMock
      const clauseQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'clause-map-1',
            clauseId: 'clause-1',
            mappingType: 'direct',
            reviewStatus: 'APPROVED',
            confidenceScore: '0.8',
            clause: {
              clauseId: 'clause-1',
              clauseCode: 'CLAUSE-001',
              articleNo: '第1条',
              sectionPath: '第一章',
              clauseText: '条文全文',
              clauseSummary: '摘要',
              mandatoryLevel: 'MUST',
              source: {
                sourceId: 'source-1',
                sourceCode: 'SRC-001',
                sourceName: '监管指引',
                sourceLevel: 'guideline',
                authorityName: '监管机构',
              },
            },
          },
        ]),
      }
      mocks.obligationControlMapRepo.createQueryBuilder.mockReturnValue(obligationQb)
      obligationQb.getMany.mockResolvedValue([
        {
          id: 'obl-map-1',
          coverage: 'FULL',
          obligation: {
            obligationId: 'obl-1',
            obligationCode: 'OBL-001',
            obligationText: '应当建立复核机制',
            obligationType: 'MANDATORY',
            clause: {
              clauseId: 'clause-1',
              clauseCode: 'CLAUSE-001',
              articleNo: '第1条',
            },
          },
        },
      ])
      mocks.clauseControlMapRepo.createQueryBuilder.mockReturnValue(clauseQb as never)

      const result = await service.findRegulatoryLinksByControlId('control-1')
      expect(result.obligations[0]).toEqual(
        expect.objectContaining({
          obligationId: 'obl-1',
          linkSource: 'obligation',
        }),
      )
      expect(result.clauses[0]).toEqual(
        expect.objectContaining({
          clauseId: 'clause-1',
          linkSource: 'clause',
        }),
      )
    })

    it('should return null source when clause source relation is missing', async () => {
      const obligationQb = mocks.queryBuilderMock
      const clauseQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'clause-map-1',
            clauseId: 'clause-1',
            mappingType: 'direct',
            reviewStatus: 'APPROVED',
            confidenceScore: '0.8',
            clause: {
              clauseId: 'clause-1',
              clauseCode: 'CLAUSE-001',
              articleNo: '第1条',
              sectionPath: '第一章',
              clauseText: '条文全文',
              clauseSummary: '摘要',
              mandatoryLevel: 'MUST',
              source: null,
            },
          },
        ]),
      }
      mocks.obligationControlMapRepo.createQueryBuilder.mockReturnValue(obligationQb)
      obligationQb.getMany.mockResolvedValue([])
      mocks.clauseControlMapRepo.createQueryBuilder.mockReturnValue(clauseQb as never)

      const result = await service.findRegulatoryLinksByControlId('control-1')
      expect(result.clauses[0]).toEqual(
        expect.objectContaining({
          clauseId: 'clause-1',
          source: null,
        }),
      )
    })

    it('should skip orphaned obligation and clause mappings when joined relations are missing', async () => {
      const obligationQb = mocks.queryBuilderMock
      const clauseQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'clause-map-orphan',
            clauseId: 'missing-clause',
            mappingType: 'direct',
            reviewStatus: 'APPROVED',
            confidenceScore: '0.8',
            clause: null,
          },
        ]),
      }
      mocks.obligationControlMapRepo.createQueryBuilder.mockReturnValue(obligationQb)
      obligationQb.getMany.mockResolvedValue([
        {
          id: 'obl-map-orphan',
          coverage: 'FULL',
          obligation: null,
        },
      ])
      mocks.clauseControlMapRepo.createQueryBuilder.mockReturnValue(clauseQb as never)

      const result = await service.findRegulatoryLinksByControlId('control-1')
      expect(result).toEqual({ obligations: [], clauses: [] })
    })
  })

  describe('[P0][AC-4] deleteControlMap', () => {
    it('should delete a control map when it belongs to the given obligation', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })

      const result = await service.deleteControlMap('obl-1', 'map-1')

      expect(mocks.obligationControlMapRepo.delete).toHaveBeenCalledWith({
        id: 'map-1',
        obligationId: 'obl-1',
      })
      expect(mocks.obligationControlMapRepo.findOne).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true, id: 'map-1' })
    })

    it('should reject deleteControlMap when the map belongs to another obligation', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.obligationControlMapRepo.findOne.mockResolvedValue({
        id: 'map-1',
        obligationId: 'obl-2',
        controlId: 'control-1',
      })
      mocks.obligationControlMapRepo.delete.mockResolvedValue({ affected: 0 })

      await expect(service.deleteControlMap('obl-1', 'map-1')).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it('should reject deleteControlMap when the map does not exist', async () => {
      mocks.obligationRepo.findOne.mockResolvedValue({
        obligationId: 'obl-1',
        obligationCode: 'OBL-001',
      })
      mocks.obligationControlMapRepo.delete.mockResolvedValue({ affected: 0 })
      mocks.obligationControlMapRepo.findOne.mockResolvedValue(null)

      await expect(service.deleteControlMap('obl-1', 'missing-map')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })
})
