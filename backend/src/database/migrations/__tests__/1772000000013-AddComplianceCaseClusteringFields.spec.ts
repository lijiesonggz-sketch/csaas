import { AddComplianceCaseClusteringFields1772000000013 } from '../1772000000013-AddComplianceCaseClusteringFields'

describe('AddComplianceCaseClusteringFields1772000000013', () => {
  let migration: AddComplianceCaseClusteringFields1772000000013

  beforeEach(() => {
    migration = new AddComplianceCaseClusteringFields1772000000013()
  })

  it('should add clustering columns to compliance_cases', async () => {
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
      expect.stringContaining('ADD COLUMN "normalized_themes" jsonb'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "candidate_control_points" jsonb'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN "clustered_at" timestamp'),
    )
  })

  it('should drop clustering columns on down', async () => {
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
      expect.stringContaining('DROP COLUMN "clustered_at"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "candidate_control_points"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "normalized_themes"'),
    )
  })
})
