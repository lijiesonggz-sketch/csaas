import { CreateKGTaxonomyAndControlPointCatalog1772000000005 } from '../1772000000005-CreateKGTaxonomyAndControlPointCatalog'

describe('CreateKGTaxonomyAndControlPointCatalog1772000000005', () => {
  let migration: CreateKGTaxonomyAndControlPointCatalog1772000000005

  beforeEach(() => {
    migration = new CreateKGTaxonomyAndControlPointCatalog1772000000005()
  })

  it('should create taxonomy_l1, taxonomy_l2 and control_points with required indexes', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('taxonomy_l1')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('taxonomy_l2')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_points')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "taxonomy_l1"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "taxonomy_l2"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "control_points"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_points_l1'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_points_l2'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_points_family'),
    )
  })

  it('should drop control-point indexes and tables in reverse order on down', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_points_family"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_points_l2"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP INDEX IF EXISTS "idx_control_points_l1"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "control_points"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "taxonomy_l2"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "taxonomy_l1"')
  })
})
