/**
 * ATDD Acceptance Tests — Story 3-3: regulation obligation seed runner
 */

import { loadKgSeedData } from './kg-seed-data'

describe('seedRegulationObligationsAndMaps', () => {
  it('should split CLAUSE-IT04-DQ-001 obligations with prohibitive reporting rule', () => {
    const seedData = loadKgSeedData()
    const dqObligations = seedData.regulationObligations.filter(
      (obligation) => obligation.clauseCode === 'CLAUSE-IT04-DQ-001',
    )

    expect(dqObligations.length).toBeGreaterThanOrEqual(2)
    expect(dqObligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          obligationType: 'PROHIBITIVE',
          obligationText: expect.stringContaining('不得直接报送'),
        }),
        expect.objectContaining({
          obligationType: 'MANDATORY',
        }),
      ]),
    )
  })

  it('should upsert regulation obligations and obligation-control maps idempotently', async () => {
    const mod = await import('./kg-seed.service')
    const seedData = loadKgSeedData()

    expect(typeof mod.seedRegulationObligationsAndMaps).toBe('function')

    const obligationRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'RegulationObligation') {
            return obligationRepository
          }
          throw new Error(`Unexpected repository request: ${entity.name}`)
        }),
      },
      query: jest
        .fn()
        .mockImplementation((sql: string) => {
          if (sql.includes('FROM regulation_clauses')) {
            return Promise.resolve(
              seedData.regulationClauses.map((clause, index) => ({
                clause_id: `clause-${index + 1}`,
                clause_code: clause.clauseCode,
              })),
            )
          }
          if (sql.includes('FROM regulation_obligations')) {
            return Promise.resolve(
              seedData.regulationObligations.map((obligation, index) => ({
                obligation_id: `obl-${index + 1}`,
                obligation_code: obligation.obligationCode,
              })),
            )
          }
          if (sql.includes('FROM control_points')) {
            return Promise.resolve(
              seedData.obligationControlMaps.map((mapping, index) => ({
                control_id: `control-${index + 1}`,
                control_code: mapping.controlCode,
              })),
            )
          }
          return Promise.resolve([])
        }),
    }

    const summary = await mod.seedRegulationObligationsAndMaps(
      queryRunner as never,
      seedData.regulationObligations,
      seedData.obligationControlMaps,
    )

    expect(obligationRepository.upsert).toHaveBeenCalled()
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO obligation_control_maps'),
      expect.any(Array),
    )
    expect(summary).toEqual(
      expect.objectContaining({
        regulationObligations: seedData.regulationObligations.length,
        obligationControlMaps: seedData.obligationControlMaps.length,
      }),
    )
  })

  it('should fail fast when a regulation clause cannot be resolved', async () => {
    const mod = await import('./kg-seed.service')
    const seedData = loadKgSeedData()
    const missingClauseCode = seedData.regulationObligations[0].clauseCode
    const missingObligationCode = seedData.regulationObligations[0].obligationCode

    const obligationRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'RegulationObligation') {
            return obligationRepository
          }
          throw new Error(`Unexpected repository request: ${entity.name}`)
        }),
      },
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM regulation_clauses')) {
          return Promise.resolve(
            seedData.regulationClauses
              .filter((clause) => clause.clauseCode !== missingClauseCode)
              .map((clause, index) => ({
                clause_id: `clause-${index + 1}`,
                clause_code: clause.clauseCode,
              })),
          )
        }
        return Promise.resolve([])
      }),
    }

    await expect(
      mod.seedRegulationObligationsAndMaps(
        queryRunner as never,
        seedData.regulationObligations,
        seedData.obligationControlMaps,
      ),
    ).rejects.toThrow(
      `Missing regulation clause ${missingClauseCode} for obligation ${missingObligationCode}`,
    )
  })

  it('should fail fast when regulation obligations are missing after upsert', async () => {
    const mod = await import('./kg-seed.service')
    const seedData = loadKgSeedData()
    const missingObligationCode = seedData.regulationObligations[0].obligationCode

    const obligationRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'RegulationObligation') {
            return obligationRepository
          }
          throw new Error(`Unexpected repository request: ${entity.name}`)
        }),
      },
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM regulation_clauses')) {
          return Promise.resolve(
            seedData.regulationClauses.map((clause, index) => ({
              clause_id: `clause-${index + 1}`,
              clause_code: clause.clauseCode,
            })),
          )
        }
        if (sql.includes('FROM regulation_obligations')) {
          return Promise.resolve(
            seedData.regulationObligations
              .filter((obligation) => obligation.obligationCode !== missingObligationCode)
              .map((obligation, index) => ({
                obligation_id: `obl-${index + 1}`,
                obligation_code: obligation.obligationCode,
              })),
          )
        }
        if (sql.includes('FROM control_points')) {
          return Promise.resolve(
            seedData.obligationControlMaps.map((mapping, index) => ({
              control_id: `control-${index + 1}`,
              control_code: mapping.controlCode,
            })),
          )
        }
        return Promise.resolve([])
      }),
    }

    await expect(
      mod.seedRegulationObligationsAndMaps(
        queryRunner as never,
        seedData.regulationObligations,
        seedData.obligationControlMaps,
      ),
    ).rejects.toThrow(`Missing regulation obligation ${missingObligationCode} after upsert`)
  })

  it('should fail fast when control points cannot be resolved for obligation-control maps', async () => {
    const mod = await import('./kg-seed.service')
    const seedData = loadKgSeedData()
    const missingControlCode = seedData.obligationControlMaps[0].controlCode

    const obligationRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'RegulationObligation') {
            return obligationRepository
          }
          throw new Error(`Unexpected repository request: ${entity.name}`)
        }),
      },
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM regulation_clauses')) {
          return Promise.resolve(
            seedData.regulationClauses.map((clause, index) => ({
              clause_id: `clause-${index + 1}`,
              clause_code: clause.clauseCode,
            })),
          )
        }
        if (sql.includes('FROM regulation_obligations')) {
          return Promise.resolve(
            seedData.regulationObligations.map((obligation, index) => ({
              obligation_id: `obl-${index + 1}`,
              obligation_code: obligation.obligationCode,
            })),
          )
        }
        if (sql.includes('FROM control_points')) {
          return Promise.resolve(
            seedData.obligationControlMaps
              .filter((mapping) => mapping.controlCode !== missingControlCode)
              .map((mapping, index) => ({
                control_id: `control-${index + 1}`,
                control_code: mapping.controlCode,
              })),
          )
        }
        return Promise.resolve([])
      }),
    }

    await expect(
      mod.seedRegulationObligationsAndMaps(
        queryRunner as never,
        seedData.regulationObligations,
        seedData.obligationControlMaps,
      ),
    ).rejects.toThrow(
      `Missing control point ${missingControlCode} for obligation-control map`,
    )
  })
})
