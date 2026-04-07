import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPenalizedPersonToComplianceCases1772000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('compliance_cases', 'penalized_person')

    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "penalized_person" varchar(200)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('compliance_cases', 'penalized_person')

    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "penalized_person"
      `)
    }
  }
}
