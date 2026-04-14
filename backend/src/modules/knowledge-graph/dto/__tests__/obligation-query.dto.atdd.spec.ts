/**
 * ATDD Acceptance Tests — Story 3-2: Query DTO 校验
 */

import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

async function validateDto<T extends object>(DtoClass: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(DtoClass, plain)
  return validate(instance as object, { whitelist: true, forbidNonWhitelisted: true })
}

describe('[AC-1][AC-3] QueryObligationDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/obligation.dto')
    return mod.QueryObligationDto
  }

  it('should accept valid filters', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationType: 'MANDATORY',
      status: 'ACTIVE',
      applicableSector: '银行',
      keyword: '复核',
      page: 1,
      limit: 20,
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid applicableSector', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      applicableSector: '制造业',
    })
    expect(errors.map((error) => error.property)).toContain('applicableSector')
  })
})

describe('[AC-1] QueryObligationControlMapDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/obligation.dto')
    return mod.QueryObligationControlMapDto
  }

  it('should accept valid coverage filter', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationId: '550e8400-e29b-41d4-a716-446655440000',
      controlId: '660e8400-e29b-41d4-a716-446655440000',
      coverage: 'FULL',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid coverage filter', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      coverage: 'NONE',
    })
    expect(errors.map((error) => error.property)).toContain('coverage')
  })
})
