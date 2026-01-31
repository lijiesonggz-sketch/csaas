import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorWatchedPeerTypes1769828372973 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add new columns to watched_peers table (including description)
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            ADD COLUMN "industry" VARCHAR(50),
            ADD COLUMN "institution_type" VARCHAR(100),
            ADD COLUMN "description" TEXT
        `);

        // 2. Migrate existing data from peerType to new fields
        // Note: peerType is an enum with values 'benchmark' or 'competitor'
        await queryRunner.query(`
            UPDATE "watched_peers"
            SET
                "industry" = 'banking',
                "institution_type" = CASE
                    WHEN "peerType"::text = 'benchmark' THEN '标杆机构'
                    WHEN "peerType"::text = 'competitor' THEN '竞争对手'
                    ELSE '标杆机构'
                END
        `);

        // 3. Set NOT NULL constraints on new columns
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            ALTER COLUMN "industry" SET NOT NULL,
            ALTER COLUMN "institution_type" SET NOT NULL
        `);

        // 4. Drop old peerType column and its enum type
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            DROP COLUMN "peerType"
        `);

        await queryRunner.query(`
            DROP TYPE IF EXISTS "watched_peer_peer_type_enum"
        `);

        // 5. Create index on industry column for query optimization
        await queryRunner.query(`
            CREATE INDEX "idx_watched_peers_industry" ON "watched_peers" ("industry")
        `);

        // 6. Add optional industry column to organizations table
        await queryRunner.query(`
            ALTER TABLE "organizations"
            ADD COLUMN "industry" VARCHAR(50)
        `);

        // 7. Add comment to organizations.industry column
        await queryRunner.query(`
            COMMENT ON COLUMN "organizations"."industry" IS '组织所属行业: banking/securities/insurance/enterprise'
        `);

        // 8. Create index on organizations.industry column
        await queryRunner.query(`
            CREATE INDEX "idx_organizations_industry" ON "organizations" ("industry")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_organizations_industry"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_watched_peers_industry"`);

        // 2. Remove industry column from organizations
        await queryRunner.query(`
            ALTER TABLE "organizations"
            DROP COLUMN IF EXISTS "industry"
        `);

        // 3. Recreate enum type
        await queryRunner.query(`
            CREATE TYPE "watched_peer_peer_type_enum" AS ENUM('benchmark', 'competitor')
        `);

        // 4. Add back peerType column to watched_peers
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            ADD COLUMN "peerType" "watched_peer_peer_type_enum"
        `);

        // 5. Migrate data back from new fields to peerType
        await queryRunner.query(`
            UPDATE "watched_peers"
            SET "peerType" = CASE
                WHEN "institution_type" = '城商行' THEN 'benchmark'::watched_peer_peer_type_enum
                WHEN "institution_type" = '股份制银行' THEN 'benchmark'::watched_peer_peer_type_enum
                WHEN "institution_type" = '互联网银行' THEN 'benchmark'::watched_peer_peer_type_enum
                ELSE 'benchmark'::watched_peer_peer_type_enum
            END
        `);

        // 6. Set NOT NULL constraint on peerType
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            ALTER COLUMN "peerType" SET NOT NULL
        `);

        // 7. Drop new columns
        await queryRunner.query(`
            ALTER TABLE "watched_peers"
            DROP COLUMN "institution_type",
            DROP COLUMN "industry",
            DROP COLUMN "description"
        `);
    }

}
