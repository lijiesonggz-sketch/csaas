/**
 * ATDD Acceptance Tests — Story 1-3: DTO class-validator 校验（证据模型扩展）
 *
 * AC-4: DTO 使用 class-validator 装饰器校验新增字段
 *
 * Run: npx jest --testPathPattern="evidence-extension.*dto.*atdd" --no-coverage
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
// AC-4: CreateEvidenceTypeDto — autoCollectable field
// ---------------------------------------------------------------------------

describe('[AC-4] CreateEvidenceTypeDto — autoCollectable validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/evidence.dto')
    return mod.CreateEvidenceTypeDto
  }

  it('should accept payload with autoCollectable=true', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      evidenceCode: 'EVD-POL-001',
      evidenceName: '安全策略文档',
      autoCollectable: true,
    })
    expect(errors.filter((e) => e.property === 'autoCollectable')).toHaveLength(0)
  })

  it('should accept payload with autoCollectable=false', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      evidenceCode: 'EVD-POL-001',
      evidenceName: '安全策略文档',
      autoCollectable: false,
    })
    expect(errors.filter((e) => e.property === 'autoCollectable')).toHaveLength(0)
  })

  it('should accept payload without autoCollectable (optional)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      evidenceCode: 'EVD-POL-001',
      evidenceName: '安全策略文档',
    })
    expect(errors.filter((e) => e.property === 'autoCollectable')).toHaveLength(0)
  })

  it('should reject non-boolean autoCollectable value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      evidenceCode: 'EVD-POL-001',
      evidenceName: '安全策略文档',
      autoCollectable: 'yes',
    })
    expect(errors.length).toBeGreaterThan(0)
    const autoCollectableError = errors.find((e) => e.property === 'autoCollectable')
    expect(autoCollectableError).toBeDefined()
  })

  it('should accept all 8 new evidence_category values', async () => {
    const Dto = await loadDto()
    const newCategories = [
      'POLICY', 'PROCESS', 'SYSTEM', 'LOG',
      'APPROVAL_RECORD', 'REPORT', 'CONFIG', 'SAMPLE_RECORD',
    ]
    for (const cat of newCategories) {
      const errors = await validateDto(Dto, {
        evidenceCode: `EVD-${cat.slice(0, 3)}-001`,
        evidenceName: `测试 ${cat}`,
        evidenceCategory: cat,
      })
      expect(errors.filter((e) => e.property === 'evidenceCategory')).toHaveLength(0)
    }
  })

  it('should reject old evidence_category values', async () => {
    const Dto = await loadDto()
    const oldCategories = ['document', 'approval', 'record']
    for (const cat of oldCategories) {
      const errors = await validateDto(Dto, {
        evidenceCode: 'EVD-OLD-001',
        evidenceName: '旧分类测试',
        evidenceCategory: cat,
      })
      const catError = errors.find((e) => e.property === 'evidenceCategory')
      expect(catError).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateEvidenceTypeDto — autoCollectable field
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateEvidenceTypeDto — autoCollectable validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/evidence.dto')
    return mod.UpdateEvidenceTypeDto
  }

  it('should accept partial update with autoCollectable=true', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { autoCollectable: true })
    expect(errors.filter((e) => e.property === 'autoCollectable')).toHaveLength(0)
  })

  it('should reject non-boolean autoCollectable', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { autoCollectable: 'invalid' })
    expect(errors.length).toBeGreaterThan(0)
    const autoCollectableError = errors.find((e) => e.property === 'autoCollectable')
    expect(autoCollectableError).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AC-4: CreateControlEvidenceMapDto — frequency, ownerRole, samplingRequirement
// ---------------------------------------------------------------------------

describe('[AC-4] CreateControlEvidenceMapDto — new fields validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/evidence.dto')
    return mod.CreateControlEvidenceMapDto
  }

  const validBase = {
    controlId: '550e8400-e29b-41d4-a716-446655440000',
    evidenceId: '550e8400-e29b-41d4-a716-446655440001',
  }

  it('should accept valid frequency enum values', async () => {
    const Dto = await loadDto()
    const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'EVENT_TRIGGERED']
    for (const freq of validFrequencies) {
      const errors = await validateDto(Dto, { ...validBase, frequency: freq })
      expect(errors.filter((e) => e.property === 'frequency')).toHaveLength(0)
    }
  })

  it('should reject invalid frequency value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ...validBase, frequency: 'HOURLY' })
    expect(errors.length).toBeGreaterThan(0)
    const freqError = errors.find((e) => e.property === 'frequency')
    expect(freqError).toBeDefined()
  })

  it('should accept valid ownerRole string', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ...validBase, ownerRole: '信息安全经理' })
    expect(errors.filter((e) => e.property === 'ownerRole')).toHaveLength(0)
  })

  it('should reject ownerRole exceeding 100 characters', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ...validBase, ownerRole: 'A'.repeat(101) })
    expect(errors.length).toBeGreaterThan(0)
    const roleError = errors.find((e) => e.property === 'ownerRole')
    expect(roleError).toBeDefined()
  })

  it('should reject empty ownerRole string', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ...validBase, ownerRole: '' })
    expect(errors.length).toBeGreaterThan(0)
    const roleError = errors.find((e) => e.property === 'ownerRole')
    expect(roleError).toBeDefined()
  })

  it('should accept valid samplingRequirement enum values', async () => {
    const Dto = await loadDto()
    const validReqs = ['FULL', 'SAMPLING', 'KEY_SAMPLE']
    for (const req of validReqs) {
      const errors = await validateDto(Dto, { ...validBase, samplingRequirement: req })
      expect(errors.filter((e) => e.property === 'samplingRequirement')).toHaveLength(0)
    }
  })

  it('should reject invalid samplingRequirement value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ...validBase, samplingRequirement: 'RANDOM' })
    expect(errors.length).toBeGreaterThan(0)
    const reqError = errors.find((e) => e.property === 'samplingRequirement')
    expect(reqError).toBeDefined()
  })

  it('should accept payload without new fields (all optional)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, validBase)
    expect(errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateControlEvidenceMapDto — frequency, ownerRole, samplingRequirement
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlEvidenceMapDto — new fields validation', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/evidence.dto')
    return mod.UpdateControlEvidenceMapDto
  }

  it('should accept partial update with frequency only', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { frequency: 'MONTHLY' })
    expect(errors.filter((e) => e.property === 'frequency')).toHaveLength(0)
  })

  it('should accept partial update with ownerRole only', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { ownerRole: 'IT审计主管' })
    expect(errors.filter((e) => e.property === 'ownerRole')).toHaveLength(0)
  })

  it('should accept partial update with samplingRequirement only', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { samplingRequirement: 'KEY_SAMPLE' })
    expect(errors.filter((e) => e.property === 'samplingRequirement')).toHaveLength(0)
  })

  it('should reject invalid frequency enum value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { frequency: 'BIWEEKLY' })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should reject invalid samplingRequirement enum value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { samplingRequirement: 'NONE' })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should accept empty payload (all fields optional)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {})
    expect(errors).toHaveLength(0)
  })
})
