import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

/**
 * Story 4.1: 配置合规雷达信息源
 *
 * 添加合规雷达支持：
 * 1. 扩展 raw_contents 表：添加 complianceData 字段
 * 2. 扩展 analyzed_contents 表：添加 complianceAnalysis 字段
 * 3. 扩展 crawler_logs 表：添加 contentId, crawlDuration 字段，重命名 executedAt 为 crawledAt
 * 4. radar_sources 表：添加 source + category 唯一索引
 */
export class AddComplianceRadarSupport1738207200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 扩展 raw_contents 表 - 添加 complianceData 字段
    await queryRunner.query(`
      ALTER TABLE "raw_contents"
      ADD COLUMN IF NOT EXISTS "complianceData" JSONB;
    `)

    // 2. 扩展 analyzed_contents 表 - 添加 complianceAnalysis 字段
    await queryRunner.query(`
      ALTER TABLE "analyzed_contents"
      ADD COLUMN IF NOT EXISTS "complianceAnalysis" JSONB;
    `)

    // 3. 扩展 crawler_logs 表
    // 添加 contentId 字段
    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      ADD COLUMN IF NOT EXISTS "contentId" UUID;
    `)

    // 添加 contentId 索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crawler_logs_contentId"
      ON "crawler_logs"("contentId");
    `)

    // 添加 crawlDuration 字段
    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      ADD COLUMN IF NOT EXISTS "crawlDuration" INTEGER DEFAULT 0;
    `)

    // 重命名字段 executedAt 为 crawledAt
    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      RENAME COLUMN "executedAt" TO "crawledAt";
    `)

    // 更新索引名称（如果存在旧的 executedAt 索引）
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_crawler_logs_executedAt";
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crawler_logs_crawledAt"
      ON "crawler_logs"("crawledAt");
    `)

    // 4. radar_sources 表：添加 source + category 唯一索引
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_radar_sources_source_category_unique"
      ON "radar_sources"("source", "category");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚 radar_sources 唯一索引
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_radar_sources_source_category_unique";
    `)

    // 回滚 crawler_logs 修改
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_crawler_logs_crawledAt";
    `)

    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      RENAME COLUMN "crawledAt" TO "executedAt";
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crawler_logs_executedAt"
      ON "crawler_logs"("executedAt");
    `)

    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      DROP COLUMN IF EXISTS "crawlDuration";
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_crawler_logs_contentId";
    `)

    await queryRunner.query(`
      ALTER TABLE "crawler_logs"
      DROP COLUMN IF EXISTS "contentId";
    `)

    // 回滚 analyzed_contents 扩展
    await queryRunner.query(`
      ALTER TABLE "analyzed_contents"
      DROP COLUMN IF EXISTS "complianceAnalysis";
    `)

    // 回滚 raw_contents 扩展
    await queryRunner.query(`
      ALTER TABLE "raw_contents"
      DROP COLUMN IF EXISTS "complianceData";
    `)
  }
}
