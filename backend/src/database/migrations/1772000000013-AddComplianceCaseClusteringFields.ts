import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddComplianceCaseClusteringFields1772000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasNormalizedThemes = await queryRunner.hasColumn('compliance_cases', 'normalized_themes')

    if (!hasNormalizedThemes) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "normalized_themes" jsonb
      `)
    }

    const hasCandidateControlPoints = await queryRunner.hasColumn(
      'compliance_cases',
      'candidate_control_points',
    )

    if (!hasCandidateControlPoints) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "candidate_control_points" jsonb
      `)
    }

    const hasClusteredAt = await queryRunner.hasColumn('compliance_cases', 'clustered_at')

    if (!hasClusteredAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "clustered_at" timestamp
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasClusteredAt = await queryRunner.hasColumn('compliance_cases', 'clustered_at')
    if (hasClusteredAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "clustered_at"
      `)
    }

    const hasCandidateControlPoints = await queryRunner.hasColumn(
      'compliance_cases',
      'candidate_control_points',
    )
    if (hasCandidateControlPoints) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "candidate_control_points"
      `)
    }

    const hasNormalizedThemes = await queryRunner.hasColumn('compliance_cases', 'normalized_themes')
    if (hasNormalizedThemes) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "normalized_themes"
      `)
    }
  }
}
