import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * CreateRadarSourcesTable Migration
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 创建 radar_sources 表，用于动态管理雷达信息源配置
 * 替代硬编码的配置文件，支持通过管理界面动态管理
 *
 * 表结构：
 * - 支持三种雷达类型：tech（技术）、industry（行业）、compliance（合规）
 * - 支持四种内容类型：wechat（微信公众号）、recruitment（招聘）、conference（会议）、website（网站）
 * - 支持启用/禁用控制
 * - 支持自定义爬取频率（cron表达式）
 * - 记录最后爬取状态和错误信息
 */
export class CreateRadarSourcesTable1738200000000 implements MigrationInterface {
  name = 'CreateRadarSourcesTable1738200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 radar_sources 表
    await queryRunner.query(`
      CREATE TABLE "radar_sources" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar(255) NOT NULL,
        "category" varchar(20) NOT NULL CHECK ("category" IN ('tech', 'industry', 'compliance')),
        "url" varchar(1000) NOT NULL,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('wechat', 'recruitment', 'conference', 'website')),
        "peerName" varchar(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "crawlSchedule" varchar(100) NOT NULL DEFAULT '0 3 * * *',
        "lastCrawledAt" timestamp,
        "lastCrawlStatus" varchar(20) NOT NULL DEFAULT 'pending' CHECK ("lastCrawlStatus" IN ('pending', 'success', 'failed')),
        "lastCrawlError" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    // 创建索引
    await queryRunner.query(
      `CREATE INDEX "idx_radar_sources_category" ON "radar_sources" ("category")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_radar_sources_is_active" ON "radar_sources" ("isActive")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_radar_sources_category_active" ON "radar_sources" ("category", "isActive")`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_radar_sources_last_crawl_status" ON "radar_sources" ("lastCrawlStatus")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "radar_sources"`)
  }
}
