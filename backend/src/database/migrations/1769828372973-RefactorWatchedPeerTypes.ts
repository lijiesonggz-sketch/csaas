import { MigrationInterface, QueryRunner } from 'typeorm'

export class RefactorWatchedPeerTypes1769828372973 implements MigrationInterface {
  name = 'RefactorWatchedPeerTypes1769828372973'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('watched_peers')) {
      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ADD COLUMN IF NOT EXISTS "industry" VARCHAR(50)
      `)

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ADD COLUMN IF NOT EXISTS "institution_type" VARCHAR(100)
      `)

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ADD COLUMN IF NOT EXISTS "description" TEXT
      `)

      if (await queryRunner.hasColumn('watched_peers', 'peerType')) {
        await queryRunner.query(`
          UPDATE "watched_peers"
          SET
            "industry" = COALESCE("industry", 'banking'),
            "institution_type" = COALESCE(
              "institution_type",
              CASE
                WHEN "peerType"::text = 'competitor' THEN 'competitor'
                ELSE 'benchmark'
              END
            )
          WHERE "industry" IS NULL OR "institution_type" IS NULL
        `)
      } else {
        await queryRunner.query(`
          UPDATE "watched_peers"
          SET
            "industry" = COALESCE("industry", 'banking'),
            "institution_type" = COALESCE("institution_type", 'benchmark')
          WHERE "industry" IS NULL OR "institution_type" IS NULL
        `)
      }

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ALTER COLUMN "industry" SET NOT NULL
      `)

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ALTER COLUMN "institution_type" SET NOT NULL
      `)

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        DROP COLUMN IF EXISTS "peerType"
      `)

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_watched_peers_industry" ON "watched_peers" ("industry")
      `)
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'watched_peer_peer_type_enum'
            AND n.nspname = 'public'
        ) THEN
          DROP TYPE "watched_peer_peer_type_enum";
        END IF;
      END $$;
    `)

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        ADD COLUMN IF NOT EXISTS "industry" VARCHAR(50)
      `)

      await queryRunner.query(`
        COMMENT ON COLUMN "organizations"."industry" IS 'Organization industry: banking/securities/insurance/enterprise'
      `)

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_organizations_industry" ON "organizations" ("industry")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_industry"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_watched_peers_industry"`)

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        DROP COLUMN IF EXISTS "industry"
      `)
    }

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

    if (await queryRunner.hasTable('watched_peers')) {
      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ADD COLUMN IF NOT EXISTS "peerType" "watched_peer_peer_type_enum" NOT NULL DEFAULT 'benchmark'
      `)

      if (await queryRunner.hasColumn('watched_peers', 'institution_type')) {
        await queryRunner.query(`
          UPDATE "watched_peers"
          SET "peerType" = CASE
            WHEN "institution_type" = 'competitor' THEN 'competitor'::watched_peer_peer_type_enum
            ELSE 'benchmark'::watched_peer_peer_type_enum
          END
        `)
      }

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        ALTER COLUMN "peerType" SET NOT NULL
      `)

      await queryRunner.query(`
        ALTER TABLE "watched_peers"
        DROP COLUMN IF EXISTS "institution_type",
        DROP COLUMN IF EXISTS "industry",
        DROP COLUMN IF EXISTS "description"
      `)
    }
  }
}
