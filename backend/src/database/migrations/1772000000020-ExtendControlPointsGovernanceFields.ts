import { MigrationInterface, QueryRunner } from 'typeorm'

export class ExtendControlPointsGovernanceFields1772000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'control_points'

    // origin_type
    const hasOriginType = await queryRunner.hasColumn(table, 'origin_type')
    if (!hasOriginType) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "origin_type" VARCHAR(30) NOT NULL DEFAULT 'candidate'
      `)
    }

    // maturity_level
    const hasMaturityLevel = await queryRunner.hasColumn(table, 'maturity_level')
    if (!hasMaturityLevel) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "maturity_level" VARCHAR(20) NOT NULL DEFAULT 'candidate'
      `)
    }

    // objective_summary
    const hasObjectiveSummary = await queryRunner.hasColumn(table, 'objective_summary')
    if (!hasObjectiveSummary) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "objective_summary" TEXT
      `)
    }

    // source_basis
    const hasSourceBasis = await queryRunner.hasColumn(table, 'source_basis')
    if (!hasSourceBasis) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "source_basis" JSONB
      `)
    }

    // authority_profile_json
    const hasAuthorityProfileJson = await queryRunner.hasColumn(table, 'authority_profile_json')
    if (!hasAuthorityProfileJson) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "authority_profile_json" JSONB
      `)
    }

    // authoritative_score
    const hasAuthoritativeScore = await queryRunner.hasColumn(table, 'authoritative_score')
    if (!hasAuthoritativeScore) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "authoritative_score" NUMERIC(5,4)
      `)
    }

    // superseded_by (UUID FK → control_points.control_id)
    const hasSupersededBy = await queryRunner.hasColumn(table, 'superseded_by')
    if (!hasSupersededBy) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "superseded_by" UUID,
        ADD CONSTRAINT "FK_control_points_superseded_by"
          FOREIGN KEY ("superseded_by") REFERENCES "control_points"("control_id") ON DELETE SET NULL
      `)
    }

    // retired_reason
    const hasRetiredReason = await queryRunner.hasColumn(table, 'retired_reason')
    if (!hasRetiredReason) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "retired_reason" TEXT
      `)
    }

    // applicable_sector
    const hasApplicableSector = await queryRunner.hasColumn(table, 'applicable_sector')
    if (!hasApplicableSector) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "applicable_sector" VARCHAR(50)[] DEFAULT '{}'
      `)
    }

    // sector_requirements
    const hasSectorRequirements = await queryRunner.hasColumn(table, 'sector_requirements')
    if (!hasSectorRequirements) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "sector_requirements" JSONB
      `)
    }

    // GIN index on applicable_sector
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_control_points_sector"
      ON "control_points" USING GIN ("applicable_sector")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop GIN index first
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_control_points_sector"`)

    // 2. Drop FK constraint on superseded_by before dropping the column
    await queryRunner.query(`
      ALTER TABLE "control_points" DROP CONSTRAINT IF EXISTS "FK_control_points_superseded_by"
    `)

    // 3. Drop all 10 columns in reverse order
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "sector_requirements"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "applicable_sector"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "retired_reason"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "superseded_by"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "authoritative_score"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "authority_profile_json"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "source_basis"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "objective_summary"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "maturity_level"`)
    await queryRunner.query(`ALTER TABLE "control_points" DROP COLUMN IF EXISTS "origin_type"`)
  }
}
