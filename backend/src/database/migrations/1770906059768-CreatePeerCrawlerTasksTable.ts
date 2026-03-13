import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePeerCrawlerTasksTable1770906059768 implements MigrationInterface {
  name = 'CreatePeerCrawlerTasksTable1770906059768'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('peer_crawler_tasks'))) {
      await queryRunner.query(`
        CREATE TABLE "peer_crawler_tasks" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "sourceId" uuid NOT NULL,
          "peerName" character varying(255) NOT NULL,
          "tenantId" uuid NOT NULL,
          "status" character varying NOT NULL DEFAULT 'pending',
          "sourceType" character varying NOT NULL,
          "targetUrl" character varying(1000) NOT NULL,
          "crawlResult" jsonb,
          "rawContentId" uuid,
          "retryCount" integer NOT NULL DEFAULT 0,
          "errorMessage" text,
          "startedAt" timestamp,
          "completedAt" timestamp,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          "deletedAt" timestamp,
          CONSTRAINT "PK_peer_crawler_tasks" PRIMARY KEY ("id")
        )
      `)
    }

    if (await queryRunner.hasColumn('peer_crawler_tasks', 'sourceId')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_peer_crawler_tasks_sourceId" ON "peer_crawler_tasks" ("sourceId")
      `)
    }

    if (await queryRunner.hasColumn('peer_crawler_tasks', 'status')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_peer_crawler_tasks_status" ON "peer_crawler_tasks" ("status")
      `)
    }

    if (await queryRunner.hasColumn('peer_crawler_tasks', 'tenantId')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_peer_crawler_tasks_tenantId" ON "peer_crawler_tasks" ("tenantId")
      `)
    }

    if (await queryRunner.hasColumn('peer_crawler_tasks', 'createdAt')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_peer_crawler_tasks_createdAt" ON "peer_crawler_tasks" ("createdAt")
      `)
    }

    if (await queryRunner.hasColumn('peer_crawler_tasks', 'rawContentId')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_peer_crawler_tasks_rawContentId" ON "peer_crawler_tasks" ("rawContentId")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_peer_crawler_tasks_rawContentId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_peer_crawler_tasks_createdAt"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_peer_crawler_tasks_tenantId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_peer_crawler_tasks_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_peer_crawler_tasks_sourceId"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "peer_crawler_tasks"`)
  }
}
