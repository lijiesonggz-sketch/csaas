/**
 * ATDD Tests — Story 2.1: PackResolver maturity_level 过滤集成
 *
 * Acceptance Criteria covered:
 *   AC2: 新 hard 控制点强制校验 pack 关联（在 update 时触发）
 */
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { ControlPackItem } from '../../../database/entities/control-pack-item.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { ControlPointService } from './control-point.service'
import { CreateControlPointDto } from '../dto/control-point.dto'

describe('[Story 2.1 ATDD] Hard 控制点 pack 关联校验', () => {
  let service: ControlPointService

  const controlPointRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const controlPackItemRepository = {
    count: jest.fn(),
    find: jest.fn(),
  }

  const taxonomyL1Repository = { findOne: jest.fn() }
  const taxonomyL2Repository = { findOne: jest.fn() }
  const failureModeControlMapRepository = { createQueryBuilder: jest.fn() }
  const taxonomyFailureModeMapRepository = { createQueryBuilder: jest.fn() }

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

  // Shared existing control point for update tests
  const existingCandidate = {
    controlId: 'uuid-existing',
    controlCode: 'CTRL-CAND-001',
    controlName: '候选控制点',
    l1Code: 'IT04',
    l2Code: 'IT04.03',
    controlFamily: 'REPORTING',
    controlType: 'preventive',
    maturityLevel: 'candidate',
    status: 'ACTIVE',
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPointService,
        { provide: getRepositoryToken(ControlPoint), useValue: controlPointRepository },
        { provide: getRepositoryToken(ControlPackItem), useValue: controlPackItemRepository },
        { provide: getRepositoryToken(TaxonomyL1), useValue: taxonomyL1Repository },
        { provide: getRepositoryToken(TaxonomyL2), useValue: taxonomyL2Repository },
        { provide: getRepositoryToken(FailureModeControlMap), useValue: failureModeControlMapRepository },
        { provide: getRepositoryToken(TaxonomyFailureModeMap), useValue: taxonomyFailureModeMapRepository },
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

  // -----------------------------------------------------------------------
  // T06 — AC2: 更新为 hard 且有 pack 关联 → 成功
  // -----------------------------------------------------------------------
  it('[T06][P0] 更新为 maturity_level=hard 时，有 pack 关联应该成功', async () => {
    controlPointRepository.findOne.mockResolvedValue({ ...existingCandidate })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPackItemRepository.count.mockResolvedValue(2) // has pack association
    controlPointRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.update('uuid-existing', { maturityLevel: 'hard' } as any)

    expect(result).toBeDefined()
    expect(result.maturityLevel).toBe('hard')
    expect(controlPackItemRepository.count).toHaveBeenCalledWith({
      where: { controlId: 'uuid-existing' },
    })
  })

  // -----------------------------------------------------------------------
  // T07 — AC2: 更新为 hard 时无 pack 关联 → 抛出 400
  // -----------------------------------------------------------------------
  it('[T07][P0] 更新为 maturity_level=hard 时，无 pack 关联应该抛出 BadRequestException', async () => {
    controlPointRepository.findOne.mockResolvedValue({ ...existingCandidate })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPackItemRepository.count.mockResolvedValue(0) // NO pack association

    await expect(
      service.update('uuid-existing', { maturityLevel: 'hard' } as any),
    ).rejects.toThrow('hard control point 必须关联至少一个 control_pack')
  })

  // -----------------------------------------------------------------------
  // T08 — AC2: 已是 hard 的控制点更新其他字段时也需要校验 pack 关联
  // -----------------------------------------------------------------------
  it('[T08][P0] 已是 hard 的控制点更新其他字段时，也需要校验 pack 关联', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      ...existingCandidate,
      maturityLevel: 'hard',
    })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPackItemRepository.count.mockResolvedValue(0) // NO pack association

    await expect(
      service.update('uuid-existing', { controlName: '新名称' } as any),
    ).rejects.toThrow(BadRequestException)
  })

  // -----------------------------------------------------------------------
  // T09 — AC2: draft-hard 不需要强制 pack 关联
  // -----------------------------------------------------------------------
  it('[T09][P1] 更新为 maturity_level=draft-hard 时，不需要 pack 关联校验', async () => {
    controlPointRepository.findOne.mockResolvedValue({ ...existingCandidate })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPointRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.update('uuid-existing', { maturityLevel: 'draft-hard' } as any)

    expect(result).toBeDefined()
    expect(result.maturityLevel).toBe('draft-hard')
    expect(controlPackItemRepository.count).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // T10 — hard → candidate 降级不触发 pack 校验
  // -----------------------------------------------------------------------
  it('[T10][P0] hard → candidate 降级时，不需要 pack 关联校验', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      ...existingCandidate,
      maturityLevel: 'hard',
    })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPointRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.update('uuid-existing', { maturityLevel: 'candidate' } as any)

    expect(result).toBeDefined()
    expect(result.maturityLevel).toBe('candidate')
    expect(controlPackItemRepository.count).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // T11 — hard → draft-hard 降级不触发 pack 校验
  // -----------------------------------------------------------------------
  it('[T11][P1] hard → draft-hard 降级时，不需要 pack 关联校验', async () => {
    controlPointRepository.findOne.mockResolvedValue({
      ...existingCandidate,
      maturityLevel: 'hard',
    })
    taxonomyL1Repository.findOne.mockResolvedValue({ l1Code: 'IT04' })
    taxonomyL2Repository.findOne.mockResolvedValue({ l2Code: 'IT04.03', l1Code: 'IT04' })
    controlPointRepository.save.mockImplementation(async (entity) => entity)

    const result = await service.update('uuid-existing', { maturityLevel: 'draft-hard' } as any)

    expect(result).toBeDefined()
    expect(result.maturityLevel).toBe('draft-hard')
    expect(controlPackItemRepository.count).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // T12 — CreateControlPointDto 不暴露 maturityLevel，新建只能是 candidate
  // -----------------------------------------------------------------------
  it('[T12][P0] CreateControlPointDto 不包含 maturityLevel 字段，新建控制点默认 candidate', () => {
    const dto = new CreateControlPointDto()
    expect((dto as any).maturityLevel).toBeUndefined()
  })
})
