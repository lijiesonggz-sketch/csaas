import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryConversationMessages1772000000031 implements MigrationInterface {
  name = 'CreateAdvisoryConversationMessages1772000000031'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "role" character varying(32) NOT NULL,
        "content" text NOT NULL,
        "sequence" integer NOT NULL,
        "workflow_key" character varying(100) NOT NULL,
        "step_index" integer NOT NULL,
        "decision_options" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "provider_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_messages_session"
          FOREIGN KEY ("session_id")
          REFERENCES "workflow_sessions" ("id")
          ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_tenant_id"
      ON "conversation_messages" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_session_id"
      ON "conversation_messages" ("session_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_tenant_session_sequence"
      ON "conversation_messages" ("tenant_id", "session_id", "sequence")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_tenant_session_created"
      ON "conversation_messages" ("tenant_id", "session_id", "created_at")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversation_messages_workflow_step"
      ON "conversation_messages" ("tenant_id", "workflow_key", "step_index")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_workflow_step"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_tenant_session_created"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_tenant_session_sequence"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_session_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_conversation_messages_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "conversation_messages"
    `)
  }
}
