import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * AddCrawlConfigToRadarSource Migration
 *
 * Story 8.1: 同业采集源管理
 *
 * 为 radar_sources 表添加 crawl_config JSONB 列
 * 用于存储同业采集源的选择器配置
 */
export class AddCrawlConfigToRadarSource1738900000000 implements MigrationInterface {
  name = 'AddCrawlConfigToRadarSource1738900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 crawl_config JSONB 列
    await queryRunner.query(`
      ALTER TABLE "radar_sources"
      ADD COLUMN IF NOT EXISTS "crawlConfig" jsonb
    `)

    // 为 crawlConfig 创建 GIN 索引以支持 JSONB 查询
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_radar_sources_crawl_config"
      ON "radar_sources" USING GIN ("crawlConfig")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_radar_sources_crawl_config"
    `)

    // 删除列
    await queryRunner.query(`
      ALTER TABLE "radar_sources"
      DROP COLUMN IF EXISTS "crawlConfig"
    `)
  }
}
