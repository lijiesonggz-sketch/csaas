import { MigrationInterface, QueryRunner } from 'typeorm'

export class ExtendEvidenceTypesAutoCollectable1772000000021 implements MigrationInterface {
  name = 'ExtendEvidenceTypesAutoCollectable1772000000021'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add auto_collectable column
    const hasAutoCollectable = await queryRunner.hasColumn('evidence_types', 'auto_collectable')
    if (!hasAutoCollectable) {
      await queryRunner.query(`
        ALTER TABLE "evidence_types"
        ADD COLUMN "auto_collectable" BOOLEAN NOT NULL DEFAULT false
      `)
    }

    // Update evidence_category: replace old enum with new 8 values
    // Add CHECK constraint for new enum values: POLICY, PROCESS, SYSTEM, LOG, APPROVAL_RECORD, REPORT, CONFIG, SAMPLE_RECORD
    await queryRunner.query(`
      UPDATE "evidence_types"
      SET "evidence_category" = CASE
        WHEN "evidence_category" = 'document' THEN 'POLICY'
        WHEN "evidence_category" = 'log' THEN 'LOG'
        WHEN "evidence_category" = 'approval' THEN 'APPROVAL_RECORD'
        WHEN "evidence_category" = 'report' THEN 'REPORT'
        WHEN "evidence_category" = 'record' THEN 'SAMPLE_RECORD'
        ELSE "evidence_category"
      END
      WHERE "evidence_category" IN ('document', 'log', 'approval', 'report', 'record')
    `)

    // Add CHECK constraint for the new evidence_category enum
    await queryRunner.query(`
      ALTER TABLE "evidence_types"
      ADD CONSTRAINT "CHK_evidence_types_category"
      CHECK ("evidence_category" IN ('POLICY', 'PROCESS', 'SYSTEM', 'LOG', 'APPROVAL_RECORD', 'REPORT', 'CONFIG', 'SAMPLE_RECORD') OR "evidence_category" IS NULL)
    `)

    // Note: PostgreSQL doesn't enforce enum at DB level for VARCHAR columns
    // The enum validation is handled at application level via TypeORM entity
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop CHECK constraint first
    await queryRunner.query(`
      ALTER TABLE "evidence_types"
      DROP CONSTRAINT IF EXISTS "CHK_evidence_types_category"
    `)

    // Revert evidence_category values back to old enum
    await queryRunner.query(`
      UPDATE "evidence_types"
      SET "evidence_category" = CASE
        WHEN "evidence_category" = 'POLICY' THEN 'document'
        WHEN "evidence_category" = 'PROCESS' THEN 'document'
        WHEN "evidence_category" = 'SYSTEM' THEN 'document'
        WHEN "evidence_category" = 'LOG' THEN 'log'
        WHEN "evidence_category" = 'APPROVAL_RECORD' THEN 'approval'
        WHEN "evidence_category" = 'REPORT' THEN 'report'
        WHEN "evidence_category" = 'CONFIG' THEN 'document'
        WHEN "evidence_category" = 'SAMPLE_RECORD' THEN 'record'
        ELSE "evidence_category"
      END
      WHERE "evidence_category" IN ('POLICY', 'PROCESS', 'SYSTEM', 'LOG', 'APPROVAL_RECORD', 'REPORT', 'CONFIG', 'SAMPLE_RECORD')
    `)

    // Drop auto_collectable column
    const hasAutoCollectable = await queryRunner.hasColumn('evidence_types', 'auto_collectable')
    if (hasAutoCollectable) {
      await queryRunner.query(`
        ALTER TABLE "evidence_types"
        DROP COLUMN "auto_collectable"
      `)
    }
  }
}
