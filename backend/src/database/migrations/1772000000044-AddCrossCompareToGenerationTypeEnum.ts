import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * ai_generation_results.generation_type 是真正的 PG enum，
 * 为结果聚合管线补充 standard_cross_compare 值。
 */
export class AddCrossCompareToGenerationTypeEnum1772000000044 implements MigrationInterface {
  name = 'AddCrossCompareToGenerationTypeEnum1772000000044'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ai_generation_results_generation_type_enum" ADD VALUE IF NOT EXISTS 'standard_cross_compare'`,
    )
  }

  public async down(): Promise<void> {
    // PostgreSQL 不支持删除 enum 值
  }
}
