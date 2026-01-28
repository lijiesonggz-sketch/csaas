import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTaskProgressFields1767291591745 implements MigrationInterface {
  name = 'AddTaskProgressFields1767291591745'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for generation_stage
    await queryRunner.query(
      `CREATE TYPE "public"."ai_tasks_generation_stage_enum" AS ENUM('pending', 'generating_models', 'quality_validation', 'aggregating', 'completed', 'failed')`,
    )

    // Add generation_stage column
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD "generation_stage" "public"."ai_tasks_generation_stage_enum" NOT NULL DEFAULT 'pending'`,
    )

    // Add progress_details column
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "progress_details" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop progress_details column
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "progress_details"`)

    // Drop generation_stage column
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "generation_stage"`)

    // Drop enum type
    await queryRunner.query(`DROP TYPE "public"."ai_tasks_generation_stage_enum"`)
  }
}
