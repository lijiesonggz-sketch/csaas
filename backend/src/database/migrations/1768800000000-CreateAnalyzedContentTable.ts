import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Story 2.2: 创建 AnalyzedContent 表和 content_tags 关联表
 *
 * AnalyzedContent: 存储 AI 分析后的结构化数据
 * - 标签提取、关键词提取、目标受众识别、AI 摘要生成
 * - ROI 分析（Story 2.4）
 * - 相关性评分（Story 2.3）
 *
 * content_tags: AnalyzedContent 和 Tag 的多对多关联表
 */
export class CreateAnalyzedContentTable1768800000000
  implements MigrationInterface
{
  name = 'CreateAnalyzedContentTable1768800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建分析状态枚举类型
    await queryRunner.query(`
      CREATE TYPE "analyzed_content_status_enum" AS ENUM ('pending', 'success', 'failed')
    `)

    // 2. 创建 analyzed_contents 表
    await queryRunner.query(`
      CREATE TABLE "analyzed_contents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contentId" uuid NOT NULL,
        "keywords" jsonb NOT NULL DEFAULT '[]',
        "categories" jsonb NOT NULL DEFAULT '[]',
        "targetAudience" varchar(200),
        "aiSummary" text,
        "roiAnalysis" jsonb,
        "relevanceScore" float,
        "aiModel" varchar(50) NOT NULL,
        "tokensUsed" int NOT NULL,
        "status" "analyzed_content_status_enum" NOT NULL DEFAULT 'pending',
        "errorMessage" text,
        "analyzedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_analyzed_contents_contentId" FOREIGN KEY ("contentId")
          REFERENCES "raw_contents"("id") ON DELETE CASCADE
      )
    `)

    // 3. 创建索引
    await queryRunner.query(`
      CREATE INDEX "idx_analyzed_contents_contentId" ON "analyzed_contents" ("contentId")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_analyzed_contents_status" ON "analyzed_contents" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_analyzed_contents_relevanceScore" ON "analyzed_contents" ("relevanceScore")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_analyzed_contents_analyzedAt" ON "analyzed_contents" ("analyzedAt")
    `)

    // 4. 创建 content_tags 关联表（AnalyzedContent 多对多 Tag）
    await queryRunner.query(`
      CREATE TABLE "content_tags" (
        "contentId" uuid NOT NULL,
        "tagId" uuid NOT NULL,
        CONSTRAINT "PK_content_tags" PRIMARY KEY ("contentId", "tagId"),
        CONSTRAINT "FK_content_tags_contentId" FOREIGN KEY ("contentId")
          REFERENCES "analyzed_contents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_tags_tagId" FOREIGN KEY ("tagId")
          REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `)

    // 5. 创建关联表索引
    await queryRunner.query(`
      CREATE INDEX "idx_content_tags_contentId" ON "content_tags" ("contentId")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_content_tags_tagId" ON "content_tags" ("tagId")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除关联表索引
    await queryRunner.query(`DROP INDEX "idx_content_tags_tagId"`)
    await queryRunner.query(`DROP INDEX "idx_content_tags_contentId"`)

    // 2. 删除关联表
    await queryRunner.query(`DROP TABLE "content_tags"`)

    // 3. 删除 analyzed_contents 表索引
    await queryRunner.query(`DROP INDEX "idx_analyzed_contents_analyzedAt"`)
    await queryRunner.query(`DROP INDEX "idx_analyzed_contents_relevanceScore"`)
    await queryRunner.query(`DROP INDEX "idx_analyzed_contents_status"`)
    await queryRunner.query(`DROP INDEX "idx_analyzed_contents_contentId"`)

    // 4. 删除 analyzed_contents 表
    await queryRunner.query(`DROP TABLE "analyzed_contents"`)

    // 5. 删除枚举类型
    await queryRunner.query(`DROP TYPE "analyzed_content_status_enum"`)
  }
}
