/**
 * ATDD Acceptance Tests — Story 3-1: DTO class-validator 校验
 */

import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

async function validateDto<T extends object>(DtoClass: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(DtoClass, plain)
  return validate(instance as object, { whitelist: true, forbidNonWhitelisted: true })
}

describe('[AC-3] CreateObligationDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/obligation.dto')
    return mod.CreateObligationDto
  }

  it('should accept a valid payload', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      clauseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      obligationCode: 'OBL-CBRC-12-01',
      obligationText: '银行应当建立数据质量复核机制。',
      obligationType: 'MANDATORY',
      applicableSector: ['银行', '通用'],
      status: 'ACTIVE',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject missing clauseId', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationCode: 'OBL-CBRC-12-01',
      obligationText: '银行应当建立数据质量复核机制。',
      obligationType: 'MANDATORY',
    })
    expect(errors.map((error) => error.property)).toContain('clauseId')
  })

  it('should reject invalid obligationType', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      clauseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      obligationCode: 'OBL-CBRC-12-01',
      obligationText: '银行应当建立数据质量复核机制。',
      obligationType: 'OPTIONAL',
    })
    expect(errors.map((error) => error.property)).toContain('obligationType')
  })

  it('should reject applicableSector values outside allowed domain', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      clauseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      obligationCode: 'OBL-CBRC-12-01',
      obligationText: '银行应当建立数据质量复核机制。',
      obligationType: 'MANDATORY',
      applicableSector: ['制造业'],
    })
    expect(errors.map((error) => error.property)).toContain('applicableSector')
  })
})

describe('[AC-3] UpdateObligationDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/obligation.dto')
    return mod.UpdateObligationDto
  }

  it('should accept partial update', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationText: '更新后的义务描述',
      status: 'INACTIVE',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid status', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      status: 'DELETED',
    })
    expect(errors.map((error) => error.property)).toContain('status')
  })
})

describe('[AC-3] CreateObligationControlMapDto validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/obligation.dto')
    return mod.CreateObligationControlMapDto
  }

  it('should accept valid map payload', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      controlId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coverage: 'FULL',
      notes: '主控制点完全覆盖此义务',
    })
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid coverage enum', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      obligationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      controlId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coverage: 'NONE',
    })
    expect(errors.map((error) => error.property)).toContain('coverage')
  })

  it('should reject missing obligationId', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      controlId: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coverage: 'FULL',
    })
    expect(errors.map((error) => error.property)).toContain('obligationId')
  })
})
