/**
 * ATDD RED PHASE — Story KG1.5: ControlPointController full-chain 端点
 *
 * 覆盖 AC: 3 (Controller 端点路由注册 + Guard 验证)
 *
 * 所有测试使用 it.skip() — TDD red phase。
 * 当 Controller 新增了 getFullChain 方法后去掉 it.skip() 即可验证。
 *
 * Run: npx jest --testPathPattern="control-point.controller" --no-coverage
 */

import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { ControlPackItem } from '../../../database/entities/control-pack-item.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AuditLogService } from '../../audit/audit-log.service'
import { ControlPointService } from '../services/control-point.service'
import { ControlPointController } from './control-point.controller'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FULL_CHAIN_RESULT = {
  l2Code: 'IT01-01',
  l2Name: '信息安全治理',
  failureModes: [
    {
      failureModeId: '11111111-1111-1111-1111-111111111111',
      failureModeCode: 'FM-DEF-001',
      name: '定义错误',
      category: 'DEFINITION_ERROR',
      controlPoints: [],
    },
  ],
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ControlPointController — Story KG1.5 ATDD (RED PHASE)', () => {
  let controller: ControlPointController
  let service: ControlPointService

  const queryBuilderMock = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControlPointController],
      providers: [
        ControlPointService,
        {
          provide: getRepositoryToken(ControlPoint),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: getRepositoryToken(TaxonomyL1), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(TaxonomyL2), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(FailureModeControlMap),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock) },
        },
        {
          provide: getRepositoryToken(TaxonomyFailureModeMap),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock) },
        },
        {
          provide: getRepositoryToken(ControlPackItem),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock) },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get(ControlPointController)
    service = module.get(ControlPointService)
  })

  // =========================================================================
  // AC3: full-chain 端点
  // =========================================================================

  describe('GET /full-chain/:l2Code — getFullChain', () => {
    it('should have getFullChain method on controller', () => {
      expect(typeof (controller as any).getFullChain).toBe('function')
    })

    it('should call service.findByL2CodeWithFullChain with correct l2Code', async () => {
      jest.spyOn(service as any, 'findByL2CodeWithFullChain').mockResolvedValue(FULL_CHAIN_RESULT)

      const result = await (controller as any).getFullChain('IT01-01')

      expect((service as any).findByL2CodeWithFullChain).toHaveBeenCalledWith('IT01-01')
      expect(result).toEqual(FULL_CHAIN_RESULT)
    })

    it('should propagate NotFoundException when l2Code not found', async () => {
      jest.spyOn(service as any, 'findByL2CodeWithFullChain').mockRejectedValue(
        new NotFoundException('taxonomy_l2 IT99-99 not found'),
      )

      await expect(
        (controller as any).getFullChain('IT99-99'),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
