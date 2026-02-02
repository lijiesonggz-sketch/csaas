import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Story 2.3: 创建 RadarPush 和 PushLog 表
 *
 * RadarPush: 推送记录表
 * - 存储推送记录（技术雷达、行业雷达、合规雷达）
 * - 支持推送调度（每周五17:00技术雷达，每周三17:00行业雷达，每日9:00合规雷达）
 * - 跟踪推送状态（scheduled/sent/failed/cancelled）
 * - 记录相关性评分和优先级
 *
 * PushLog: 推送日志表
 * - 记录推送成功/失败日志
 * - 跟踪推送重试历史
 * - 记录详细错误信息用于问题排查
 * - 支持推送成功率统计（目标≥98%）
 */
export class CreateRadarPushAndPushLog1768900000000 implements MigrationInterface {
  name = 'CreateRadarPushAndPushLog1768900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建 radarType 枚举类型
    await queryRunner.query(`
      CREATE TYPE "radar_push_radar_type_enum" AS ENUM ('tech', 'industry', 'compliance')
    `)

    // 2. 创建 priorityLevel 枚举类型
    await queryRunner.query(`
      CREATE TYPE "radar_push_priority_level_enum" AS ENUM ('high', 'medium', 'low')
    `)

    // 3. 创建 status 枚举类型
    await queryRunner.query(`
      CREATE TYPE "radar_push_status_enum" AS ENUM ('scheduled', 'sent', 'failed', 'cancelled')
    `)

    // 4. 创建 radar_pushes 表
    await queryRunner.query(`
      CREATE TABLE "radar_pushes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "radarType" "radar_push_radar_type_enum" NOT NULL,
        "contentId" uuid NOT NULL,
        "relevanceScore" decimal(3,2) NOT NULL,
        "priorityLevel" "radar_push_priority_level_enum" NOT NULL,
        "scheduledAt" timestamp NOT NULL,
        "status" "radar_push_status_enum" NOT NULL DEFAULT 'scheduled',
        "sentAt" timestamp,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" timestamp,
        "isBookmarked" boolean NOT NULL DEFAULT false,
        "scheduleConfigId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_radar_pushes_organizationId" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_radar_pushes_contentId" FOREIGN KEY ("contentId")
          REFERENCES "analyzed_contents"("id") ON DELETE CASCADE
      )
    `)

    // 5. 创建 radar_pushes 表索引
    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_organizationId" ON "radar_pushes" ("organizationId")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_status" ON "radar_pushes" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_scheduledAt" ON "radar_pushes" ("scheduledAt")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_contentId" ON "radar_pushes" ("contentId")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_organization_radar_status" ON "radar_pushes" ("organizationId", "radarType", "status")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_scheduled_status" ON "radar_pushes" ("scheduledAt", "status")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_relevanceScore" ON "radar_pushes" ("relevanceScore")
    `)

    // 6. 创建 push_log_status_enum 枚举类型
    await queryRunner.query(`
      CREATE TYPE "push_log_status_enum" AS ENUM ('success', 'failed')
    `)

    // 7. 创建 push_logs 表
    await queryRunner.query(`
      CREATE TABLE "push_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "pushId" uuid NOT NULL,
        "status" "push_log_status_enum" NOT NULL,
        "errorMessage" text,
        "retryCount" int NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_push_logs_pushId" FOREIGN KEY ("pushId")
          REFERENCES "radar_pushes"("id") ON DELETE CASCADE
      )
    `)

    // 8. 创建 push_logs 表索引
    await queryRunner.query(`
      CREATE INDEX "idx_push_logs_pushId" ON "push_logs" ("pushId")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_push_logs_status" ON "push_logs" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_push_logs_createdAt" ON "push_logs" ("createdAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 push_logs 表索引
    await queryRunner.query(`DROP INDEX "idx_push_logs_createdAt"`)
    await queryRunner.query(`DROP INDEX "idx_push_logs_status"`)
    await queryRunner.query(`DROP INDEX "idx_push_logs_pushId"`)

    // 2. 删除 push_logs 表
    await queryRunner.query(`DROP TABLE "push_logs"`)

    // 3. 删除 push_log_status_enum 枚举类型
    await queryRunner.query(`DROP TYPE "push_log_status_enum"`)

    // 4. 删除 radar_pushes 表索引
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_relevanceScore"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_scheduled_status"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_organization_radar_status"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_contentId"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_scheduledAt"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_status"`)
    await queryRunner.query(`DROP INDEX "idx_radar_pushes_organizationId"`)

    // 5. 删除 radar_pushes 表
    await queryRunner.query(`DROP TABLE "radar_pushes"`)

    // 6. 删除枚举类型
    await queryRunner.query(`DROP TYPE "radar_push_status_enum"`)
    await queryRunner.query(`DROP TYPE "radar_push_priority_level_enum"`)
    await queryRunner.query(`DROP TYPE "radar_push_radar_type_enum"`)
  }
}
