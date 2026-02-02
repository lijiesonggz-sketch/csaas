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
        "name" varchar NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "fk_watch_topics_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watch_topics_org" ON "watched_topics"("organization_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "watched_topics"`)
  }
}
