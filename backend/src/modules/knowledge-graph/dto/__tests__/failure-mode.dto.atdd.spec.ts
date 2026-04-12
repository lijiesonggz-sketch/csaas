/**
 * ATDD Acceptance Tests — Story 1-1: DTO class-validator 校验
 *
 * AC-3: DTO 使用 class-validator 装饰器，枚举字段有 @IsEnum() 校验
 *
 * Run: npx jest --testPathPattern="failure-mode.*dto.*atdd" --no-coverage
 */

import 'reflect-metadata'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function validateDto<T extends object>(DtoClass: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(DtoClass, plain)
  const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: true })
  return errors
}

// ---------------------------------------------------------------------------
// AC-3: CreateFailureModeDto
// ---------------------------------------------------------------------------

describe('[AC-3] CreateFailureModeDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/failure-mode.dto')
    return mod.CreateFailureModeDto
  }

  it('should accept a valid payload', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      failureModeCode: 'FM-DEF-001',
      name: '数据定义错误',
      description: '因数据元素定义不清导致的合规失效',
      category: 'DEFINITION_ERROR',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject missing required field: failureModeCode', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      name: '数据定义错误',
      category: 'DEFINITION_ERROR',
    })
    expect(errors.length).toBeGreaterThan(0)
    const fieldNames = errors.map((e) => e.property)
    expect(fieldNames).toContain('failureModeCode')
  })

  it('should reject missing required field: name', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      failureModeCode: 'FM-DEF-001',
      category: 'DEFINITION_ERROR',
    })
    expect(errors.length).toBeGreaterThan(0)
    const fieldNames = errors.map((e) => e.property)
    expect(fieldNames).toContain('name')
  })

  it('should reject missing required field: category', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      failureModeCode: 'FM-DEF-001',
      name: '数据定义错误',
    })
    expect(errors.length).toBeGreaterThan(0)
    const fieldNames = errors.map((e) => e.property)
    expect(fieldNames).toContain('category')
  })

  it('should reject invalid category enum value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      failureModeCode: 'FM-DEF-001',
      name: '数据定义错误',
      category: 'INVALID_CATEGORY',
    })
    expect(errors.length).toBeGreaterThan(0)
    const categoryError = errors.find((e) => e.property === 'category')
    expect(categoryError).toBeDefined()
    // Should have @IsIn constraint violation (validates against allowed values)
    expect(categoryError!.constraints).toBeDefined()
    expect(Object.keys(categoryError!.constraints!).some((k) => k.toLowerCase().includes('isin') || k.toLowerCase().includes('enum'))).toBe(true)
  })

  it('should accept all 7 valid category values', async () => {
    const Dto = await loadDto()
    const validCategories = [
      'DEFINITION_ERROR',
      'MAPPING_ERROR',
      'MISSING_CONTROL',
      'TIMELINESS_FAILURE',
      'INTEGRITY_FAILURE',
      'UNAUTHORIZED_ACTION',
      'FALSIFICATION',
    ]
    for (const category of validCategories) {
      const errors = await validateDto(Dto, {
        failureModeCode: `FM-TEST-${category.slice(0, 3)}`,
        name: `测试 ${category}`,
        category,
      })
      expect(errors.filter((e) => e.property === 'category')).toHaveLength(0)
    }
  })

  it('should reject invalid status enum if provided', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      failureModeCode: 'FM-DEF-001',
      name: '数据定义错误',
      category: 'DEFINITION_ERROR',
      status: 'BOGUS_STATUS',
    })
    // Either status is rejected because of enum validation, or it's not whitelisted
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AC-3: UpdateFailureModeDto
// ---------------------------------------------------------------------------

describe('[AC-3] UpdateFailureModeDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/failure-mode.dto')
    return mod.UpdateFailureModeDto
  }

  it('should accept a partial update (only name)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      name: '更新后的名称',
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept a partial update (only category)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      category: 'FALSIFICATION',
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept an empty payload (all fields optional)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {})
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid category enum value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      category: 'NOT_A_REAL_CATEGORY',
    })
    expect(errors.length).toBeGreaterThan(0)
    const categoryError = errors.find((e) => e.property === 'category')
    expect(categoryError).toBeDefined()
  })

  it('should reject invalid status enum value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      status: 'DELETED',
    })
    // 'DELETED' is not in FAILURE_MODE_STATUSES (only ACTIVE/INACTIVE)
    expect(errors.length).toBeGreaterThan(0)
  })
})
