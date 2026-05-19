import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryWorkflowSessions1772000000030 implements MigrationInterface {
  name = 'CreateAdvisoryWorkflowSessions1772000000030'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "workflow_key" character varying(100) NOT NULL,
        "workflow_display_name" character varying(200) NOT NULL,
        "scenario_label" character varying(255) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'active',
        "current_step" jsonb NOT NULL,
        "source_refs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "failure_code" character varying(120),
        "failure_message" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_sessions" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_tenant_id"
      ON "workflow_sessions" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_actor_id"
      ON "workflow_sessions" ("actor_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_workflow_key"
      ON "workflow_sessions" ("workflow_key")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_status"
      ON "workflow_sessions" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_tenant_workflow_status"
      ON "workflow_sessions" ("tenant_id", "workflow_key", "status")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_sessions_one_active_actor"
      ON "workflow_sessions" ("tenant_id", "actor_id")
      WHERE "status" = 'active'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_one_active_actor"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_tenant_workflow_status"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_status"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_workflow_key"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_actor_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "workflow_sessions"
    `)
  }
}
