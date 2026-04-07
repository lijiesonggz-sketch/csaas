import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddControlPointSemanticMetadata1772000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAliases = await queryRunner.hasColumn('control_points', 'aliases')

    if (!hasAliases) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "aliases" jsonb
      `)
    }

    const hasKeywords = await queryRunner.hasColumn('control_points', 'keywords')

    if (!hasKeywords) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "keywords" jsonb
      `)
    }

    const hasCanonicalTheme = await queryRunner.hasColumn('control_points', 'canonical_theme')

    if (!hasCanonicalTheme) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        ADD COLUMN "canonical_theme" varchar(300)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCanonicalTheme = await queryRunner.hasColumn('control_points', 'canonical_theme')

    if (hasCanonicalTheme) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        DROP COLUMN "canonical_theme"
      `)
    }

    const hasKeywords = await queryRunner.hasColumn('control_points', 'keywords')

    if (hasKeywords) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        DROP COLUMN "keywords"
      `)
    }

    const hasAliases = await queryRunner.hasColumn('control_points', 'aliases')

    if (hasAliases) {
      await queryRunner.query(`
        ALTER TABLE "control_points"
        DROP COLUMN "aliases"
      `)
    }
  }
}
