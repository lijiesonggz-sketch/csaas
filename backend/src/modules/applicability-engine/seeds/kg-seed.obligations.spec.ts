/**
 * ATDD Acceptance Tests — Story 3-3: regulation obligation seed runner
 */

import { loadKgSeedData } from './kg-seed-data'

describe('seedRegulationObligationsAndMaps', () => {
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
})
