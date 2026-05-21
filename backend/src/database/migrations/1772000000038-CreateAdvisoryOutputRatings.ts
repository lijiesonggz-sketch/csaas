import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryOutputRatings1772000000038 implements MigrationInterface {
  name = 'CreateAdvisoryOutputRatings1772000000038'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "output_ratings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "output_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "rating" integer,
        "feedback_text" text,
        "is_favorited" boolean NOT NULL DEFAULT false,
        "rated_at" TIMESTAMP WITH TIME ZONE,
        "favorited_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_output_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_output_ratings_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5),
        CONSTRAINT "FK_output_ratings_output"
          FOREIGN KEY ("output_id")
          REFERENCES "workflow_outputs" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_output_ratings_session"
          FOREIGN KEY ("session_id")
          REFERENCES "workflow_sessions" ("id")
          ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_output_ratings_one_per_actor_output"
      ON "output_ratings" ("tenant_id", "actor_id", "output_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_output"
      ON "output_ratings" ("tenant_id", "output_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_actor"
      ON "output_ratings" ("tenant_id", "actor_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_created"
      ON "output_ratings" ("tenant_id", "created_at")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_rating"
      ON "output_ratings" ("tenant_id", "rating")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_tenant_favorited"
      ON "output_ratings" ("tenant_id", "is_favorited")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_output_ratings_metadata_gin"
      ON "output_ratings" USING GIN ("metadata")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_metadata_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_tenant_favorited"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_tenant_rating"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_tenant_created"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_tenant_actor"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_tenant_output"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_output_ratings_one_per_actor_output"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "output_ratings"
    `)
  }
}
