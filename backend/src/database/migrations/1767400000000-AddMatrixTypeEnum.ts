import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMatrixTypeEnum1767400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 'matrix' 到 ai_tasks_type_enum 枚举类型
    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ALTER COLUMN "type" TYPE VARCHAR(50);
    `)

    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ADD CONSTRAINT "ai_tasks_type_enum_check"
      CHECK ("type" IN ('summary', 'clustering', 'matrix', 'questionnaire', 'action_plan'));
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：移除 'matrix' 从枚举（恢复原来的 CHECK 约束）
    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      DROP CONSTRAINT IF EXISTS "ai_tasks_type_enum_check";
    `)

    await queryRunner.query(`
      ALTER TABLE "ai_tasks"
      ADD CONSTRAINT "ai_tasks_type_enum_check"
      CHECK ("type" IN ('summary', 'clustering', 'questionnaire', 'action_plan'));
    `)
  }
}
