import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateTaxonomyRuntimeProfiles1772000000027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRuntimeProfiles = await queryRunner.hasTable('taxonomy_l2_runtime_profiles')

    if (!hasRuntimeProfiles) {
      await queryRunner.query(`
        CREATE TABLE "taxonomy_l2_runtime_profiles" (
          "l2_code" varchar(20) PRIMARY KEY REFERENCES "taxonomy_l2"("l2_code"),
          "definition" text NOT NULL DEFAULT '',
          "canonical_theme" varchar(200) NOT NULL DEFAULT '',
          "aliases_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "keywords_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "source_version" varchar(50) NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW()
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_taxonomy_runtime_profiles_source_version"
      ON "taxonomy_l2_runtime_profiles" ("source_version")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasRuntimeProfiles = await queryRunner.hasTable('taxonomy_l2_runtime_profiles')

    if (hasRuntimeProfiles) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_taxonomy_runtime_profiles_source_version"`)
      await queryRunner.query(`DROP TABLE "taxonomy_l2_runtime_profiles"`)
    }
  }
}
