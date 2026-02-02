import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * CreateRadarInfrastructure Migration
 *
 * Epic 2: 技术雷达 - 数据模型基础设施
 *
 * 创建7个新表：
 * 1. tags - 统一标签系统（技术、同业、合规等）
 * 2. watched_items - 用户关注项
 * 3. raw_contents - 原始内容
 * 4. analyzed_contents - AI分析结果
 * 5. content_tags - 内容与标签的多对多关系
 * 6. radar_pushes - 推送记录
 * 7. push_schedule_configs - 推送调度配置
 * 8. crawler_logs - 爬虫日志
 *
 * 设计特点：
 * - 统一标签系统：支持动态增长的标签
 * - 层级标签：支持父子标签关系
 * - 动态调度：支持cron表达式配置推送时间
 * - 组织级配置：支持全局和组织级配置覆盖
 */
export class CreateRadarInfrastructure1738000000000 implements MigrationInterface {
  name = 'CreateRadarInfrastructure1738000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建tags表
    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL UNIQUE,
        "tagType" varchar(20) NOT NULL CHECK ("tagType" IN ('tech', 'peer', 'compliance', 'vendor', 'custom')),
        "category" varchar(100),
        "parentTagId" uuid,
        "description" text,
        "aliases" jsonb,
        "metadata" jsonb,
        "usageCount" int NOT NULL DEFAULT 0,
        "watchCount" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "isVerified" boolean NOT NULL DEFAULT false,
        "isOfficial" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tags_parentTag" FOREIGN KEY ("parentTagId") REFERENCES "tags"("id") ON DELETE SET NULL
      )
    `)

    await queryRunner.query(`CREATE INDEX "IDX_tags_name" ON "tags" ("name")`)
    await queryRunner.query(`CREATE INDEX "IDX_tags_tagType" ON "tags" ("tagType")`)
    await queryRunner.query(`CREATE INDEX "IDX_tags_category" ON "tags" ("category", "tagType")`)
    await queryRunner.query(`CREATE INDEX "IDX_tags_parentTagId" ON "tags" ("parentTagId")`)
    await queryRunner.query(`CREATE INDEX "IDX_tags_usageCount" ON "tags" ("usageCount")`)
    await queryRunner.query(`CREATE INDEX "IDX_tags_watchCount" ON "tags" ("watchCount")`)

    // 2. 创建watched_items表
    await queryRunner.query(`
      CREATE TABLE "watched_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "tagId" uuid NOT NULL,
        "watchType" varchar(20) NOT NULL CHECK ("watchType" IN ('tech', 'peer', 'compliance', 'vendor', 'custom')),
        "weight" decimal(3,2) NOT NULL DEFAULT 1.0,
        "preferences" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_watched_items_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_watched_items_tag" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_watched_items_org_tag" UNIQUE ("organizationId", "tagId")
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_watched_items_organizationId" ON "watched_items" ("organizationId")`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_watched_items_tagId" ON "watched_items" ("tagId")`)
    await queryRunner.query(
      `CREATE INDEX "IDX_watched_items_watchType" ON "watched_items" ("watchType")`,
    )

    // 3. 创建raw_contents表
    await queryRunner.query(`
      CREATE TABLE "raw_contents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar(100) NOT NULL,
        "category" varchar(20) NOT NULL CHECK ("category" IN ('tech', 'industry', 'compliance')),
        "title" varchar(500) NOT NULL,
        "summary" text,
        "fullContent" text NOT NULL,
        "url" varchar(1000),
        "publishDate" timestamp,
        "author" varchar(200),
        "contentHash" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'analyzing', 'analyzed', 'failed')),
        "organizationId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_raw_contents_status_category" ON "raw_contents" ("status", "category")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_contents_contentHash" ON "raw_contents" ("contentHash")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_contents_organizationId" ON "raw_contents" ("organizationId", "category")`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_raw_contents_source" ON "raw_contents" ("source")`)

    // 4. 创建analyzed_contents表
    await queryRunner.query(`
      CREATE TABLE "analyzed_contents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contentId" uuid NOT NULL,
        "keywords" jsonb NOT NULL,
        "targetAudience" varchar(200),
        "aiSummary" text,
        "roiAnalysis" jsonb,
        "aiModel" varchar(50) NOT NULL,
        "tokensUsed" int NOT NULL,
        "analyzedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_analyzed_contents_rawContent" FOREIGN KEY ("contentId") REFERENCES "raw_contents"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_analyzed_contents_contentId" ON "analyzed_contents" ("contentId")`,
    )

    // 5. 创建content_tags关联表（多对多）
    await queryRunner.query(`
      CREATE TABLE "content_tags" (
        "contentId" uuid NOT NULL,
        "tagId" uuid NOT NULL,
        PRIMARY KEY ("contentId", "tagId"),
        CONSTRAINT "FK_content_tags_content" FOREIGN KEY ("contentId") REFERENCES "analyzed_contents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_tags_tag" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_content_tags_contentId" ON "content_tags" ("contentId")`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_content_tags_tagId" ON "content_tags" ("tagId")`)

    // 6. 创建push_schedule_configs表
    await queryRunner.query(`
      CREATE TABLE "push_schedule_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid,
        "radarType" varchar(20) NOT NULL CHECK ("radarType" IN ('tech', 'industry', 'compliance')),
        "cronExpression" varchar(100) NOT NULL,
        "timezone" varchar(50) DEFAULT 'Asia/Shanghai',
        "maxPushPerSchedule" int NOT NULL DEFAULT 5,
        "minRelevanceScore" decimal(3,2) NOT NULL DEFAULT 0.7,
        "preferences" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastExecutedAt" timestamp,
        "nextExecutionAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_push_schedule_configs_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_push_schedule_configs_org_type" UNIQUE ("organizationId", "radarType")
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_push_schedule_configs_organizationId" ON "push_schedule_configs" ("organizationId")`,
    )

    // 7. 创建radar_pushes表
    await queryRunner.query(`
      CREATE TABLE "radar_pushes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "radarType" varchar(20) NOT NULL CHECK ("radarType" IN ('tech', 'industry', 'compliance')),
        "contentId" uuid NOT NULL,
        "relevanceScore" decimal(3,2) NOT NULL,
        "priorityLevel" varchar(10) NOT NULL CHECK ("priorityLevel" IN ('high', 'medium', 'low')),
        "scheduledAt" timestamp NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'scheduled' CHECK ("status" IN ('scheduled', 'sent', 'failed', 'cancelled')),
        "sentAt" timestamp,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" timestamp,
        "isBookmarked" boolean NOT NULL DEFAULT false,
        "scheduleConfigId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_radar_pushes_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_radar_pushes_content" FOREIGN KEY ("contentId") REFERENCES "analyzed_contents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_radar_pushes_scheduleConfig" FOREIGN KEY ("scheduleConfigId") REFERENCES "push_schedule_configs"("id") ON DELETE SET NULL
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_radar_pushes_organizationId" ON "radar_pushes" ("organizationId")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_radar_pushes_org_type_status" ON "radar_pushes" ("organizationId", "radarType", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_radar_pushes_scheduled_status" ON "radar_pushes" ("scheduledAt", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_radar_pushes_relevanceScore" ON "radar_pushes" ("relevanceScore")`,
    )

    // 8. 创建crawler_logs表
    await queryRunner.query(`
      CREATE TABLE "crawler_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar(100) NOT NULL,
        "category" varchar(20) NOT NULL CHECK ("category" IN ('tech', 'industry', 'compliance')),
        "url" varchar(1000) NOT NULL,
        "status" varchar(10) NOT NULL CHECK ("status" IN ('success', 'failed')),
        "itemsCollected" int NOT NULL DEFAULT 0,
        "errorMessage" text,
        "retryCount" int NOT NULL DEFAULT 0,
        "executedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(
      `CREATE INDEX "IDX_crawler_logs_source_status" ON "crawler_logs" ("source", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crawler_logs_executedAt" ON "crawler_logs" ("executedAt")`,
    )

    // 9. 插入默认的推送调度配置（全局配置）
    await queryRunner.query(`
      INSERT INTO "push_schedule_configs" ("organizationId", "radarType", "cronExpression", "timezone", "maxPushPerSchedule", "minRelevanceScore", "isActive")
      VALUES
        (NULL, 'tech', '0 17 * * 5', 'Asia/Shanghai', 5, 0.7, true),
        (NULL, 'industry', '0 17 * * 3', 'Asia/Shanghai', 5, 0.7, true),
        (NULL, 'compliance', '0 9 * * *', 'Asia/Shanghai', 3, 0.8, true)
    `)

    // 10. 插入预设的官方标签
    await queryRunner.query(`
      INSERT INTO "tags" ("name", "tagType", "category", "description", "isOfficial", "isVerified")
      VALUES
        -- 技术标签
        ('云原生', 'tech', 'infrastructure', '云原生技术和架构', true, true),
        ('AI应用', 'tech', 'application', '人工智能应用和实践', true, true),
        ('移动金融安全', 'tech', 'security', '移动金融安全技术', true, true),
        ('成本优化', 'tech', 'finops', '成本优化和FinOps实践', true, true),
        ('DevOps', 'tech', 'infrastructure', 'DevOps实践和工具', true, true),
        ('微服务', 'tech', 'architecture', '微服务架构', true, true),
        ('数据安全', 'tech', 'security', '数据安全和隐私保护', true, true),
        ('区块链', 'tech', 'emerging', '区块链技术', true, true),
        -- 同业机构标签
        ('杭州银行', 'peer', 'city-bank', '杭州银行', true, true),
        ('绍兴银行', 'peer', 'city-bank', '绍兴银行', true, true),
        ('招商银行', 'peer', 'national-bank', '招商银行', true, true),
        ('宁波银行', 'peer', 'city-bank', '宁波银行', true, true),
        ('平安银行', 'peer', 'national-bank', '平安银行', true, true)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 按照依赖关系逆序删除表
    await queryRunner.query(`DROP TABLE IF EXISTS "crawler_logs"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "radar_pushes"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "push_schedule_configs"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "content_tags"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "analyzed_contents"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "raw_contents"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "watched_items"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "tags"`)
  }
}
