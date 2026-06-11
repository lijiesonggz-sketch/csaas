import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 新增 standard_cross_compare 任务类型（多标准交叉分析）
 *
 * 实际数据库中 ai_tasks.type 列为 varchar（历史 migration 已转换），
 * varchar 列无需 DDL 即可接受新值。仅当列仍为 enum 类型时才补充枚举值。
 */
export class AddStandardCrossCompareTaskType1772000000042 implements MigrationInterface {
  name = 'AddStandardCrossCompareTaskType1772000000042'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const column: Array<{ udt_name: string }> = await queryRunner.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'ai_tasks' AND column_name = 'type'`,
    )

    const udtName = column[0]?.udt_name
    if (udtName && udtName !== 'varchar' && udtName !== 'text') {
      await queryRunner.query(
        `ALTER TYPE "public"."${udtName}" ADD VALUE IF NOT EXISTS 'standard_cross_compare'`,
      )
    }
    // varchar/text 列：无需任何 DDL
  }

  public async down(): Promise<void> {
    // PostgreSQL 不支持删除 enum 值；varchar 情况下本身无 DDL 可回滚
  }
}
