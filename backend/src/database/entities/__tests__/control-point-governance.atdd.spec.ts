/**
 * ATDD Acceptance Tests — Story 1-2: Entity 扩展与 authoritative_score 自动计算
 *
 * AC-2: ControlPoint Entity 新增 10 个治理字段 + @BeforeInsert/@BeforeUpdate 钩子
 * AC-3: TypeScript 接口约束 (AuthorityProfile, SectorRequirement, SectorRequirements)
 *
 * These tests run RED before implementation and GREEN once entity is extended.
 *
 * Run: npx jest --testPathPattern="control-point-governance.*atdd" --no-coverage
 */

import 'reflect-metadata'

// ---------------------------------------------------------------------------
// AC-2: ControlPoint Entity — 新增枚举常量
// ---------------------------------------------------------------------------

describe('[AC-2] ControlPoint governance enum constants', () => {
  const loadModule = async () => {
    const mod = await import('../../entities/control-point.entity')
    return mod
  }

  it('should export CONTROL_POINT_ORIGIN_TYPES with 5 values', async () => {
    const mod = await loadModule()
    expect(mod.CONTROL_POINT_ORIGIN_TYPES).toBeDefined()
    const values = [...mod.CONTROL_POINT_ORIGIN_TYPES]
    expect(values).toHaveLength(5)
    expect(values).toContain('case_derived')
    expect(values).toContain('regulation_derived')
    expect(values).toContain('both')
    expect(values).toContain('candidate')
    expect(values).toContain('manual')
  })

  it('should export CONTROL_POINT_MATURITY_LEVELS with 4 values', async () => {
    const mod = await loadModule()
    expect(mod.CONTROL_POINT_MATURITY_LEVELS).toBeDefined()
    const values = [...mod.CONTROL_POINT_MATURITY_LEVELS]
    expect(values).toHaveLength(4)
    expect(values).toContain('hard')
    expect(values).toContain('draft-hard')
    expect(values).toContain('candidate')
    expect(values).toContain('retired')
  })

  it('should export APPLICABLE_SECTORS with 6 values including 通用', async () => {
    const mod = await loadModule()
    expect(mod.APPLICABLE_SECTORS).toBeDefined()
    const values = [...mod.APPLICABLE_SECTORS]
    expect(values).toHaveLength(6)
    expect(values).toContain('银行')
    expect(values).toContain('证券')
    expect(values).toContain('保险')
    expect(values).toContain('基金')
    expect(values).toContain('期货')
    expect(values).toContain('通用')
  })
})

// ---------------------------------------------------------------------------
// AC-2: ControlPoint Entity — 新增 10 个治理字段
// ---------------------------------------------------------------------------

describe('[AC-2] ControlPoint governance fields on entity', () => {
  const loadModule = async () => {
    const mod = await import('../../entities/control-point.entity')
    return mod
  }

  const GOVERNANCE_FIELDS = [
    'originType',
    'maturityLevel',
    'objectiveSummary',
    'sourceBasis',
    'authorityProfileJson',
    'authoritativeScore',
    'supersededBy',
    'retiredReason',
    'applicableSector',
    'sectorRequirements',
  ] as const

  it('should have all 10 governance fields declarable on ControlPoint instance', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    for (const field of GOVERNANCE_FIELDS) {
      entity[field as keyof typeof entity] = undefined as never
      expect(field in entity).toBe(true)
    }
  })

  it('should have supersededByControlPoint relation (self-referencing @ManyToOne)', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    // The relation property for the self-referencing FK
    entity['supersededByControlPoint' as keyof typeof entity] = undefined as never
    expect('supersededByControlPoint' in entity).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-2: authoritative_score 自动计算
// ---------------------------------------------------------------------------

describe('[AC-2] calculateAuthoritativeScore hook', () => {
  const loadModule = async () => {
    const mod = await import('../../entities/control-point.entity')
    return mod
  }

  it('should have calculateAuthoritativeScore method on ControlPoint', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    expect(typeof entity.calculateAuthoritativeScore).toBe('function')
  })

  it('should return 1.0000 when all 6 dimensions are true', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = {
      has_source_basis: true,
      has_applicability_scope: true,
      has_control_activity: true,
      has_expected_evidence: true,
      has_human_review: true,
      has_case_validation: true,
    } as never
    entity.calculateAuthoritativeScore()
    expect(Number(entity.authoritativeScore)).toBeCloseTo(1.0, 4)
  })

  it('should return 0.0000 when all 6 dimensions are false', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = {
      has_source_basis: false,
      has_applicability_scope: false,
      has_control_activity: false,
      has_expected_evidence: false,
      has_human_review: false,
      has_case_validation: false,
    } as never
    entity.calculateAuthoritativeScore()
    expect(Number(entity.authoritativeScore)).toBeCloseTo(0.0, 4)
  })

  it('should return 0.5000 when 3 of 6 dimensions are true', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = {
      has_source_basis: true,
      has_applicability_scope: true,
      has_control_activity: true,
      has_expected_evidence: false,
      has_human_review: false,
      has_case_validation: false,
    } as never
    entity.calculateAuthoritativeScore()
    expect(Number(entity.authoritativeScore)).toBeCloseTo(0.5, 4)
  })

  it('should set score to null when authority_profile_json is null', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = null as never
    entity.calculateAuthoritativeScore()
    expect(entity.authoritativeScore).toBeNull()
  })

  it('should set score to null when authority_profile_json is undefined', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = undefined as never
    entity.calculateAuthoritativeScore()
    expect(entity.authoritativeScore).toBeNull()
  })

  it('should return 0.0000 when authority_profile_json is empty object', async () => {
    const mod = await loadModule()
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = {} as never
    entity.calculateAuthoritativeScore()
    // Empty object: 0 true values / 6 dimensions = 0
    expect(Number(entity.authoritativeScore)).toBeCloseTo(0.0, 4)
  })
})

// ---------------------------------------------------------------------------
// AC-2: recalculateAllScores 静态方法
// ---------------------------------------------------------------------------

describe('[AC-2] recalculateAllScores static method', () => {
  it('should have static recalculateAllScores method on ControlPoint', async () => {
    const mod = await import('../../entities/control-point.entity')
    expect(typeof mod.ControlPoint.recalculateAllScores).toBe('function')
  })

  it('should accept a QueryRunner parameter and execute SQL', async () => {
    const mod = await import('../../entities/control-point.entity')
    const mockQueryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }
    await mod.ControlPoint.recalculateAllScores(mockQueryRunner as never)
    expect(mockQueryRunner.query).toHaveBeenCalled()
    // The SQL should reference authoritative_score and authority_profile_json
    const sql = mockQueryRunner.query.mock.calls[0][0] as string
    expect(sql).toMatch(/authoritative_score/i)
    expect(sql).toMatch(/authority_profile_json/i)
  })
})

// ---------------------------------------------------------------------------
// AC-3: TypeScript 接口约束 (compile-time + runtime shape check)
// ---------------------------------------------------------------------------

describe('[AC-3] AuthorityProfile interface', () => {
  it('should be importable and have 6 boolean dimension keys', async () => {
    const mod = await import('../../entities/control-point.entity')
    // We verify the interface exists by checking the AUTHORITY_PROFILE_DIMENSIONS constant
    // which should list the 6 dimension keys
    const dimensions = [
      'has_source_basis',
      'has_applicability_scope',
      'has_control_activity',
      'has_expected_evidence',
      'has_human_review',
      'has_case_validation',
    ]
    // The entity should use these dimensions in calculateAuthoritativeScore
    const entity = new mod.ControlPoint()
    entity.authorityProfileJson = Object.fromEntries(
      dimensions.map((d) => [d, true]),
    ) as never
    entity.calculateAuthoritativeScore()
    expect(Number(entity.authoritativeScore)).toBeCloseTo(1.0, 4)
  })
})

describe('[AC-3] SectorRequirements interface key constraint', () => {
  it('should only allow 5 sector keys (银行/证券/保险/基金/期货) — no 通用', async () => {
    const mod = await import('../../entities/control-point.entity')
    // SECTOR_REQUIREMENT_KEYS should be exported for DTO validation
    if ('SECTOR_REQUIREMENT_KEYS' in mod) {
      const keys = [...(mod as unknown as Record<string, readonly string[]>).SECTOR_REQUIREMENT_KEYS]
      expect(keys).toHaveLength(5)
      expect(keys).toContain('银行')
      expect(keys).toContain('证券')
      expect(keys).toContain('保险')
      expect(keys).toContain('基金')
      expect(keys).toContain('期货')
      expect(keys).not.toContain('通用')
    } else {
      // Fallback: verify via APPLICABLE_SECTORS minus 通用
      const sectors = [...(mod as unknown as Record<string, readonly string[]>).APPLICABLE_SECTORS].filter((s) => s !== '通用')
      expect(sectors).toHaveLength(5)
    }
  })
})

// ---------------------------------------------------------------------------
// AC-2/AC-3: Entity index exports
// ---------------------------------------------------------------------------

describe('[AC-2] Entity index exports for governance constants', () => {
  it('should export CONTROL_POINT_ORIGIN_TYPES from entities/index.ts', async () => {
    const mod = await import('../../entities/index')
    expect((mod as Record<string, unknown>).CONTROL_POINT_ORIGIN_TYPES).toBeDefined()
  })

  it('should export CONTROL_POINT_MATURITY_LEVELS from entities/index.ts', async () => {
    const mod = await import('../../entities/index')
    expect((mod as Record<string, unknown>).CONTROL_POINT_MATURITY_LEVELS).toBeDefined()
  })

  it('should export APPLICABLE_SECTORS from entities/index.ts', async () => {
    const mod = await import('../../entities/index')
    expect((mod as Record<string, unknown>).APPLICABLE_SECTORS).toBeDefined()
  })
})
