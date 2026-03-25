import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGQuestionItems1772000000009 implements MigrationInterface {
  name = 'CreateKGQuestionItems1772000000009'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('question_items')
    if (exists) {
      return
    }

    await queryRunner.query(`
      CREATE TABLE "question_items" (
        "question_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "question_code" character varying(100) NOT NULL,
        "control_id" uuid NOT NULL,
        "question_text" text NOT NULL,
        "question_type" character varying(30) NOT NULL,
        "role_hint" jsonb,
        "answer_schema" jsonb,
        "scoring_json" jsonb,
        "applicable_tags" jsonb,
        "required" boolean NOT NULL DEFAULT true,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_question_items_question_id" PRIMARY KEY ("question_id"),
        CONSTRAINT "UQ_question_items_question_code" UNIQUE ("question_code"),
        CONSTRAINT "FK_question_items_control" FOREIGN KEY ("control_id") REFERENCES "control_points"("control_id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_question_items_control" ON "question_items" ("control_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_question_items_type" ON "question_items" ("question_type")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_question_items_status" ON "question_items" ("status")',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('question_items')
    if (!exists) {
      return
    }

    await queryRunner.query('DROP INDEX IF EXISTS "idx_question_items_status"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_question_items_type"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_question_items_control"')
    await queryRunner.query('DROP TABLE "question_items"')
  }
}
