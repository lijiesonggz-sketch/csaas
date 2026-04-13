/**
 * ATDD Acceptance Tests — Story 1-4: 新增 DTO 校验
 *
 * 覆盖 AC: 2 (QueryFailureModeDto, CreateTaxonomyFailureModeMapDto, CreateFailureModeControlMapDto)
 *
 * Run: npx jest --testPathPattern="failure-mode-query.dto.atdd" --no-coverage
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
// QueryFailureModeDto (extends PaginationDto)
// ---------------------------------------------------------------------------

describe('[AC-2] QueryFailureModeDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/failure-mode.dto')
    return mod.QueryFailureModeDto
  }

  it('should accept empty query (all fields optional, defaults apply)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {})
    expect(errors).toHaveLength(0)
  })

  it('should accept valid category filter', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { category: 'DEFINITION_ERROR' })
    expect(errors).toHaveLength(0)
  })

  it('should accept valid status filter', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { status: 'ACTIVE' })
    expect(errors).toHaveLength(0)
  })

  it('should accept keyword filter', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { keyword: '数据报送' })
    expect(errors).toHaveLength(0)
  })

  it('should accept all 7 category values', async () => {
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
      const errors = await validateDto(Dto, { category })
      expect(errors.filter((e) => e.property === 'category')).toHaveLength(0)
    }
  })

  it('should reject invalid category value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { category: 'INVALID_CATEGORY' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'category')).toBe(true)
  })

  it('should reject invalid status value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { status: 'DELETED' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'status')).toBe(true)
  })

  it('should apply pagination defaults (page=1, limit=20)', async () => {
    const Dto = await loadDto()
    const instance = plainToInstance(Dto, {})
    expect((instance as Record<string, unknown>).page).toBe(1)
    expect((instance as Record<string, unknown>).limit).toBe(20)
  })

  it('should reject non-integer page', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { page: 'abc' })
    expect(errors.some((e) => e.property === 'page')).toBe(true)
  })

  it('should reject limit > 100', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { limit: 200 })
    expect(errors.some((e) => e.property === 'limit')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CreateTaxonomyFailureModeMapDto
// ---------------------------------------------------------------------------

describe('[AC-2] CreateTaxonomyFailureModeMapDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/failure-mode.dto')
    return mod.CreateTaxonomyFailureModeMapDto
  }

  it('should accept valid payload with required l2Code', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      l2Code: 'IT04.01',
      notes: '映射备注',
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept valid payload without optional notes', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { l2Code: 'IT04.01' })
    expect(errors).toHaveLength(0)
  })

  it('should reject missing required l2Code', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { notes: 'no l2code' })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'l2Code')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CreateFailureModeControlMapDto
// ---------------------------------------------------------------------------

describe('[AC-2] CreateFailureModeControlMapDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/failure-mode.dto')
    return mod.CreateFailureModeControlMapDto
  }

  it('should accept valid payload with all fields', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: '550e8400-e29b-41d4-a716-446655440000',
      relevance: 'PRIMARY',
      notes: '主要关联',
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept valid payload with SECONDARY relevance', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: '550e8400-e29b-41d4-a716-446655440000',
      relevance: 'SECONDARY',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject missing required controlId', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      relevance: 'PRIMARY',
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'controlId')).toBe(true)
  })

  it('should reject non-UUID controlId', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: 'not-a-uuid',
      relevance: 'PRIMARY',
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'controlId')).toBe(true)
  })

  it('should reject invalid relevance enum', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: '550e8400-e29b-41d4-a716-446655440000',
      relevance: 'TERTIARY',
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.property === 'relevance')).toBe(true)
  })

  it('should accept payload without optional notes', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: '550e8400-e29b-41d4-a716-446655440000',
      relevance: 'PRIMARY',
    })
    expect(errors).toHaveLength(0)
  })
})
