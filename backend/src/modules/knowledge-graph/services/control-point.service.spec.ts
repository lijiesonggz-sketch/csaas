import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { ControlPointService } from './control-point.service'

describe('ControlPointService', () => {
  let service: ControlPointService

  const controlPointRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const taxonomyL1Repository = {
    findOne: jest.fn(),
  }

  const taxonomyL2Repository = {
    findOne: jest.fn(),
  }

  const failureModeControlMapRepository = {
    createQueryBuilder: jest.fn(),
  }

  const taxonomyFailureModeMapRepository = {
    createQueryBuilder: jest.fn(),
  }

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPointService,
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
        {
          provide: getRepositoryToken(FailureModeControlMap),
          useValue: failureModeControlMapRepository,
        },
        {
          provide: getRepositoryToken(TaxonomyFailureModeMap),
          useValue: taxonomyFailureModeMapRepository,
        },
      ],
    }).compile()

    service = module.get(ControlPointService)
    jest.clearAllMocks()
    queryBuilder.select.mockClear().mockReturnThis()
    queryBuilder.addSelect.mockClear().mockReturnThis()
    queryBuilder.andWhere.mockClear().mockReturnThis()
    queryBuilder.where.mockClear().mockReturnThis()
    queryBuilder.orderBy.mockClear().mockReturnThis()
    queryBuilder.addOrderBy.mockClear().mockReturnThis()
    queryBuilder.skip.mockClear().mockReturnThis()
    queryBuilder.take.mockClear().mockReturnThis()
    queryBuilder.innerJoin.mockClear().mockReturnThis()
    queryBuilder.leftJoin.mockClear().mockReturnThis()
    queryBuilder.getManyAndCount.mockClear()
    queryBuilder.getRawMany.mockClear().mockResolvedValue([])
    queryBuilder.getMany.mockClear().mockResolvedValue([])
    controlPointRepository.createQueryBuilder.mockReturnValue(queryBuilder)
    failureModeControlMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)
    taxonomyFailureModeMapRepository.createQueryBuilder.mockReturnValue(queryBuilder)
  })

  it('should reject invalid l1Code/l2Code hierarchy relations', async () => {
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT02' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04-06', l1Code: 'IT04' })

    await expect(
      service.create({
        controlCode: 'CTRL-ACC-021',
        controlName: 'Privileged Session Review Control',
        controlDesc: 'desc',
        l1Code: 'IT02',
        l2Code: 'IT04-06',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['CISO'],
        status: 'ACTIVE',
      }),
    ).rejects.toThrow('Invalid l1Code/l2Code hierarchy relation')
  })

  it('should reject duplicate controlCode before save', async () => {
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT02' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT02-03', l1Code: 'IT02' })
    controlPointRepository.findOne
      .mockResolvedValueOnce({ controlId: 'existing', controlCode: 'CTRL-ACC-002' })
      .mockResolvedValueOnce(null)

    await expect(
      service.create({
        controlCode: 'CTRL-ACC-002',
        controlName: 'Privileged Session Review Control',
        controlDesc: 'desc',
        l1Code: 'IT02',
        l2Code: 'IT02-03',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['CISO'],
        status: 'ACTIVE',
      }),
    ).rejects.toThrow('control_code CTRL-ACC-002 already exists')
  })

  it('should update status without deleting control point', async () => {
    const existing = {
      controlId: 'control-id',
      status: 'ACTIVE',
    }
    controlPointRepository.findOne.mockResolvedValue(existing)
    controlPointRepository.save.mockResolvedValue({
      ...existing,
      status: 'INACTIVE',
    })

    const result = await service.updateStatus('control-id', { status: 'INACTIVE' })

    expect(controlPointRepository.save).toHaveBeenCalledWith({
      controlId: 'control-id',
      status: 'INACTIVE',
    })
    expect(result.status).toBe('INACTIVE')
  })

  it('should reject null controlType on update before mutating the entity', async () => {
    await expect(
      service.update('control-id', {
        controlType: null as never,
      }),
    ).rejects.toThrow('controlType cannot be null')

    expect(controlPointRepository.findOne).not.toHaveBeenCalled()
  })

  it('should search keyword across code name desc and semantic metadata', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

    await service.findAll({
      keyword: '反洗钱',
      page: 1,
      limit: 20,
    })

    expect(controlPointRepository.createQueryBuilder).toHaveBeenCalledWith('control')
    expect(queryBuilder.andWhere).toHaveBeenCalled()
    expect(queryBuilder.getManyAndCount).toHaveBeenCalled()
  })

  // ===========================================================================
  // Story KG1.5 ATDD (RED PHASE) — findAll 新增过滤条件 + 排序
  // 覆盖 AC: 1 (新查询条件), 2 (applicableSector 数组过滤)
  // ===========================================================================

  describe('[P0][KG1.5-AC1] findAll — 新增过滤条件', () => {
    it('should filter by originType', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        originType: 'regulation_derived',
        page: 1,
        limit: 20,
      } as any)

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const originCall = andWhereCalls.find(
        (call: [string, Record<string, string>]) => call[0].includes('originType') || call[0].includes('origin_type'),
      )
      expect(originCall).toBeDefined()
    })

    it('should filter by maturityLevel', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        maturityLevel: 'hard',
        page: 1,
        limit: 20,
      } as any)

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const maturityCall = andWhereCalls.find(
        (call: [string, Record<string, string>]) => call[0].includes('maturityLevel') || call[0].includes('maturity_level'),
      )
      expect(maturityCall).toBeDefined()
    })

    it('should filter by applicableSector using PostgreSQL array @> operator', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        applicableSector: '银行',
        page: 1,
        limit: 20,
      } as any)

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const sectorCall = andWhereCalls.find(
        (call: [string]) => call[0].includes('@>') && call[0].includes('ARRAY'),
      )
      expect(sectorCall).toBeDefined()
    })

    it('should match both specific sector and 通用 in applicableSector filter', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        applicableSector: '银行',
        page: 1,
        limit: 20,
      } as any)

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const sectorCall = andWhereCalls.find(
        (call: [string]) => call[0].includes('通用'),
      )
      expect(sectorCall).toBeDefined()
    })

    it('should filter by failureModeId using EXISTS subquery', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        failureModeId: '11111111-1111-1111-1111-111111111111',
        page: 1,
        limit: 20,
      } as any)

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const existsCall = andWhereCalls.find(
        (call: [string]) => call[0].includes('EXISTS'),
      )
      expect(existsCall).toBeDefined()
      expect(existsCall![0]).toContain('failure_mode_control_maps')
    })

    it('should support combined filters (originType + maturityLevel + failureModeId)', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({
        originType: 'regulation_derived',
        maturityLevel: 'hard',
        failureModeId: '11111111-1111-1111-1111-111111111111',
        page: 1,
        limit: 20,
      } as any)

      // 至少 3 次 andWhere（originType + maturityLevel + failureModeId）
      expect(queryBuilder.andWhere.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('[P0][KG1.5-AC1] findAll — maturity_level 排序', () => {
    it('should sort by maturity_level CASE priority (hard=0 > draft-hard=1 > candidate=2 > retired=3)', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({ page: 1, limit: 20 })

      const orderByCalls = queryBuilder.orderBy.mock.calls
      expect(orderByCalls.length).toBeGreaterThanOrEqual(1)
      const firstOrderBy = orderByCalls[0][0] as string
      expect(firstOrderBy).toContain('CASE')
      expect(firstOrderBy).toContain('hard')
      expect(firstOrderBy).toContain('retired')
    })

    it('should sort by authoritativeScore DESC within same maturity_level', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({ page: 1, limit: 20 })

      const addOrderByCalls = queryBuilder.addOrderBy.mock.calls
      const scoreSort = addOrderByCalls.find(
        (call: [string, string]) =>
          call[0].includes('authoritativeScore') || call[0].includes('authoritative_score'),
      )
      expect(scoreSort).toBeDefined()
      expect(scoreSort![1]).toBe('DESC')
    })

    it('should sort by controlCode ASC as final tiebreaker', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      await service.findAll({ page: 1, limit: 20 })

      const addOrderByCalls = queryBuilder.addOrderBy.mock.calls
      const codeSort = addOrderByCalls.find(
        (call: [string, string]) =>
          call[0].includes('controlCode') || call[0].includes('control_code'),
      )
      expect(codeSort).toBeDefined()
      expect(codeSort![1]).toBe('ASC')
    })
  })

  // ===========================================================================
  // Story KG1.5 ATDD (RED PHASE) — findByL2CodeWithFullChain
  // 覆盖 AC: 3 (全链路 JOIN 查询)
  // ===========================================================================

  describe('[P0][KG1.5-AC3] findByL2CodeWithFullChain', () => {
    const L2_FIXTURE = { l2Code: 'IT01-01', l1Code: 'IT01', l2Name: '信息安全治理', status: 'ACTIVE' }

    const FULL_CHAIN_RAW = [
      {
        l2_code: 'IT01-01',
        l2_name: '信息安全治理',
        failure_mode_id: '11111111-1111-1111-1111-111111111111',
        failure_mode_code: 'FM-DEF-001',
        fm_name: '定义错误',
        fm_category: 'DEFINITION_ERROR',
        control_id: '33333333-3333-3333-3333-333333333333',
        control_code: 'CTRL-ACC-001',
        control_name: '访问控制策略',
        maturity_level: 'hard',
        authoritative_score: '0.8333',
        relevance: 'PRIMARY',
        evidence_id: '66666666-6666-6666-6666-666666666666',
        evidence_code: 'EV-POL-001',
        evidence_name: '策略文档',
        evidence_category: 'POLICY',
        auto_collectable: false,
        required_level: 'REQUIRED',
        frequency: 'ANNUALLY',
      },
      {
        l2_code: 'IT01-01',
        l2_name: '信息安全治理',
        failure_mode_id: '11111111-1111-1111-1111-111111111111',
        failure_mode_code: 'FM-DEF-001',
        fm_name: '定义错误',
        fm_category: 'DEFINITION_ERROR',
        control_id: '44444444-4444-4444-4444-444444444444',
        control_code: 'CTRL-ACC-002',
        control_name: '访问控制审计',
        maturity_level: 'candidate',
        authoritative_score: '0.5',
        relevance: 'SECONDARY',
        evidence_id: null,
        evidence_code: null,
        evidence_name: null,
        evidence_category: null,
        auto_collectable: null,
        required_level: null,
        frequency: null,
      },
    ]

    it('should return structured chain data grouped by failure mode', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      const result = await (service as any).findByL2CodeWithFullChain('IT01-01')

      expect(result.l2Code).toBe('IT01-01')
      expect(result.l2Name).toBe('信息安全治理')
      expect(result.failureModes).toHaveLength(1)
      expect(result.failureModes[0].failureModeCode).toBe('FM-DEF-001')
      expect(result.failureModes[0].controlPoints).toHaveLength(2)
    })

    it('should throw NotFoundException when l2Code does not exist', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(null)

      await expect(
        (service as any).findByL2CodeWithFullChain('IT99-99'),
      ).rejects.toThrow(NotFoundException)
    })

    it('should return empty failureModes when l2Code exists but no associated data', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue([])

      const result = await (service as any).findByL2CodeWithFullChain('IT01-01')

      expect(result.l2Code).toBe('IT01-01')
      expect(result.failureModes).toEqual([])
    })

    it('should have empty evidenceTypes array for control points without evidence', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      const result = await (service as any).findByL2CodeWithFullChain('IT01-01')

      const candidateCp = result.failureModes[0].controlPoints.find(
        (cp: { controlId: string }) => cp.controlId === '44444444-4444-4444-4444-444444444444',
      )
      expect(candidateCp).toBeDefined()
      expect(candidateCp.evidenceTypes).toEqual([])
    })

    it('should sort hard control points before candidate', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      const result = await (service as any).findByL2CodeWithFullChain('IT01-01')

      const cps = result.failureModes[0].controlPoints
      const hardIndex = cps.findIndex((cp: { maturityLevel: string }) => cp.maturityLevel === 'hard')
      const candidateIndex = cps.findIndex((cp: { maturityLevel: string }) => cp.maturityLevel === 'candidate')
      expect(hardIndex).toBeLessThan(candidateIndex)
    })

    it('should exclude retired control points via andWhere', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      await (service as any).findByL2CodeWithFullChain('IT01-01')

      const andWhereCalls = queryBuilder.andWhere.mock.calls
      const retiredFilter = andWhereCalls.find(
        (call: [string, Record<string, unknown>]) => call[0].includes('retired'),
      )
      expect(retiredFilter).toBeDefined()
    })

    it('should use multiple INNER JOINs for the full chain', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      await (service as any).findByL2CodeWithFullChain('IT01-01')

      expect(queryBuilder.innerJoin.mock.calls.length).toBeGreaterThanOrEqual(4)
    })

    it('should use LEFT JOIN for evidence chain (cem + et)', async () => {
      taxonomyL2Repository.findOne.mockResolvedValue(L2_FIXTURE)
      queryBuilder.getRawMany.mockResolvedValue(FULL_CHAIN_RAW)

      await (service as any).findByL2CodeWithFullChain('IT01-01')

      expect(queryBuilder.leftJoin.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
