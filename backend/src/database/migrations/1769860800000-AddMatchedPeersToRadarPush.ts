import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Story 5.2 Task 2.2: 添加 matched_peers 字段到 radar_pushes 表
 *
 * 目的：存储推送时匹配的关注同业机构列表
 * 字段类型：jsonb (存储字符串数组)
 * 可空：true (向后兼容，现有记录为null)
 *
 * 示例数据：
 * matched_peers: ["杭州银行", "招商银行"]
 */
export class AddMatchedPeersToRadarPush1769860800000 implements MigrationInterface {
  name = 'AddMatchedPeersToRadarPush1769860800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 matched_peers 字段 (jsonb类型，可空)
    await queryRunner.query(`
      ALTER TABLE "radar_pushes"
      ADD COLUMN "matched_peers" jsonb
    `)

    // 添加注释说明字段用途
    await queryRunner.query(`
      COMMENT ON COLUMN "radar_pushes"."matched_peers"
      IS '匹配的关注同业机构名称列表 (Story 5.2 Task 2.2)'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：删除 matched_peers 字段
    await queryRunner.query(`
      ALTER TABLE "radar_pushes"
      DROP COLUMN "matched_peers"
    `)
  }
}
