import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateComplianceCaseClassificationRuns1772000000024
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasClassificationSource = await queryRunner.hasColumn(
      'compliance_cases',
      'classification_source',
    )

    if (!hasClassificationSource) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "classification_source" varchar(30)
      `)
    }

    const hasClassificationVersion = await queryRunner.hasColumn(
      'compliance_cases',
      'classification_version',
    )

    if (!hasClassificationVersion) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "classification_version" varchar(50)
      `)
    }

    const hasFallbackReason = await queryRunner.hasColumn(
      'compliance_cases',
      'fallback_reason',
    )

    if (!hasFallbackReason) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "fallback_reason" varchar(50)
      `)
    }

    const hasClassificationRuns = await queryRunner.hasTable(
      'compliance_case_classification_runs',
    )

    if (!hasClassificationRuns) {
      await queryRunner.query(`
        CREATE TABLE "compliance_case_classification_runs" (
          "classification_run_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "case_id" uuid NOT NULL REFERENCES "compliance_cases"("case_id") ON DELETE RESTRICT,
          "batch_id" varchar(100),
          "classifier_version" varchar(50) NOT NULL,
          "mapping_version" varchar(50) NOT NULL,
          "rulebook_version" varchar(50) NOT NULL,
          "input_hash" varchar(128) NOT NULL,
          "normalized_input_json" jsonb,
          "matched_signals_json" jsonb,
          "decision_trace_json" jsonb,
          "l1_code" varchar(20),
          "l2_code" varchar(20),
          "confidence_score" numeric(5,4),
          "decision_source" varchar(30) NOT NULL CHECK ("decision_source" IN ('rule', 'semantic', 'hybrid', 'none')),
          "path_decision" varchar(30) NOT NULL CHECK ("path_decision" IN ('PRIMARY_CHAIN', 'LEGACY_FALLBACK', 'ABSTAIN', 'UNCLASSIFIED')),
          "fallback_reason" varchar(50),
          "classification_status" varchar(30) NOT NULL CHECK ("classification_status" IN ('SUCCEEDED', 'ABSTAINED', 'FAILED', 'FALLBACK_APPLIED')),
          "is_latest" boolean NOT NULL DEFAULT FALSE,
          "created_at" timestamp NOT NULL DEFAULT NOW()
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_case_created"
      ON "compliance_case_classification_runs" ("case_id", "created_at")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_latest"
      ON "compliance_case_classification_runs" ("case_id", "is_latest")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_cccr_latest_true"
      ON "compliance_case_classification_runs" ("case_id")
      WHERE "is_latest" = TRUE
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_path"
      ON "compliance_case_classification_runs" ("path_decision")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_fallback_reason"
      ON "compliance_case_classification_runs" ("fallback_reason")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_versions"
      ON "compliance_case_classification_runs" ("classifier_version", "mapping_version", "rulebook_version")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cccr_batch"
      ON "compliance_case_classification_runs" ("batch_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasClassificationRuns = await queryRunner.hasTable(
      'compliance_case_classification_runs',
    )

    if (hasClassificationRuns) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_batch"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_versions"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_fallback_reason"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_path"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_latest_true"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_latest"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_cccr_case_created"`)
      await queryRunner.query(`DROP TABLE "compliance_case_classification_runs"`)
    }
  }
}
