import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCaseControlMapSource1772000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSource = await queryRunner.hasColumn('case_control_maps', 'source')

    if (!hasSource) {
      await queryRunner.query(`
        ALTER TABLE "case_control_maps"
        ADD COLUMN "source" varchar(30) NOT NULL DEFAULT 'RULE'
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasSource = await queryRunner.hasColumn('case_control_maps', 'source')

    if (hasSource) {
      await queryRunner.query(`
        ALTER TABLE "case_control_maps"
        DROP COLUMN "source"
      `)
    }
  }
}
