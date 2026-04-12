/**
 * ATDD Acceptance Tests — Story 1-2: DTO class-validator 校验
 *
 * AC-4: UpdateControlPointGovernanceDto 使用 class-validator 校验枚举/行业 key
 *
 * Run: npx jest --testPathPattern="control-point-governance.*dto.*atdd" --no-coverage
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
// AC-4: UpdateControlPointGovernanceDto — origin_type 校验
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — origin_type', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept valid origin_type: case_derived', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'case_derived' })
    const originErrors = errors.filter((e) => e.property === 'originType')
    expect(originErrors).toHaveLength(0)
  })

  it('should accept valid origin_type: regulation_derived', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'regulation_derived' })
    const originErrors = errors.filter((e) => e.property === 'originType')
    expect(originErrors).toHaveLength(0)
  })

  it('should accept valid origin_type: both', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'both' })
    const originErrors = errors.filter((e) => e.property === 'originType')
    expect(originErrors).toHaveLength(0)
  })

  it('should accept valid origin_type: candidate', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'candidate' })
    const originErrors = errors.filter((e) => e.property === 'originType')
    expect(originErrors).toHaveLength(0)
  })

  it('should accept valid origin_type: manual', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'manual' })
    const originErrors = errors.filter((e) => e.property === 'originType')
    expect(originErrors).toHaveLength(0)
  })

  it('should reject invalid origin_type', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { originType: 'INVALID' })
    expect(errors.length).toBeGreaterThan(0)
    const originError = errors.find((e) => e.property === 'originType')
    expect(originError).toBeDefined()
    expect(
      Object.keys(originError!.constraints!).some(
        (k) => k.toLowerCase().includes('isin') || k.toLowerCase().includes('enum'),
      ),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateControlPointGovernanceDto — maturity_level 校验
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — maturity_level', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept valid maturity_level: hard', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { maturityLevel: 'hard' })
    const mlErrors = errors.filter((e) => e.property === 'maturityLevel')
    expect(mlErrors).toHaveLength(0)
  })

  it('should accept valid maturity_level: draft-hard', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { maturityLevel: 'draft-hard' })
    const mlErrors = errors.filter((e) => e.property === 'maturityLevel')
    expect(mlErrors).toHaveLength(0)
  })

  it('should accept valid maturity_level: candidate', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { maturityLevel: 'candidate' })
    const mlErrors = errors.filter((e) => e.property === 'maturityLevel')
    expect(mlErrors).toHaveLength(0)
  })

  it('should accept valid maturity_level: retired', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { maturityLevel: 'retired' })
    const mlErrors = errors.filter((e) => e.property === 'maturityLevel')
    expect(mlErrors).toHaveLength(0)
  })

  it('should reject invalid maturity_level', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, { maturityLevel: 'BOGUS' })
    expect(errors.length).toBeGreaterThan(0)
    const mlError = errors.find((e) => e.property === 'maturityLevel')
    expect(mlError).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateControlPointGovernanceDto — sector_requirements key 校验
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — sector_requirements', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept valid sector_requirements with legal keys', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      sectorRequirements: {
        '银行': { log_retention: '5年' },
        '证券': { review_frequency: '每季度' },
      },
    })
    const srErrors = errors.filter((e) => e.property === 'sectorRequirements')
    expect(srErrors).toHaveLength(0)
  })

  it('should accept all 5 valid sector keys', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      sectorRequirements: {
        '银行': { log_retention: '5年' },
        '证券': { review_frequency: '每季度' },
        '保险': { approval_level: '总经理' },
        '基金': { log_retention: '3年' },
        '期货': { review_frequency: '每月' },
      },
    })
    const srErrors = errors.filter((e) => e.property === 'sectorRequirements')
    expect(srErrors).toHaveLength(0)
  })

  it('should reject sector_requirements with illegal key', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      sectorRequirements: {
        '通用': { log_retention: '3年' }, // 通用 is NOT a valid sector_requirements key
      },
    })
    expect(errors.length).toBeGreaterThan(0)
    const srError = errors.find((e) => e.property === 'sectorRequirements')
    expect(srError).toBeDefined()
  })

  it('should reject sector_requirements with random non-sector key', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      sectorRequirements: {
        'INVALID_SECTOR': { log_retention: '3年' },
      },
    })
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateControlPointGovernanceDto — applicable_sector 校验
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — applicable_sector', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept valid applicable_sector array', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      applicableSector: ['银行', '证券', '通用'],
    })
    const asErrors = errors.filter((e) => e.property === 'applicableSector')
    expect(asErrors).toHaveLength(0)
  })

  it('should accept empty applicable_sector array', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      applicableSector: [],
    })
    const asErrors = errors.filter((e) => e.property === 'applicableSector')
    expect(asErrors).toHaveLength(0)
  })

  it('should reject applicable_sector with invalid sector value', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      applicableSector: ['银行', 'INVALID_VALUE'],
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should accept 通用 as valid applicable_sector element', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      applicableSector: ['通用'],
    })
    const asErrors = errors.filter((e) => e.property === 'applicableSector')
    expect(asErrors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AC-4: UpdateControlPointGovernanceDto — all fields optional
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — optional fields', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept empty payload (all fields optional for update)', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {})
    expect(errors).toHaveLength(0)
  })

  it('should accept partial update with only objectiveSummary', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      objectiveSummary: '确保数据分类准确性，防止敏感数据泄露',
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept partial update with only authorityProfileJson', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      authorityProfileJson: {
        has_source_basis: true,
        has_applicability_scope: false,
        has_control_activity: true,
        has_expected_evidence: false,
        has_human_review: true,
        has_case_validation: false,
      },
    })
    expect(errors).toHaveLength(0)
  })

  it('should accept supersededBy as valid UUID', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      supersededBy: '123e4567-e89b-12d3-a456-426614174000',
    })
    const sbErrors = errors.filter((e) => e.property === 'supersededBy')
    expect(sbErrors).toHaveLength(0)
  })

  it('should reject supersededBy with invalid UUID format', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      supersededBy: 'not-a-uuid',
    })
    expect(errors.length).toBeGreaterThan(0)
    const sbError = errors.find((e) => e.property === 'supersededBy')
    expect(sbError).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AC-4: canonical_theme 格式校验 (DTO 层仅格式，service 层校验与 l2_name 一致性)
// ---------------------------------------------------------------------------

describe('[AC-4] UpdateControlPointGovernanceDto — canonicalTheme', () => {
  const loadDto = async () => {
    const mod = await import('../../../../modules/knowledge-graph/dto/control-point-governance.dto')
    return mod.UpdateControlPointGovernanceDto
  }

  it('should accept valid canonicalTheme string', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      canonicalTheme: '数据安全管理',
    })
    const ctErrors = errors.filter((e) => e.property === 'canonicalTheme')
    expect(ctErrors).toHaveLength(0)
  })

  it('should accept null canonicalTheme', async () => {
    const Dto = await loadDto()
    const errors = await validateDto(Dto, {
      canonicalTheme: null,
    })
    // Should accept null (field is nullable)
    const ctErrors = errors.filter((e) => e.property === 'canonicalTheme')
    expect(ctErrors).toHaveLength(0)
  })
})
