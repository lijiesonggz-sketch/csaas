import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPeerTypeToWatchedPeer1738310000001 implements MigrationInterface {
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
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'watched_peers'
        ) THEN
          ALTER TABLE "watched_peers"
          ADD COLUMN IF NOT EXISTS "peerType" "watched_peer_peer_type_enum" NOT NULL DEFAULT 'benchmark';
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'watched_peers'
            AND column_name = 'peerType'
        ) THEN
          COMMENT ON COLUMN "watched_peers"."peerType" IS 'Peer type: benchmark or competitor (Story 3.2)';
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'watched_peers'
            AND column_name = 'peerType'
        ) THEN
          ALTER TABLE "watched_peers" DROP COLUMN IF EXISTS "peerType";
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DROP TYPE IF EXISTS "watched_peer_peer_type_enum"
    `)
  }
}
