import { CreateKGApplicabilityBaselineTables1772000000004 } from '../1772000000004-CreateKGApplicabilityBaselineTables'

describe('CreateKGApplicabilityBaselineTables1772000000004', () => {
  let migration: CreateKGApplicabilityBaselineTables1772000000004

  beforeEach(() => {
    migration = new CreateKGApplicabilityBaselineTables1772000000004()
  })

  it('should create control_packs and applicability_rules when missing', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_packs')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('applicability_rules')
    expect(queryRunner.query.mock.calls[0][0]).toContain('CREATE TABLE "control_packs"')
    expect(queryRunner.query.mock.calls[1][0]).toContain('CREATE TABLE "applicability_rules"')
    expect(queryRunner.query.mock.calls[2][0]).toContain('idx_applicability_rules_target')
    expect(queryRunner.query.mock.calls[3][0]).toContain('idx_applicability_rules_status')
  })

  it('should skip table creation when tables already exist', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.query).not.toHaveBeenCalled()
  })

  it('should drop indexes and tables on down when they exist', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_applicability_rules_status"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_applicability_rules_target"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "applicability_rules"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "control_packs"')
  })
})
