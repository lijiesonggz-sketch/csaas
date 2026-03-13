import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Create watched_peers table
 *
 * This migration creates the table for storing peer institutions that
 * organizations want to monitor for benchmarking in Radar Service.
 *
 * Story 1.4 - AC 5: 引导步骤3 - 关注同业机构
 */
export class CreateWatchedPeersTable1768700000002 implements MigrationInterface {
  name = 'CreateWatchedPeersTable1768700000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'watched_peer_peer_type_enum'
            AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "watched_peer_peer_type_enum" AS ENUM('benchmark', 'competitor');
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      CREATE TABLE "watched_peers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "peerType" "watched_peer_peer_type_enum" NOT NULL DEFAULT 'benchmark',
        "organization_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp,
        CONSTRAINT "fk_watch_peers_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_watched_peers_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watch_peers_org" ON "watched_peers"("organization_id")
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_watched_peers_tenant_id" ON "watched_peers"("tenant_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_watched_peers_tenant_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_watch_peers_org"`)
    await queryRunner.query(`DROP TABLE "watched_peers"`)
  }
}
