import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryQuickConsultContexts1772000000034 implements MigrationInterface {
  name = 'CreateAdvisoryQuickConsultContexts1772000000034'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quick_consult_contexts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "original_problem" text NOT NULL,
        "normalized_problem" text,
        "status" character varying(32) NOT NULL DEFAULT 'clarification_required',
        "clarification_questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "clarification_answers" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "provider" character varying(80),
        "provider_status" character varying(32),
        "latency_ms" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quick_consult_contexts" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quick_consult_contexts_tenant_id"
      ON "quick_consult_contexts" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quick_consult_contexts_actor_id"
      ON "quick_consult_contexts" ("actor_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quick_consult_contexts_status"
      ON "quick_consult_contexts" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_quick_consult_contexts_tenant_actor_created"
      ON "quick_consult_contexts" ("tenant_id", "actor_id", "created_at")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_quick_consult_contexts_tenant_actor_created"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_quick_consult_contexts_status"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_quick_consult_contexts_actor_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_quick_consult_contexts_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "quick_consult_contexts"
    `)
  }
}
