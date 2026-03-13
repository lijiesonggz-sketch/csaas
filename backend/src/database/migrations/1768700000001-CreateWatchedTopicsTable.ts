import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Create watched_topics table
 *
 * This migration creates the table for storing technical topics that
 * organizations want to monitor in Radar Service.
 *
 * Story 1.4 - AC 4: 引导步骤2 - 关注技术领域
 */
export class CreateWatchedTopicsTable1768700000001 implements MigrationInterface {
  name = 'CreateWatchedTopicsTable1768700000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "watched_topics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "topic_name" varchar(100) NOT NULL,
        "topic_type" varchar(20) NOT NULL DEFAULT 'tech',
        "description" varchar(500),
        "source" varchar(50) DEFAULT 'manual',
        "organization_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "fk_watch_topics_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_watched_topics_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id"),
        CONSTRAINT "CHK_watched_topics_topic_type"
          CHECK ("topic_type" IN ('tech', 'industry'))
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watch_topics_org" ON "watched_topics"("organization_id")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watched_topics_tenant_id" ON "watched_topics"("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_watched_topics_topic_type" ON "watched_topics" ("topic_type")
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_watched_topics_org_type" ON "watched_topics" ("organization_id", "topic_type")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_watched_topics_org_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_watched_topics_topic_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_watched_topics_tenant_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_watch_topics_org"`)
    await queryRunner.query(`DROP TABLE "watched_topics"`)
  }
}
