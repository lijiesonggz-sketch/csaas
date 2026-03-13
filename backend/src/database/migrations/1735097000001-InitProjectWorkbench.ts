import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitProjectWorkbench1735097000001 implements MigrationInterface {
  name = 'InitProjectWorkbench1735097000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "client_name" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "standard_name" VARCHAR(100);
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_projects_owner" ON "projects"("owner_id");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_projects_status" ON "projects"("status");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_projects_tenant" ON "projects"("tenant_id");
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_members" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" VARCHAR(20) NOT NULL,
        "added_at" TIMESTAMP DEFAULT NOW(),
        "added_by" UUID REFERENCES "users"("id"),
        UNIQUE("project_id", "user_id")
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_project_members_project" ON "project_members"("project_id");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_project_members_user" ON "project_members"("user_id");
    `)

    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ADD COLUMN IF NOT EXISTS "backup_result" JSONB,
      ADD COLUMN IF NOT EXISTS "backup_created_at" TIMESTAMP;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_tasks_backup"
      ON "ai_tasks"("project_id", "type")
      WHERE "backup_result" IS NOT NULL;
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_users" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" VARCHAR(100) UNIQUE,
        "name" VARCHAR(100),
        "type" VARCHAR(50) DEFAULT 'SYSTEM',
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      INSERT INTO "system_users" ("id", "email", "name", "type")
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'system@csaas.local',
        'System Account',
        'SYSTEM'
      )
      ON CONFLICT ("email") DO NOTHING;
    `)

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "project_id" UUID,
      ADD COLUMN IF NOT EXISTS "success" BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS "error_message" TEXT;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_audit_logs_project'
        ) THEN
          ALTER TABLE "audit_logs"
          ADD CONSTRAINT "FK_audit_logs_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs"("user_id");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_project" ON "audit_logs"("project_id");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action");
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "audit_logs"("created_at");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_created";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_action";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_project";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_user";`)

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP CONSTRAINT IF EXISTS "FK_audit_logs_project";
    `)

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "error_message",
      DROP COLUMN IF EXISTS "success",
      DROP COLUMN IF EXISTS "project_id";
    `)

    await queryRunner.query(`DELETE FROM "system_users" WHERE "email" = 'system@csaas.local';`)
    await queryRunner.query(`DROP TABLE IF EXISTS "system_users";`)

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ai_tasks_backup";`)
    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      DROP COLUMN IF EXISTS "backup_created_at",
      DROP COLUMN IF EXISTS "backup_result";
    `)

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_project_members_user";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_project_members_project";`)
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members";`)

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_tenant";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_status";`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_owner";`)

    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP COLUMN IF EXISTS "standard_name",
      DROP COLUMN IF EXISTS "client_name";
    `)
  }
}
