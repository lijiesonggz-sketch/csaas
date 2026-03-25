import { CreateKGControlPackItems1772000000007 } from '../1772000000007-CreateKGControlPackItems'

describe('CreateKGControlPackItems1772000000007', () => {
  let migration: CreateKGControlPackItems1772000000007

  beforeEach(() => {
    migration = new CreateKGControlPackItems1772000000007()
  })

  it('should create control_pack_items table with required indexes', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_pack_items')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "control_pack_items"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('idx_control_pack_items_pack'))
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('idx_control_pack_items_control'))
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('idx_control_pack_items_role'))
  })

  it('should drop indexes and table on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_pack_items_role"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_pack_items_control"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_pack_items_pack"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "control_pack_items"')
  })
})
