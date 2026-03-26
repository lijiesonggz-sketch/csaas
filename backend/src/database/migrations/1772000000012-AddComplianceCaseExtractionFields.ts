import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddComplianceCaseExtractionFields1772000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasViolationThemes = await queryRunner.hasColumn('compliance_cases', 'violation_themes')

    if (!hasViolationThemes) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "violation_themes" jsonb
      `)
    }

    const hasClauseCandidates = await queryRunner.hasColumn('compliance_cases', 'clause_candidates')

    if (!hasClauseCandidates) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "clause_candidates" jsonb
      `)
    }

    const hasExtractedAt = await queryRunner.hasColumn('compliance_cases', 'extracted_at')

    if (!hasExtractedAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        ADD COLUMN "extracted_at" timestamp
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasExtractedAt = await queryRunner.hasColumn('compliance_cases', 'extracted_at')
    if (hasExtractedAt) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "extracted_at"
      `)
    }

    const hasClauseCandidates = await queryRunner.hasColumn('compliance_cases', 'clause_candidates')
    if (hasClauseCandidates) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "clause_candidates"
      `)
    }

    const hasViolationThemes = await queryRunner.hasColumn('compliance_cases', 'violation_themes')
    if (hasViolationThemes) {
      await queryRunner.query(`
        ALTER TABLE "compliance_cases"
        DROP COLUMN "violation_themes"
      `)
    }
  }
}
