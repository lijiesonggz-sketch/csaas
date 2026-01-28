import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Create watched_peers table
 *
 * This migration creates the table for storing peer institutions that
 * organizations want to monitor for benchmarking in Radar Service.
 *
 * Story 1.4 - AC 5: 引导步骤3 - 关注同业机构
 */
export class CreateWatchedPeersTable1768700000002
  implements MigrationInterface
{
  name = 'CreateWatchedPeersTable1768700000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "watched_peers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "fk_watch_peers_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watch_peers_org" ON "watched_peers"("organization_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "watched_peers"`)
  }
}
