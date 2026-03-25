import { CreateKGRemediationActions1772000000010 } from '../1772000000010-CreateKGRemediationActions'

describe('CreateKGRemediationActions1772000000010', () => {
  let migration: CreateKGRemediationActions1772000000010

  beforeEach(() => {
    migration = new CreateKGRemediationActions1772000000010()
  })

  it('should create remediation_actions table with required indexes', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('remediation_actions')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "remediation_actions"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_remediation_actions_control'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_remediation_actions_priority'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_remediation_actions_status'),
    )
  })

  it('should drop indexes and table on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_remediation_actions_status"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_remediation_actions_priority"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_remediation_actions_control"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "remediation_actions"')
  })
})
