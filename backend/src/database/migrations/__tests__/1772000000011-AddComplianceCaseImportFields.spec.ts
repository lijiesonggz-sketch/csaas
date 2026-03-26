import { AddComplianceCaseImportFields1772000000011 } from '../1772000000011-AddComplianceCaseImportFields'

describe('AddComplianceCaseImportFields1772000000011', () => {
  let migration: AddComplianceCaseImportFields1772000000011

  beforeEach(() => {
    migration = new AddComplianceCaseImportFields1772000000011()
  })

  it('should add regulator and penalty reason columns plus index', async () => {
    const queryRunner = {
      hasColumn: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasColumn).toHaveBeenCalledWith('compliance_cases', 'regulator_code')
    expect(queryRunner.hasColumn).toHaveBeenCalledWith('compliance_cases', 'penalty_reason')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "regulator_code" varchar(20)'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "penalty_reason" text'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_compliance_cases_regulator_code'),
    )
  })

  it('should drop the index and columns on down', async () => {
    const queryRunner = {
      hasColumn: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_compliance_cases_regulator_code"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "penalty_reason"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "regulator_code"'),
    )
  })
})
