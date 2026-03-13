import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateRadarPushAndPushLog1768900000000 implements MigrationInterface {
  name = 'CreateRadarPushAndPushLog1768900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'radar_push_radar_type_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "radar_push_radar_type_enum" AS ENUM ('tech', 'industry', 'compliance');
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'radar_push_priority_level_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "radar_push_priority_level_enum" AS ENUM ('high', 'medium', 'low');
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'radar_push_status_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "radar_push_status_enum" AS ENUM ('scheduled', 'sent', 'failed', 'cancelled');
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'push_log_status_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "push_log_status_enum" AS ENUM ('success', 'failed');
        END IF;
      END $$;
    `)

    if (!(await queryRunner.hasTable('radar_pushes'))) {
      await queryRunner.query(`
        CREATE TABLE "radar_pushes" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "organizationId" uuid NOT NULL,
          "radarType" "radar_push_radar_type_enum" NOT NULL,
          "contentId" uuid NOT NULL,
          "relevanceScore" decimal(3,2) NOT NULL,
          "priorityLevel" "radar_push_priority_level_enum" NOT NULL,
          "scheduledAt" timestamp NOT NULL,
          "status" "radar_push_status_enum" NOT NULL DEFAULT 'scheduled',
          "sentAt" timestamp,
          "isRead" boolean NOT NULL DEFAULT false,
          "readAt" timestamp,
          "isBookmarked" boolean NOT NULL DEFAULT false,
          "scheduleConfigId" uuid,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          "updatedAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_radar_pushes_organizationId" FOREIGN KEY ("organizationId")
            REFERENCES "organizations"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_radar_pushes_contentId" FOREIGN KEY ("contentId")
            REFERENCES "analyzed_contents"("id") ON DELETE CASCADE
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_organizationId" ON "radar_pushes" ("organizationId")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_status" ON "radar_pushes" ("status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_scheduledAt" ON "radar_pushes" ("scheduledAt")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_contentId" ON "radar_pushes" ("contentId")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_organization_radar_status"
      ON "radar_pushes" ("organizationId", "radarType", "status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_scheduled_status"
      ON "radar_pushes" ("scheduledAt", "status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_pushes_relevanceScore" ON "radar_pushes" ("relevanceScore")
    `)

    if (!(await queryRunner.hasTable('push_logs'))) {
      await queryRunner.query(`
        CREATE TABLE "push_logs" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "pushId" uuid NOT NULL,
          "status" "push_log_status_enum" NOT NULL,
          "errorMessage" text,
          "retryCount" int NOT NULL DEFAULT 0,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "FK_push_logs_pushId" FOREIGN KEY ("pushId")
            REFERENCES "radar_pushes"("id") ON DELETE CASCADE
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_push_logs_pushId" ON "push_logs" ("pushId")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_push_logs_status" ON "push_logs" ("status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_push_logs_createdAt" ON "push_logs" ("createdAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_push_logs_createdAt"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_push_logs_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_push_logs_pushId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_relevanceScore"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_scheduled_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_organization_radar_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_contentId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_scheduledAt"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_radar_pushes_organizationId"`)

    if (await queryRunner.hasTable('push_logs')) {
      await queryRunner.query(`DROP TABLE "push_logs"`)
    }

    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`DROP TABLE "radar_pushes"`)
    }

    await queryRunner.query(`DROP TYPE IF EXISTS "push_log_status_enum"`)
    await queryRunner.query(`DROP TYPE IF EXISTS "radar_push_status_enum"`)
    await queryRunner.query(`DROP TYPE IF EXISTS "radar_push_priority_level_enum"`)
    await queryRunner.query(`DROP TYPE IF EXISTS "radar_push_radar_type_enum"`)
  }
}
