import { MigrationInterface, QueryRunner } from 'typeorm'

export class ExtendControlEvidenceMapsFrequencyOwner1772000000022 implements MigrationInterface {
  name = 'ExtendControlEvidenceMapsFrequencyOwner1772000000022'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add frequency column
    // Enum values: DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, EVENT_TRIGGERED
    const hasFrequency = await queryRunner.hasColumn('control_evidence_maps', 'frequency')
    if (!hasFrequency) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        ADD COLUMN "frequency" VARCHAR(30)
      `)
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        ADD CONSTRAINT "CHK_cem_frequency"
        CHECK ("frequency" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'EVENT_TRIGGERED') OR "frequency" IS NULL)
      `)
    }

    // Add owner_role column
    const hasOwnerRole = await queryRunner.hasColumn('control_evidence_maps', 'owner_role')
    if (!hasOwnerRole) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        ADD COLUMN "owner_role" VARCHAR(100)
      `)
    }

    // Add sampling_requirement column
    // Enum values: FULL, SAMPLING, KEY_SAMPLE
    const hasSamplingRequirement = await queryRunner.hasColumn('control_evidence_maps', 'sampling_requirement')
    if (!hasSamplingRequirement) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        ADD COLUMN "sampling_requirement" VARCHAR(50)
      `)
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        ADD CONSTRAINT "CHK_cem_sampling_requirement"
        CHECK ("sampling_requirement" IN ('FULL', 'SAMPLING', 'KEY_SAMPLE') OR "sampling_requirement" IS NULL)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints first
    await queryRunner.query(`
      ALTER TABLE "control_evidence_maps"
      DROP CONSTRAINT IF EXISTS "CHK_cem_sampling_requirement"
    `)
    await queryRunner.query(`
      ALTER TABLE "control_evidence_maps"
      DROP CONSTRAINT IF EXISTS "CHK_cem_frequency"
    `)

    // Drop columns in reverse order
    const hasSamplingRequirement = await queryRunner.hasColumn('control_evidence_maps', 'sampling_requirement')
    if (hasSamplingRequirement) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        DROP COLUMN "sampling_requirement"
      `)
    }

    const hasOwnerRole = await queryRunner.hasColumn('control_evidence_maps', 'owner_role')
    if (hasOwnerRole) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        DROP COLUMN "owner_role"
      `)
    }

    const hasFrequency = await queryRunner.hasColumn('control_evidence_maps', 'frequency')
    if (hasFrequency) {
      await queryRunner.query(`
        ALTER TABLE "control_evidence_maps"
        DROP COLUMN "frequency"
      `)
    }
  }
}
