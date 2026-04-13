/**
 * ATDD RED PHASE — Story KG1.5: QueryControlPointDto 扩展校验
 *
 * 覆盖 AC: 4 (DTO 更新 + class-validator 校验)
 *
 * 所有测试使用 it.skip() — TDD red phase。
 * 当 QueryControlPointDto 扩展了 originType/maturityLevel/applicableSector/failureModeId 后
 * 去掉 it.skip() 即可验证。
 *
 * Run: npx jest --testPathPattern="control-point.dto" --no-coverage
 */

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import {
  CONTROL_POINT_ORIGIN_TYPES,
  CONTROL_POINT_MATURITY_LEVELS,
  APPLICABLE_SECTORS,
} from '../../../database/entities/control-point.entity'
import { QueryControlPointDto } from './control-point.dto'

describe('QueryControlPointDto — Story KG1.5 ATDD (RED PHASE)', () => {
  // =========================================================================
  // AC4: originType 校验
  // =========================================================================

  describe('originType field', () => {
    it('should accept valid originType values from CONTROL_POINT_ORIGIN_TYPES enum', async () => {
      for (const validType of CONTROL_POINT_ORIGIN_TYPES) {
        const dto = plainToInstance(QueryControlPointDto, { originType: validType })
        const errors = await validate(dto)
        const originErrors = errors.filter((e) => e.property === 'originType')
        expect(originErrors).toHaveLength(0)
      }
    })

    it('should reject invalid originType value', async () => {
      const dto = plainToInstance(QueryControlPointDto, { originType: 'invalid_type' })
      const errors = await validate(dto)
      const originErrors = errors.filter((e) => e.property === 'originType')
      expect(originErrors.length).toBeGreaterThan(0)
    })

    it('should allow originType to be undefined (optional)', async () => {
      const dto = plainToInstance(QueryControlPointDto, {})
      const errors = await validate(dto)
      const originErrors = errors.filter((e) => e.property === 'originType')
      expect(originErrors).toHaveLength(0)
    })
  })

  // =========================================================================
  // AC4: maturityLevel 校验
  // =========================================================================

  describe('maturityLevel field', () => {
    it('should accept valid maturityLevel values from CONTROL_POINT_MATURITY_LEVELS enum', async () => {
      for (const validLevel of CONTROL_POINT_MATURITY_LEVELS) {
        const dto = plainToInstance(QueryControlPointDto, { maturityLevel: validLevel })
        const errors = await validate(dto)
        const levelErrors = errors.filter((e) => e.property === 'maturityLevel')
        expect(levelErrors).toHaveLength(0)
      }
    })

    it('should reject invalid maturityLevel value', async () => {
      const dto = plainToInstance(QueryControlPointDto, { maturityLevel: 'super_hard' })
      const errors = await validate(dto)
      const levelErrors = errors.filter((e) => e.property === 'maturityLevel')
      expect(levelErrors.length).toBeGreaterThan(0)
    })

    it('should allow maturityLevel to be undefined (optional)', async () => {
      const dto = plainToInstance(QueryControlPointDto, {})
      const errors = await validate(dto)
      const levelErrors = errors.filter((e) => e.property === 'maturityLevel')
      expect(levelErrors).toHaveLength(0)
    })
  })

  // =========================================================================
  // AC4: applicableSector 校验
  // =========================================================================

  describe('applicableSector field', () => {
    it('should accept valid applicableSector values from APPLICABLE_SECTORS', async () => {
      for (const validSector of APPLICABLE_SECTORS) {
        const dto = plainToInstance(QueryControlPointDto, { applicableSector: validSector })
        const errors = await validate(dto)
        const sectorErrors = errors.filter((e) => e.property === 'applicableSector')
        expect(sectorErrors).toHaveLength(0)
      }
    })

    it('should reject invalid applicableSector value', async () => {
      const dto = plainToInstance(QueryControlPointDto, { applicableSector: 'invalid_sector' })
      const errors = await validate(dto)
      const sectorErrors = errors.filter((e) => e.property === 'applicableSector')
      expect(sectorErrors.length).toBeGreaterThan(0)
    })

    it('should allow applicableSector to be undefined (optional)', async () => {
      const dto = plainToInstance(QueryControlPointDto, {})
      const errors = await validate(dto)
      const sectorErrors = errors.filter((e) => e.property === 'applicableSector')
      expect(sectorErrors).toHaveLength(0)
    })
  })

  // =========================================================================
  // AC4: failureModeId 校验
  // =========================================================================

  describe('failureModeId field', () => {
    it('should accept valid UUID format for failureModeId', async () => {
      const dto = plainToInstance(QueryControlPointDto, {
        failureModeId: '123e4567-e89b-12d3-a456-426614174000',
      })
      const errors = await validate(dto)
      const idErrors = errors.filter((e) => e.property === 'failureModeId')
      expect(idErrors).toHaveLength(0)
    })

    it('should reject invalid UUID format for failureModeId', async () => {
      const dto = plainToInstance(QueryControlPointDto, {
        failureModeId: 'not-a-uuid',
      })
      const errors = await validate(dto)
      const idErrors = errors.filter((e) => e.property === 'failureModeId')
      expect(idErrors.length).toBeGreaterThan(0)
    })

    it('should allow failureModeId to be undefined (optional)', async () => {
      const dto = plainToInstance(QueryControlPointDto, {})
      const errors = await validate(dto)
      const idErrors = errors.filter((e) => e.property === 'failureModeId')
      expect(idErrors).toHaveLength(0)
    })
  })

  // =========================================================================
  // 向后兼容：现有字段不受影响
  // =========================================================================

  describe('backward compatibility — existing fields', () => {
    it('should still validate existing status/l1Code/l2Code/keyword fields correctly', async () => {
      const dto = plainToInstance(QueryControlPointDto, {
        status: 'ACTIVE',
        l1Code: 'IT01',
        l2Code: 'IT01-01',
        keyword: '访问控制',
        page: 1,
        limit: 20,
      })
      const errors = await validate(dto)
      const fieldNames = ['status', 'l1Code', 'l2Code', 'keyword', 'page', 'limit']
      for (const field of fieldNames) {
        expect(errors.filter((e) => e.property === field)).toHaveLength(0)
      }
    })
  })
})
