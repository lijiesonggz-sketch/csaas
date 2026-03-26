import { AddComplianceCaseExtractionFields1772000000012 } from '../1772000000012-AddComplianceCaseExtractionFields'

describe('AddComplianceCaseExtractionFields1772000000012', () => {
  let migration: AddComplianceCaseExtractionFields1772000000012

  beforeEach(() => {
    migration = new AddComplianceCaseExtractionFields1772000000012()
  })

  it('should add extraction columns to compliance_cases', async () => {
    const queryRunner = {
      hasColumn: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "violation_themes" jsonb'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "clause_candidates" jsonb'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "extracted_at" timestamp'),
    )
  })

  it('should drop extraction columns on down', async () => {
    const queryRunner = {
      hasColumn: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "extracted_at"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "clause_candidates"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "violation_themes"'),
    )
  })
})
