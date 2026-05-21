import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryWorkflowCheckpoints1772000000037 implements MigrationInterface {
  name = 'CreateAdvisoryWorkflowCheckpoints1772000000037'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_sessions_tenant_id_id"
      ON "workflow_sessions" ("tenant_id", "id")
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_checkpoints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "workflow_key" character varying(100) NOT NULL,
        "workflow_type" character varying(200) NOT NULL,
        "step_index" integer NOT NULL,
        "sequence" integer NOT NULL,
        "checkpoint_type" character varying(64) NOT NULL,
        "current_step" jsonb NOT NULL,
        "conversation_state" jsonb NOT NULL,
        "document_state" jsonb NOT NULL,
        "state_snapshot" jsonb NOT NULL,
        "summary" text NOT NULL DEFAULT '',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_checkpoints" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workflow_checkpoints_session"
          FOREIGN KEY ("tenant_id", "session_id")
          REFERENCES "workflow_sessions" ("tenant_id", "id")
          ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_tenant_id"
      ON "workflow_checkpoints" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_session_id"
      ON "workflow_checkpoints" ("session_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_tenant_session"
      ON "workflow_checkpoints" ("tenant_id", "session_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_tenant_workflow"
      ON "workflow_checkpoints" ("tenant_id", "workflow_key")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_last_activity"
      ON "workflow_checkpoints" ("tenant_id", "last_activity_at")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_checkpoints_tenant_session_sequence"
      ON "workflow_checkpoints" ("tenant_id", "session_id", "sequence")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_state_snapshot_gin"
      ON "workflow_checkpoints" USING GIN ("state_snapshot")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_checkpoints_metadata_gin"
      ON "workflow_checkpoints" USING GIN ("metadata")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_metadata_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_state_snapshot_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_last_activity"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_tenant_session_sequence"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_tenant_workflow"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_tenant_session"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_session_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_checkpoints_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "workflow_checkpoints"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_sessions_tenant_id_id"
    `)
  }
}
