import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAnalyzedContentTable1768800000000 implements MigrationInterface {
  name = 'CreateAnalyzedContentTable1768800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'analyzed_content_status_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "analyzed_content_status_enum" AS ENUM ('pending', 'success', 'failed');
        END IF;
      END $$;
    `)

    if (!(await queryRunner.hasTable('analyzed_contents'))) {
      await queryRunner.query(`
        CREATE TABLE "analyzed_contents" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "contentId" uuid NOT NULL,
          "keywords" jsonb NOT NULL DEFAULT '[]',
          "categories" jsonb NOT NULL DEFAULT '[]',
          "targetAudience" varchar(200),
          "aiSummary" text,
          "roiAnalysis" jsonb,
          "relevanceScore" float,
          "aiModel" varchar(50) NOT NULL,
          "tokensUsed" int NOT NULL,
          "status" "analyzed_content_status_enum" NOT NULL DEFAULT 'pending',
          "errorMessage" text,
          "analyzedAt" timestamp NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_analyzed_contents_contentId" FOREIGN KEY ("contentId")
            REFERENCES "raw_contents"("id") ON DELETE CASCADE
        )
      `)
    } else {
      await queryRunner.query(`ALTER TABLE "analyzed_contents" ADD COLUMN IF NOT EXISTS "categories" jsonb NOT NULL DEFAULT '[]'`)
      await queryRunner.query(`ALTER TABLE "analyzed_contents" ADD COLUMN IF NOT EXISTS "relevanceScore" float`)
      await queryRunner.query(
        `ALTER TABLE "analyzed_contents" ADD COLUMN IF NOT EXISTS "status" "analyzed_content_status_enum" NOT NULL DEFAULT 'pending'`,
      )
      await queryRunner.query(`ALTER TABLE "analyzed_contents" ADD COLUMN IF NOT EXISTS "errorMessage" text`)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analyzed_contents_contentId" ON "analyzed_contents" ("contentId")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analyzed_contents_status" ON "analyzed_contents" ("status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analyzed_contents_relevanceScore" ON "analyzed_contents" ("relevanceScore")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_analyzed_contents_analyzedAt" ON "analyzed_contents" ("analyzedAt")
    `)

    if (!(await queryRunner.hasTable('content_tags'))) {
      await queryRunner.query(`
        CREATE TABLE "content_tags" (
          "contentId" uuid NOT NULL,
          "tagId" uuid NOT NULL,
          CONSTRAINT "PK_content_tags" PRIMARY KEY ("contentId", "tagId"),
          CONSTRAINT "FK_content_tags_contentId" FOREIGN KEY ("contentId")
            REFERENCES "analyzed_contents"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_content_tags_tagId" FOREIGN KEY ("tagId")
            REFERENCES "tags"("id") ON DELETE CASCADE
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_content_tags_contentId" ON "content_tags" ("contentId")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_content_tags_tagId" ON "content_tags" ("tagId")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_tags_tagId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_tags_contentId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_analyzed_contents_analyzedAt"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_analyzed_contents_relevanceScore"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_analyzed_contents_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_analyzed_contents_contentId"`)

    if (await queryRunner.hasTable('content_tags')) {
      await queryRunner.query(`DROP TABLE "content_tags"`)
    }

    if (await queryRunner.hasTable('analyzed_contents')) {
      await queryRunner.query(`DROP TABLE "analyzed_contents"`)
    }

    await queryRunner.query(`DROP TYPE IF EXISTS "analyzed_content_status_enum"`)
  }
}
