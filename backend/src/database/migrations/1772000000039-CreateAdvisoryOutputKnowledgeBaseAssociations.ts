import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039 implements MigrationInterface {
  name = 'CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "output_knowledge_base_associations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "output_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "destination_key" varchar(128) NOT NULL,
        "status" varchar(32) NOT NULL,
        "title" varchar(500) NOT NULL,
        "summary" text NOT NULL,
        "source_workflow" varchar(120) NOT NULL,
        "file_path" text NOT NULL,
        "ai_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "external_reference_id" varchar(255),
        "message" text,
        "last_attempt_at" timestamptz,
        "associated_at" timestamptz,
        "retry_count" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_output_knowledge_base_associations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_output_kb_associations_status" CHECK ("status" IN ('associated', 'pending', 'failed')),
        CONSTRAINT "FK_output_kb_associations_output"
          FOREIGN KEY ("output_id")
          REFERENCES "workflow_outputs" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_output_kb_associations_session"
          FOREIGN KEY ("session_id")
          REFERENCES "workflow_sessions" ("id")
          ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_output_kb_associations_one_per_output_destination"
      ON "output_knowledge_base_associations" ("tenant_id", "output_id", "destination_key")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_status"
      ON "output_knowledge_base_associations" ("tenant_id", "status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_output"
      ON "output_knowledge_base_associations" ("tenant_id", "output_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_actor"
      ON "output_knowledge_base_associations" ("tenant_id", "actor_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_updated"
      ON "output_knowledge_base_associations" ("tenant_id", "updated_at")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_ai_metadata_gin"
      ON "output_knowledge_base_associations" USING gin ("ai_metadata")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_output_kb_associations_ai_metadata_gin"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_output_kb_associations_tenant_updated"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_output_kb_associations_tenant_actor"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_output_kb_associations_tenant_output"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_output_kb_associations_tenant_status"')
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_output_kb_associations_one_per_output_destination"',
    )
    await queryRunner.query('DROP TABLE IF EXISTS "output_knowledge_base_associations"')
  }
}
