import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryWorkflowOutputs1772000000033 implements MigrationInterface {
  name = 'CreateAdvisoryWorkflowOutputs1772000000033'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_outputs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "workflow_key" character varying(100) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'draft',
        "title" character varying(240) NOT NULL,
        "summary" text NOT NULL DEFAULT '',
        "content_markdown" text NOT NULL DEFAULT '',
        "sections" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "ai_label_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_outputs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workflow_outputs_session"
          FOREIGN KEY ("session_id")
          REFERENCES "workflow_sessions" ("id")
          ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_tenant_id"
      ON "workflow_outputs" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_session_id"
      ON "workflow_outputs" ("session_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_tenant_session"
      ON "workflow_outputs" ("tenant_id", "session_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_tenant_workflow_status"
      ON "workflow_outputs" ("tenant_id", "workflow_key", "status")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_tenant_created"
      ON "workflow_outputs" ("tenant_id", "created_at")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_outputs_one_draft_session"
      ON "workflow_outputs" ("tenant_id", "session_id")
      WHERE "status" = 'draft'
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_sections_gin"
      ON "workflow_outputs" USING GIN ("sections")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_metadata_gin"
      ON "workflow_outputs" USING GIN ("metadata")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_metadata_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_sections_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_tenant_created"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_one_draft_session"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_tenant_workflow_status"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_tenant_session"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_session_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_workflow_outputs_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "workflow_outputs"
    `)
  }
}
