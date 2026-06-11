import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * ai_tasks.type 实际为 varchar + CHECK 约束（ai_tasks_type_enum_check），
 * 重建约束以允许 standard_cross_compare。
 */
export class AddCrossCompareToTypeCheck1772000000043 implements MigrationInterface {
  name = 'AddCrossCompareToTypeCheck1772000000043'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" DROP CONSTRAINT IF EXISTS "ai_tasks_type_enum_check"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_type_enum_check" CHECK (
        (type)::text = ANY (ARRAY[
          'summary', 'clustering', 'matrix', 'questionnaire', 'action_plan',
          'standard_interpretation', 'standard_related_search', 'standard_version_compare',
          'standard_cross_compare',
          'binary_questionnaire', 'binary_gap_analysis', 'quick_gap_analysis'
        ]::text[])
      )`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" DROP CONSTRAINT IF EXISTS "ai_tasks_type_enum_check"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_type_enum_check" CHECK (
        (type)::text = ANY (ARRAY[
          'summary', 'clustering', 'matrix', 'questionnaire', 'action_plan',
          'standard_interpretation', 'standard_related_search', 'standard_version_compare',
          'binary_questionnaire', 'binary_gap_analysis', 'quick_gap_analysis'
        ]::text[])
      )`,
    )
  }
}
