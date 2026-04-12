import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGFailureModeCoreTables1772000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFailureModes = await queryRunner.hasTable('failure_modes')

    if (!hasFailureModes) {
      await queryRunner.query(`
        CREATE TABLE "failure_modes" (
          "failure_mode_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "failure_mode_code" varchar(100) NOT NULL,
          "name" varchar(300) NOT NULL,
          "description" text,
          "category" varchar(50) NOT NULL CHECK ("category" IN (
            'DEFINITION_ERROR',
            'MAPPING_ERROR',
            'MISSING_CONTROL',
            'TIMELINESS_FAILURE',
            'INTEGRITY_FAILURE',
            'UNAUTHORIZED_ACTION',
            'FALSIFICATION'
          )),
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_failure_modes_failure_mode_code" UNIQUE ("failure_mode_code")
        )
      `)
    }

    const hasTaxonomyFailureModeMaps = await queryRunner.hasTable('taxonomy_failure_mode_maps')

    if (!hasTaxonomyFailureModeMaps) {
      await queryRunner.query(`
        CREATE TABLE "taxonomy_failure_mode_maps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "l2_code" varchar(20) NOT NULL REFERENCES "taxonomy_l2"("l2_code"),
          "failure_mode_id" uuid NOT NULL REFERENCES "failure_modes"("failure_mode_id"),
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_tfm_l2_code_failure_mode_id" UNIQUE ("l2_code", "failure_mode_id")
        )
      `)
    }

    const hasFailureModeControlMaps = await queryRunner.hasTable('failure_mode_control_maps')

    if (!hasFailureModeControlMaps) {
      await queryRunner.query(`
        CREATE TABLE "failure_mode_control_maps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "failure_mode_id" uuid NOT NULL REFERENCES "failure_modes"("failure_mode_id"),
          "control_id" uuid NOT NULL REFERENCES "control_points"("control_id"),
          "relevance" varchar(20) NOT NULL CHECK ("relevance" IN ('PRIMARY', 'SECONDARY')),
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_fmcm_failure_mode_id_control_id" UNIQUE ("failure_mode_id", "control_id")
        )
      `)
    }

    // indexes for failure_modes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_failure_modes_category"
      ON "failure_modes" ("category")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_failure_modes_status"
      ON "failure_modes" ("status")
    `)

    // indexes for taxonomy_failure_mode_maps
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tfm_l2_code"
      ON "taxonomy_failure_mode_maps" ("l2_code")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tfm_failure_mode_id"
      ON "taxonomy_failure_mode_maps" ("failure_mode_id")
    `)

    // indexes for failure_mode_control_maps
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fmcm_failure_mode_id"
      ON "failure_mode_control_maps" ("failure_mode_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fmcm_control_id"
      ON "failure_mode_control_maps" ("control_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasFailureModeControlMaps = await queryRunner.hasTable('failure_mode_control_maps')

    if (hasFailureModeControlMaps) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_fmcm_control_id"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_fmcm_failure_mode_id"`)
      await queryRunner.query(`DROP TABLE "failure_mode_control_maps"`)
    }

    const hasTaxonomyFailureModeMaps = await queryRunner.hasTable('taxonomy_failure_mode_maps')

    if (hasTaxonomyFailureModeMaps) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_failure_mode_id"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_tfm_l2_code"`)
      await queryRunner.query(`DROP TABLE "taxonomy_failure_mode_maps"`)
    }

    const hasFailureModes = await queryRunner.hasTable('failure_modes')

    if (hasFailureModes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_failure_modes_status"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_failure_modes_category"`)
      await queryRunner.query(`DROP TABLE "failure_modes"`)
    }
  }
}
