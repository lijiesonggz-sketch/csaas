import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddComplianceCaseImportFields1772000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRegulatorCode = await queryRunner.hasColumn('compliance_cases', 'regulator_code')

    if (!hasRegulatorCode) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "regulator_code" varchar(20)
      `)
    }

    const hasPenaltyReason = await queryRunner.hasColumn('compliance_cases', 'penalty_reason')

    if (!hasPenaltyReason) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "penalty_reason" text
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_compliance_cases_regulator_code"
      ON "compliance_cases" ("regulator_code")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_compliance_cases_regulator_code"')

    const hasPenaltyReason = await queryRunner.hasColumn('compliance_cases', 'penalty_reason')
    if (hasPenaltyReason) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "penalty_reason"
      `)
    }

    const hasRegulatorCode = await queryRunner.hasColumn('compliance_cases', 'regulator_code')
    if (hasRegulatorCode) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "regulator_code"
      `)
    }
  }
}
