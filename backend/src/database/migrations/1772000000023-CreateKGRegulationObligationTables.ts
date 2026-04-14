import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGRegulationObligationTables1772000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRegulationObligations = await queryRunner.hasTable('regulation_obligations')

    if (!hasRegulationObligations) {
      await queryRunner.query(`
        CREATE TABLE "regulation_obligations" (
          "obligation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clause_id" uuid NOT NULL REFERENCES "regulation_clauses"("clause_id") ON DELETE RESTRICT,
          "obligation_code" varchar(50) NOT NULL,
          "obligation_text" text NOT NULL,
          "obligation_type" varchar(30) NOT NULL DEFAULT 'MANDATORY'
            CHECK ("obligation_type" IN ('MANDATORY', 'PROHIBITIVE', 'RECOMMENDED')),
          "applicable_sector" varchar(50)[] NOT NULL DEFAULT '{}'
            CHECK (
              "applicable_sector" <@ ARRAY['银行', '证券', '保险', '基金', '期货', '通用']::varchar[]
            ),
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
            CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_regulation_obligations_obligation_code" UNIQUE ("obligation_code")
        )
      `)
    }

    const hasObligationControlMaps = await queryRunner.hasTable('obligation_control_maps')

    if (!hasObligationControlMaps) {
      await queryRunner.query(`
        CREATE TABLE "obligation_control_maps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "obligation_id" uuid NOT NULL REFERENCES "regulation_obligations"("obligation_id") ON DELETE RESTRICT,
          "control_id" uuid NOT NULL REFERENCES "control_points"("control_id") ON DELETE RESTRICT,
          "coverage" varchar(20) NOT NULL DEFAULT 'FULL'
            CHECK ("coverage" IN ('FULL', 'PARTIAL')),
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_ocm_obligation_id_control_id" UNIQUE ("obligation_id", "control_id")
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_obligations_clause"
      ON "regulation_obligations" ("clause_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_obligations_type"
      ON "regulation_obligations" ("obligation_type")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_obligations_status"
      ON "regulation_obligations" ("status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ocm_obligation"
      ON "obligation_control_maps" ("obligation_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ocm_control"
      ON "obligation_control_maps" ("control_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasObligationControlMaps = await queryRunner.hasTable('obligation_control_maps')

    if (hasObligationControlMaps) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_ocm_control"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_ocm_obligation"`)
      await queryRunner.query(`DROP TABLE "obligation_control_maps"`)
    }

    const hasRegulationObligations = await queryRunner.hasTable('regulation_obligations')

    if (hasRegulationObligations) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_obligations_status"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_obligations_type"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_obligations_clause"`)
      await queryRunner.query(`DROP TABLE "regulation_obligations"`)
    }
  }
}
