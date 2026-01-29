import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Story 3.2: 添加peerType字段到WatchedPeer表
 *
 * 新增字段:
 * - peerType: 同业类型(benchmark: 标杆机构, competitor: 竞争对手)
 */
export class AddPeerTypeToWatchedPeer1738310000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建peerType枚举类型
    await queryRunner.query(`
      CREATE TYPE "watched_peer_peer_type_enum" AS ENUM('benchmark', 'competitor')
    `)

    // 添加peerType列
    await queryRunner.query(`
      ALTER TABLE "watched_peers"
      ADD COLUMN "peerType" "watched_peer_peer_type_enum" NOT NULL DEFAULT 'benchmark'
    `)

    // 添加注释
    await queryRunner.query(`
      COMMENT ON COLUMN "watched_peers"."peerType" IS '同业类型: benchmark(标杆机构), competitor(竞争对手) - Story 3.2'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除peerType列
    await queryRunner.query(`
      ALTER TABLE "watched_peers"
      DROP COLUMN "peerType"
    `)

    // 删除枚举类型
    await queryRunner.query(`
      DROP TYPE "watched_peer_peer_type_enum"
    `)
  }
}
