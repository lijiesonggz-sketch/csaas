import { CreateKGRegulationAndCaseMappingTables1772000000006 } from '../1772000000006-CreateKGRegulationAndCaseMappingTables'

describe('CreateKGRegulationAndCaseMappingTables1772000000006', () => {
  let migration: CreateKGRegulationAndCaseMappingTables1772000000006

  beforeEach(() => {
    migration = new CreateKGRegulationAndCaseMappingTables1772000000006()
  })

  it('should create regulation, case and mapping tables with required indexes', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('regulation_sources')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('regulation_clauses')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('clause_control_maps')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('compliance_cases')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('case_control_maps')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "regulation_sources"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "regulation_clauses"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "clause_control_maps"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "compliance_cases"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "case_control_maps"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_regulation_clauses_source'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_clause_control_maps_control'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_compliance_cases_industry'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_compliance_cases_date'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_case_control_maps_control'),
    )
  })

  it('should drop indexes and tables in reverse order on down', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_case_control_maps_control"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "case_control_maps"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_compliance_cases_date"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_compliance_cases_industry"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "compliance_cases"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_clause_control_maps_control"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "clause_control_maps"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_regulation_clauses_source"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "regulation_clauses"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "regulation_sources"')
  })
})
