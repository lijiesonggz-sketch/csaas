import { CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008 } from '../1772000000008-CreateKGEvidenceTypesAndControlEvidenceMaps'

describe('CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008', () => {
  let migration: CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008

  beforeEach(() => {
    migration = new CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008()
  })

  it('should create evidence tables with required indexes', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    expect(queryRunner.hasTable).toHaveBeenCalledWith('evidence_types')
    expect(queryRunner.hasTable).toHaveBeenCalledWith('control_evidence_maps')
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "evidence_types"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "control_evidence_maps"'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_evidence_maps_control'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_evidence_maps_evidence'),
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('idx_control_evidence_maps_required_level'),
    )
  })

  it('should drop indexes and tables on down', async () => {
    const queryRunner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_control_evidence_maps_required_level"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_control_evidence_maps_evidence"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX IF EXISTS "idx_control_evidence_maps_control"',
    )
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "control_evidence_maps"')
    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE "evidence_types"')
  })
})
