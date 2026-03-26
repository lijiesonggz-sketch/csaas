import { AddComplianceCaseHumanReviewFields1772000000014 } from '../1772000000014-AddComplianceCaseHumanReviewFields'

describe('AddComplianceCaseHumanReviewFields1772000000014', () => {
  let migration: AddComplianceCaseHumanReviewFields1772000000014

  beforeEach(() => {
    migration = new AddComplianceCaseHumanReviewFields1772000000014()
  })

  it('should add human review columns to compliance_cases', async () => {
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
      expect.stringContaining('ADD COLUMN "human_reviewed" boolean NOT NULL DEFAULT false'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "reviewed_by" varchar(100)'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "reviewed_at" timestamp'),
    )
  })

  it('should drop human review columns on down', async () => {
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
      expect.stringContaining('DROP COLUMN "reviewed_at"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "reviewed_by"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "human_reviewed"'),
    )
  })
})
