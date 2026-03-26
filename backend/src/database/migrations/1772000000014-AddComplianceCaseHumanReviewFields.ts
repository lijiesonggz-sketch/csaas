import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddComplianceCaseHumanReviewFields1772000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasHumanReviewed = await queryRunner.hasColumn('compliance_cases', 'human_reviewed')

    if (!hasHumanReviewed) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "human_reviewed" boolean NOT NULL DEFAULT false
      `)
    }

    const hasReviewedBy = await queryRunner.hasColumn('compliance_cases', 'reviewed_by')

    if (!hasReviewedBy) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "reviewed_by" varchar(100)
      `)
    }

    const hasReviewedAt = await queryRunner.hasColumn('compliance_cases', 'reviewed_at')

    if (!hasReviewedAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "reviewed_at" timestamp
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasReviewedAt = await queryRunner.hasColumn('compliance_cases', 'reviewed_at')
    if (hasReviewedAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "reviewed_at"
      `)
    }

    const hasReviewedBy = await queryRunner.hasColumn('compliance_cases', 'reviewed_by')
    if (hasReviewedBy) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "reviewed_by"
      `)
    }

    const hasHumanReviewed = await queryRunner.hasColumn('compliance_cases', 'human_reviewed')
    if (hasHumanReviewed) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "human_reviewed"
      `)
    }
  }
}
