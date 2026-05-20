import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryRecommendationFeedback1772000000035 implements MigrationInterface {
  name = 'CreateAdvisoryRecommendationFeedback1772000000035'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recommendation_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "quick_consult_context_id" uuid NOT NULL,
        "rating" integer NOT NULL,
        "feedback_text" text,
        "problem_type_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "primary_problem_type" character varying(80),
        "recommendation_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "workflow_keys" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recommendation_feedback" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recommendation_feedback_quick_consult_context"
          FOREIGN KEY ("quick_consult_context_id") REFERENCES "quick_consult_contexts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_recommendation_feedback_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_tenant_id"
      ON "recommendation_feedback" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_actor_id"
      ON "recommendation_feedback" ("actor_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_context_id"
      ON "recommendation_feedback" ("quick_consult_context_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_tenant_created"
      ON "recommendation_feedback" ("tenant_id", "created_at")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_tenant_rating"
      ON "recommendation_feedback" ("tenant_id", "rating")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_tenant_problem_type"
      ON "recommendation_feedback" ("tenant_id", "primary_problem_type")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_recommendation_feedback_workflow_keys_gin"
      ON "recommendation_feedback" USING GIN ("workflow_keys")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_recommendation_feedback_one_per_actor_context"
      ON "recommendation_feedback" ("tenant_id", "actor_id", "quick_consult_context_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_one_per_actor_context"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_workflow_keys_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_tenant_problem_type"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_tenant_rating"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_tenant_created"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_context_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_actor_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_recommendation_feedback_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "recommendation_feedback"
    `)
  }
}
