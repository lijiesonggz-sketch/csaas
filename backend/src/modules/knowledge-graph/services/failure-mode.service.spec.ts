/**
 * ATDD Acceptance Tests — Story 1-4: FailureModeService 业务逻辑
 *
 * 覆盖 AC: 1 (Service 方法), 3 (关联数据返回)
 *
 * 测试方法:
 * - findAll: 分页 + category/status 过滤 + keyword 搜索
 * - findById: 含 taxonomyMaps + controlMaps 关联数据
 * - create: 唯一性校验 (failureModeCode)
 * - update: 唯一性校验 (排除自身) + 空值校验
 * - findByL2Code: JOIN 查询 + l2Code 不存在处理
 * - findControlPointsByFailureMode: 含 relevance + 治理字段
 *
 * Run: npx jest --testPathPattern="failure-mode.service" --no-coverage
 */

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { FailureMode } from '../../../database/entities/failure-mode.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'

// ---------------------------------------------------------------------------
// Dynamic import — service does not exist yet (TDD red phase)
// ---------------------------------------------------------------------------

const loadService = async () => {
  const mod = await import('./failure-mode.service')
  return mod.FailureModeService as new (
    ...args: unknown[]
  ) => InstanceType<typeof mod.FailureModeService>
}

// ---------------------------------------------------------------------------
// Mock repositories
// ---------------------------------------------------------------------------

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
    failureModeRepo: {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    taxonomyFailureModeMapRepo: {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    failureModeControlMapRepo: {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    },
    taxonomyL2Repo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    controlPointRepo: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    queryBuilderMock,
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('FailureModeService', () => {
  let service: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mocks: ReturnType<typeof createMockRepos>

  beforeEach(async () => {
    mocks = createMockRepos()

    const FailureModeServiceClass = await loadService()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailureModeServiceClass,
        { provide: getRepositoryToken(FailureMode), useValue: mocks.failureModeRepo },
        {
          provide: getRepositoryToken(TaxonomyFailureModeMap),
          useValue: mocks.taxonomyFailureModeMapRepo,
        },
        {
          provide: getRepositoryToken(FailureModeControlMap),
          useValue: mocks.failureModeControlMapRepo,
        },
        { provide: getRepositoryToken(TaxonomyL2), useValue: mocks.taxonomyL2Repo },
        { provide: getRepositoryToken(ControlPoint), useValue: mocks.controlPointRepo },
      ],
    }).compile()

    service = module.get(FailureModeServiceClass)
    jest.clearAllMocks()
  })

  // =========================================================================
  // findAll — AC: 1
  // =========================================================================

  describe('[P0][AC-1] findAll', () => {
    it('should return paginated results with default pagination', async () => {
      const mockItems = [
        {
          failureModeId: 'fm-1',
          failureModeCode: 'FM-DEF-001',
          name: '定义错误',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
      ]
      mocks.failureModeRepo.findAndCount.mockResolvedValue([mockItems, 1])

      const result = await service.findAll({ page: 1, limit: 20 })

      expect(result).toEqual({
        items: mockItems,
        total: 1,
        page: 1,
        limit: 20,
      })
    })

    it('should filter by category', async () => {
      mocks.failureModeRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findAll({ category: 'DEFINITION_ERROR', page: 1, limit: 20 })

      const callArgs = mocks.failureModeRepo.findAndCount.mock.calls[0][0]
      expect(callArgs.where.category).toBe('DEFINITION_ERROR')
    })

    it('should filter by status', async () => {
      mocks.failureModeRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findAll({ status: 'ACTIVE', page: 1, limit: 20 })

      const callArgs = mocks.failureModeRepo.findAndCount.mock.calls[0][0]
      expect(callArgs.where.status).toBe('ACTIVE')
    })

    it('should search by keyword across code/name/description using ILike OR', async () => {
      mocks.failureModeRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findAll({ keyword: '数据', page: 1, limit: 20 })

      const callArgs = mocks.failureModeRepo.findAndCount.mock.calls[0][0]
      // keyword triggers multi-field OR search, expect an array of where conditions
      expect(Array.isArray(callArgs.where)).toBe(true)
      expect(callArgs.where.length).toBeGreaterThanOrEqual(3)
    })

    it('should apply pagination skip/take correctly', async () => {
      mocks.failureModeRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findAll({ page: 3, limit: 10 })

      const callArgs = mocks.failureModeRepo.findAndCount.mock.calls[0][0]
      expect(callArgs.skip).toBe(20) // (3 - 1) * 10
      expect(callArgs.take).toBe(10)
    })
  })

  // =========================================================================
  // findById — AC: 1, 3
  // =========================================================================

  describe('[P0][AC-1][AC-3] findById', () => {
    it('should return failure mode with taxonomyMaps containing l2Name', async () => {
      const mockEntity = {
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
        name: '数据定义错误',
        description: '数据元素定义不清',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        taxonomyFailureModeMaps: [
          {
            id: 'map-1',
            l2Code: 'IT04.01',
            notes: null,
            taxonomyL2: { l2Code: 'IT04.01', l2Name: '监管数据报送' },
          },
        ],
        failureModeControlMaps: [],
      }
      mocks.failureModeRepo.findOne.mockResolvedValue(mockEntity)

      const result = await service.findById('fm-uuid-1')

      expect(result.taxonomyMaps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            l2Code: 'IT04.01',
            l2Name: '监管数据报送',
            notes: null,
          }),
        ]),
      )
    })

    it('should return failure mode with controlMaps containing controlCode + relevance', async () => {
      const mockEntity = {
        failureModeId: 'fm-uuid-2',
        failureModeCode: 'FM-REP-001',
        name: '数据报送错误',
        description: null,
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        taxonomyFailureModeMaps: [],
        failureModeControlMaps: [
          {
            id: 'cmap-1',
            controlId: 'ctrl-uuid-1',
            relevance: 'PRIMARY',
            notes: null,
            controlPoint: {
              controlId: 'ctrl-uuid-1',
              controlCode: 'CTRL-REP-001',
              controlName: '数据报送前校验',
            },
          },
        ],
      }
      mocks.failureModeRepo.findOne.mockResolvedValue(mockEntity)

      const result = await service.findById('fm-uuid-2')

      expect(result.controlMaps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            controlId: 'ctrl-uuid-1',
            controlCode: 'CTRL-REP-001',
            controlName: '数据报送前校验',
            relevance: 'PRIMARY',
          }),
        ]),
      )
    })

    it('should throw NotFoundException when failure mode does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue(null)

      await expect(service.findById('nonexistent-uuid')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // =========================================================================
  // create — AC: 1
  // =========================================================================

  describe('[P0][AC-1] create', () => {
    it('should create a failure mode successfully', async () => {
      const dto = {
        failureModeCode: 'FM-NEW-001',
        name: '新失效模式',
        description: null,
        category: 'MAPPING_ERROR' as const,
      }
      const savedEntity = { failureModeId: 'new-uuid', ...dto, status: 'ACTIVE' }

      mocks.failureModeRepo.findOne.mockResolvedValue(null) // no duplicate
      mocks.failureModeRepo.create.mockReturnValue(savedEntity)
      mocks.failureModeRepo.save.mockResolvedValue(savedEntity)

      const result = await service.create(dto)

      expect(result.failureModeCode).toBe('FM-NEW-001')
      expect(mocks.failureModeRepo.save).toHaveBeenCalled()
    })

    it('should throw ConflictException for duplicate failureModeCode', async () => {
      const dto = {
        failureModeCode: 'FM-EXISTING',
        name: '重复',
        category: 'FALSIFICATION' as const,
      }
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'existing-uuid',
        failureModeCode: 'FM-EXISTING',
      })

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException)
    })
  })

  // =========================================================================
  // update — AC: 1
  // =========================================================================

  describe('[P0][AC-1] update', () => {
    it('should update a failure mode successfully', async () => {
      const existing = {
        failureModeId: 'fm-uuid',
        failureModeCode: 'FM-DEF-001',
        name: '旧名称',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        description: null,
      }
      mocks.failureModeRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(null) // no duplicate code

      const dto = { name: '更新后的名称' }
      mocks.failureModeRepo.save.mockResolvedValue({
        ...existing,
        ...dto,
      })

      const result = await service.update('fm-uuid', dto)

      expect(result.name).toBe('更新后的名称')
      expect(mocks.failureModeRepo.save).toHaveBeenCalled()
    })

    it('should throw BadRequestException when non-nullable fields are null', async () => {
      await expect(
        service.update('fm-uuid', { failureModeCode: null as unknown as string }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('should allow updating code to its own existing value without conflict', async () => {
      const existing = {
        failureModeId: 'fm-uuid',
        failureModeCode: 'FM-SELF',
        name: '自更新',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        description: null,
      }
      mocks.failureModeRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(existing) // same code, same id → ok

      mocks.failureModeRepo.save.mockResolvedValue(existing)

      const result = await service.update('fm-uuid', { failureModeCode: 'FM-SELF' })
      expect(result).toBeDefined()
    })

    it('should throw ConflictException when updating code to another existing code', async () => {
      const existing = {
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-AAA',
        name: 'AAA',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
        description: null,
      }
      const other = {
        failureModeId: 'fm-uuid-2',
        failureModeCode: 'FM-BBB',
      }
      mocks.failureModeRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(other) // duplicate found (different id)

      await expect(
        service.update('fm-uuid-1', { failureModeCode: 'FM-BBB' }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('should throw NotFoundException when failure mode does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue(null)

      await expect(service.update('nonexistent-uuid', { name: '不存在' })).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })

  // =========================================================================
  // findByL2Code — AC: 1
  // =========================================================================

  describe('[P0][AC-1] findByL2Code', () => {
    it('should return failure modes associated with the given l2Code', async () => {
      mocks.taxonomyL2Repo.findOne.mockResolvedValue({
        l2Code: 'IT04.01',
        l2Name: '监管数据报送',
      })

      const mockFMs = [
        {
          failureModeId: 'fm-1',
          failureModeCode: 'FM-REP-001',
          name: '报送错误',
          category: 'DEFINITION_ERROR',
          status: 'ACTIVE',
        },
      ]
      // We need the queryBuilder from failureModeRepo for findByL2Code
      const qb = mocks.queryBuilderMock
      mocks.failureModeRepo.createQueryBuilder.mockReturnValue(qb)
      qb.getManyAndCount.mockResolvedValue([mockFMs, 1])

      const result = await service.findByL2Code('IT04.01', { page: 1, limit: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].failureModeCode).toBe('FM-REP-001')
    })

    it('should throw NotFoundException when l2Code does not exist', async () => {
      mocks.taxonomyL2Repo.findOne.mockResolvedValue(null)

      await expect(
        service.findByL2Code('INVALID_CODE', { page: 1, limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // =========================================================================
  // findControlPointsByFailureMode — AC: 1
  // =========================================================================

  describe('[P0][AC-1] findControlPointsByFailureMode', () => {
    it('should return control points with relevance and governance fields', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })

      const mockControlPoints = [
        {
          id: 'cmap-1',
          controlId: 'ctrl-1',
          relevance: 'PRIMARY',
          controlPoint: {
            controlId: 'ctrl-1',
            controlCode: 'CTRL-REP-001',
            controlName: '数据报送前校验',
            maturityLevel: 'hard',
            authoritativeScore: 0.8333,
          },
        },
      ]
      const qb = mocks.queryBuilderMock
      mocks.failureModeControlMapRepo.createQueryBuilder.mockReturnValue(qb)
      qb.getManyAndCount.mockResolvedValue([mockControlPoints, 1])

      const result = await service.findControlPointsByFailureMode('fm-uuid-1', {
        page: 1,
        limit: 20,
      })

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          relevance: 'PRIMARY',
          controlCode: 'CTRL-REP-001',
          controlName: '数据报送前校验',
          maturityLevel: 'hard',
          authoritativeScore: 0.8333,
        }),
      )
    })

    it('should throw NotFoundException when failure mode does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue(null)

      await expect(
        service.findControlPointsByFailureMode('nonexistent-uuid', { page: 1, limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // =========================================================================
  // createTaxonomyMap — 额外实现的方法
  // =========================================================================

  describe('[P1] createTaxonomyMap', () => {
    it('should create a taxonomy-failure mode mapping successfully', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyL2Repo.findOne.mockResolvedValue({
        l2Code: 'IT04.01',
        l2Name: '监管数据报送',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue(null) // no duplicate
      mocks.taxonomyFailureModeMapRepo.create.mockReturnValue({
        id: 'map-uuid-1',
        failureModeId: 'fm-uuid-1',
        l2Code: 'IT04.01',
        notes: '测试备注',
      })
      mocks.taxonomyFailureModeMapRepo.save.mockResolvedValue({
        id: 'map-uuid-1',
        failureModeId: 'fm-uuid-1',
        l2Code: 'IT04.01',
        notes: '测试备注',
      })

      const result = await service.createTaxonomyMap('fm-uuid-1', {
        l2Code: 'IT04.01',
        notes: '测试备注',
      })

      expect(result.l2Code).toBe('IT04.01')
      expect(mocks.taxonomyFailureModeMapRepo.save).toHaveBeenCalled()
    })

    it('should throw NotFoundException when failure mode does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createTaxonomyMap('nonexistent-uuid', { l2Code: 'IT04.01' }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('should throw NotFoundException when l2Code does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyL2Repo.findOne.mockResolvedValue(null)

      await expect(
        service.createTaxonomyMap('fm-uuid-1', { l2Code: 'INVALID' }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('should throw ConflictException when mapping already exists', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyL2Repo.findOne.mockResolvedValue({
        l2Code: 'IT04.01',
        l2Name: '监管数据报送',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue({
        id: 'existing-map-uuid',
        failureModeId: 'fm-uuid-1',
        l2Code: 'IT04.01',
      })

      await expect(
        service.createTaxonomyMap('fm-uuid-1', { l2Code: 'IT04.01' }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  // =========================================================================
  // createControlMap — 额外实现的方法
  // =========================================================================

  describe('[P1] createControlMap', () => {
    it('should create a failure mode-control mapping successfully', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue({
        controlId: 'ctrl-uuid-1',
        controlCode: 'CTRL-REP-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue(null) // no duplicate
      mocks.failureModeControlMapRepo.create.mockReturnValue({
        id: 'cmap-uuid-1',
        failureModeId: 'fm-uuid-1',
        controlId: 'ctrl-uuid-1',
        relevance: 'PRIMARY',
        notes: null,
      })
      mocks.failureModeControlMapRepo.save.mockResolvedValue({
        id: 'cmap-uuid-1',
        failureModeId: 'fm-uuid-1',
        controlId: 'ctrl-uuid-1',
        relevance: 'PRIMARY',
        notes: null,
      })

      const result = await service.createControlMap('fm-uuid-1', {
        controlId: 'ctrl-uuid-1',
        relevance: 'PRIMARY',
      })

      expect(result.relevance).toBe('PRIMARY')
      expect(mocks.failureModeControlMapRepo.save).toHaveBeenCalled()
    })

    it('should throw NotFoundException when failure mode does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createControlMap('nonexistent-uuid', {
          controlId: 'ctrl-uuid-1',
          relevance: 'PRIMARY',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('should throw NotFoundException when control point does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue(null)

      await expect(
        service.createControlMap('fm-uuid-1', {
          controlId: 'nonexistent-ctrl',
          relevance: 'PRIMARY',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('should throw ConflictException when mapping already exists', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.controlPointRepo.findOne.mockResolvedValue({
        controlId: 'ctrl-uuid-1',
        controlCode: 'CTRL-REP-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue({
        id: 'existing-cmap-uuid',
        failureModeId: 'fm-uuid-1',
        controlId: 'ctrl-uuid-1',
      })

      await expect(
        service.createControlMap('fm-uuid-1', {
          controlId: 'ctrl-uuid-1',
          relevance: 'PRIMARY',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('[P1] deleteTaxonomyMap', () => {
    it('should delete an existing taxonomy map', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue({
        id: 'map-uuid-1',
        failureModeId: 'fm-uuid-1',
        l2Code: 'IT04.01',
      })

      const result = await service.deleteTaxonomyMap('fm-uuid-1', 'map-uuid-1')

      expect(result).toEqual({ success: true, id: 'map-uuid-1' })
      expect(mocks.taxonomyFailureModeMapRepo.delete).toHaveBeenCalledWith({ id: 'map-uuid-1' })
    })

    it('should throw NotFoundException when taxonomy map does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue(null)

      await expect(service.deleteTaxonomyMap('fm-uuid-1', 'missing-map')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it('should throw NotFoundException when taxonomy map disappears before delete executes', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue({
        id: 'map-uuid-1',
        failureModeId: 'fm-uuid-1',
        l2Code: 'IT04.01',
      })
      mocks.taxonomyFailureModeMapRepo.delete.mockResolvedValue({ affected: 0 })

      await expect(service.deleteTaxonomyMap('fm-uuid-1', 'map-uuid-1')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it('should throw BadRequestException when taxonomy map belongs to another failure mode', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.taxonomyFailureModeMapRepo.findOne.mockResolvedValue({
        id: 'map-uuid-1',
        failureModeId: 'fm-other',
        l2Code: 'IT04.01',
      })

      await expect(service.deleteTaxonomyMap('fm-uuid-1', 'map-uuid-1')).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })
  })

  describe('[P1] deleteControlMap', () => {
    it('should delete an existing control map', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue({
        id: 'cmap-uuid-1',
        failureModeId: 'fm-uuid-1',
        controlId: 'ctrl-uuid-1',
      })

      const result = await service.deleteControlMap('fm-uuid-1', 'cmap-uuid-1')

      expect(result).toEqual({ success: true, id: 'cmap-uuid-1' })
      expect(mocks.failureModeControlMapRepo.delete).toHaveBeenCalledWith({ id: 'cmap-uuid-1' })
    })

    it('should throw NotFoundException when control map does not exist', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue(null)

      await expect(service.deleteControlMap('fm-uuid-1', 'missing-cmap')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it('should throw NotFoundException when control map disappears before delete executes', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue({
        id: 'cmap-uuid-1',
        failureModeId: 'fm-uuid-1',
        controlId: 'ctrl-uuid-1',
      })
      mocks.failureModeControlMapRepo.delete.mockResolvedValue({ affected: 0 })

      await expect(service.deleteControlMap('fm-uuid-1', 'cmap-uuid-1')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it('should throw BadRequestException when control map belongs to another failure mode', async () => {
      mocks.failureModeRepo.findOne.mockResolvedValue({
        failureModeId: 'fm-uuid-1',
        failureModeCode: 'FM-DEF-001',
      })
      mocks.failureModeControlMapRepo.findOne.mockResolvedValue({
        id: 'cmap-uuid-1',
        failureModeId: 'fm-other',
        controlId: 'ctrl-uuid-1',
      })

      await expect(service.deleteControlMap('fm-uuid-1', 'cmap-uuid-1')).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })
  })
})
