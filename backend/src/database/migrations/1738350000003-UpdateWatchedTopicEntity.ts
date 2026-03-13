import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Update WatchedTopic entity fields
 *
 * Story 5.1 - Configure Focus Technical Areas
 *
 * Changes:
 * - Rename column: name -> topic_name
 * - Add column: topic_type (enum: 'tech', 'industry')
 * - Add column: description (varchar 500, nullable)
 * - Add column: source (varchar 50, nullable)
 */
export class UpdateWatchedTopicEntity1738350000003 implements MigrationInterface {
  name = 'UpdateWatchedTopicEntity1738350000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('watched_topics')
    if (!tableExists) {
      return
    }

    // Check if 'name' column exists (old schema)
    const table = await queryRunner.getTable('watched_topics')
    const nameColumn = table?.findColumnByName('name')

    if (nameColumn) {
      // Rename 'name' to 'topic_name'
      await queryRunner.renameColumn('watched_topics', 'name', 'topic_name')
    }

    // Add topic_type column if not exists
    const topicTypeColumn = table?.findColumnByName('topic_type')
    if (!topicTypeColumn) {
      await queryRunner.query(`
        ALTER TABLE "watched_topics"
        ADD COLUMN "topic_type" VARCHAR(20) NOT NULL DEFAULT 'tech'
      `)

      // Create enum constraint
      await queryRunner.query(`
        ALTER TABLE "watched_topics"
        ADD CONSTRAINT "CHK_watched_topics_topic_type"
        CHECK ("topic_type" IN ('tech', 'industry'))
      `)
    }

    // Add description column if not exists
    const descriptionColumn = table?.findColumnByName('description')
    if (!descriptionColumn) {
      await queryRunner.query(`
        ALTER TABLE "watched_topics"
        ADD COLUMN "description" VARCHAR(500) NULL
      `)
    }

    // Add source column if not exists
    const sourceColumn = table?.findColumnByName('source')
    if (!sourceColumn) {
      await queryRunner.query(`
        ALTER TABLE "watched_topics"
        ADD COLUMN "source" VARCHAR(50) NULL DEFAULT 'manual'
      `)
    }

    // Create index on topic_type for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watched_topics_topic_type"
      ON "watched_topics" ("topic_type")
    `)

    // Create composite index for organization + topic_type queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watched_topics_org_type"
      ON "watched_topics" ("organization_id", "topic_type")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('watched_topics')
    if (!tableExists) {
      return
    }

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_watched_topics_org_type"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_watched_topics_topic_type"
    `)

    // Drop source column
    await queryRunner.query(`
      ALTER TABLE "watched_topics" DROP COLUMN IF EXISTS "source"
    `)

    // Drop description column
    await queryRunner.query(`
      ALTER TABLE "watched_topics" DROP COLUMN IF EXISTS "description"
    `)

    // Drop topic_type constraint and column
    await queryRunner.query(`
      ALTER TABLE "watched_topics"
      DROP CONSTRAINT IF EXISTS "CHK_watched_topics_topic_type"
    `)
    await queryRunner.query(`
      ALTER TABLE "watched_topics" DROP COLUMN IF EXISTS "topic_type"
    `)

    // Rename topic_name back to name
    const table = await queryRunner.getTable('watched_topics')
    const topicNameColumn = table?.findColumnByName('topic_name')
    if (topicNameColumn) {
      await queryRunner.renameColumn('watched_topics', 'topic_name', 'name')
    }
  }
}
