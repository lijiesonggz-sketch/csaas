import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Story 2.3 Code Review 修复: 添加RadarPush缺失的复合索引
 *
 * 问题1 (CRITICAL): AC 3推送调度查询需要复合索引
 * - 查询模式: WHERE status='scheduled' AND radarType='tech' AND scheduledAt <= now
 * - 新增索引: (radarType, status, scheduledAt)
 *
 * 问题2 (CRITICAL): AC 6去重查询需要复合索引
 * - 查询模式: WHERE organizationId=X AND contentId=Y AND scheduledAt=Z
 * - 新增索引: (organizationId, contentId, scheduledAt)
 *
 * 性能影响:
 * - 推送调度查询 (每周五17:00): 从O(n)优化到O(log n)
 * - 去重查询 (每次相关性计算): 从O(n)优化到O(log n)
 */
export class AddRadarPushCompositeIndexes1768900000001
  implements MigrationInterface
{
  name = 'AddRadarPushCompositeIndexes1768900000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 修复问题1: AC 3推送调度查询索引
    // 用于查询: SELECT * FROM radar_pushes
    //          WHERE radarType = 'tech'
    //            AND status = 'scheduled'
    //            AND scheduledAt <= NOW()
    //          ORDER BY priorityLevel DESC, relevanceScore DESC
    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_radar_status_scheduled"
      ON "radar_pushes" ("radarType", "status", "scheduledAt")
    `)

    // 修复问题2: AC 6去重查询索引
    // 用于查询: SELECT * FROM radar_pushes
    //          WHERE organizationId = $1
    //            AND contentId = $2
    //            AND scheduledAt = $3
    await queryRunner.query(`
      CREATE INDEX "idx_radar_pushes_org_content_scheduled"
      ON "radar_pushes" ("organizationId", "contentId", "scheduledAt")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚: 删除添加的复合索引
    await queryRunner.query(`
      DROP INDEX "idx_radar_pushes_org_content_scheduled"
    `)
    await queryRunner.query(`
      DROP INDEX "idx_radar_pushes_radar_status_scheduled"
    `)
  }
}
