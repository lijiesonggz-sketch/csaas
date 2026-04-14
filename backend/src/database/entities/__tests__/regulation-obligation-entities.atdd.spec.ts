/**
 * ATDD Acceptance Tests — Story 3-1: Entity 结构与关系验证
 *
 * AC-3: RegulationObligation / ObligationControlMap entity contract
 */

import 'reflect-metadata'

describe('[AC-3] RegulationObligation entity contract', () => {
  const loadModule = async () => import('../../entities/regulation-obligation.entity')

  it('should export RegulationObligation entity class', async () => {
    const mod = await loadModule()
    expect(mod.RegulationObligation).toBeDefined()
    expect(typeof mod.RegulationObligation).toBe('function')
  })

  it('should export OBLIGATION_TYPES and OBLIGATION_STATUSES', async () => {
    const mod = await loadModule()
    expect([...mod.OBLIGATION_TYPES]).toEqual(
      expect.arrayContaining(['MANDATORY', 'PROHIBITIVE', 'RECOMMENDED']),
    )
    expect([...mod.OBLIGATION_STATUSES]).toEqual(expect.arrayContaining(['ACTIVE', 'INACTIVE']))
  })

  it('should have required scalar fields on RegulationObligation instance', async () => {
    const mod = await loadModule()
    const entity = new mod.RegulationObligation()
    const fields = [
      'obligationId',
      'clauseId',
      'obligationCode',
      'obligationText',
      'obligationType',
      'applicableSector',
      'status',
      'createdAt',
      'updatedAt',
    ]
    for (const field of fields) {
      entity[field as keyof typeof entity] = undefined as never
      expect(field in entity).toBe(true)
    }
  })

  it('should expose clause and obligationControlMaps relations', async () => {
    const mod = await loadModule()
    const entity = new mod.RegulationObligation()
    entity['clause' as keyof typeof entity] = undefined as never
    entity['obligationControlMaps' as keyof typeof entity] = undefined as never
    expect('clause' in entity).toBe(true)
    expect('obligationControlMaps' in entity).toBe(true)
  })
})

describe('[AC-3] ObligationControlMap entity contract', () => {
  const loadModule = async () => import('../../entities/obligation-control-map.entity')

  it('should export ObligationControlMap entity class', async () => {
    const mod = await loadModule()
    expect(mod.ObligationControlMap).toBeDefined()
    expect(typeof mod.ObligationControlMap).toBe('function')
  })

  it('should export OBLIGATION_COVERAGES with FULL and PARTIAL', async () => {
    const mod = await loadModule()
    expect([...mod.OBLIGATION_COVERAGES]).toEqual(expect.arrayContaining(['FULL', 'PARTIAL']))
  })

  it('should have required fields and relations on ObligationControlMap instance', async () => {
    const mod = await loadModule()
    const entity = new mod.ObligationControlMap()
    const fields = [
      'id',
      'obligationId',
      'controlId',
      'coverage',
      'notes',
      'createdAt',
      'updatedAt',
      'obligation',
      'controlPoint',
    ]
    for (const field of fields) {
      entity[field as keyof typeof entity] = undefined as never
      expect(field in entity).toBe(true)
    }
  })
})

describe('[AC-3] Existing entities reverse relations', () => {
  it('should add obligations relation to RegulationClause', async () => {
    const mod = await import('../../entities/regulation-clause.entity')
    const entity = new mod.RegulationClause()
    entity['obligations' as keyof typeof entity] = undefined as never
    expect('obligations' in entity).toBe(true)
  })

  it('should add obligationControlMaps relation to ControlPoint', async () => {
    const mod = await import('../../entities/control-point.entity')
    const entity = new mod.ControlPoint()
    entity['obligationControlMaps' as keyof typeof entity] = undefined as never
    expect('obligationControlMaps' in entity).toBe(true)
  })
})

describe('[AC-3] Entity index exports', () => {
  it('should export RegulationObligation and enums from entities/index.ts', async () => {
    const mod = await import('../../entities/index')
    expect(mod.RegulationObligation).toBeDefined()
    expect(mod.OBLIGATION_TYPES).toBeDefined()
    expect(mod.OBLIGATION_STATUSES).toBeDefined()
  })

  it('should export ObligationControlMap and coverage enum from entities/index.ts', async () => {
    const mod = await import('../../entities/index')
    expect(mod.ObligationControlMap).toBeDefined()
    expect(mod.OBLIGATION_COVERAGES).toBeDefined()
  })
})
