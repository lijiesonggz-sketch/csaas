import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008
  implements MigrationInterface
{
  name = 'CreateKGEvidenceTypesAndControlEvidenceMaps1772000000008'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const evidenceTypesExists = await queryRunner.hasTable('evidence_types')
    if (!evidenceTypesExists) {
      await queryRunner.query(`
        CREATE TABLE "evidence_types" (
          "evidence_id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "evidence_code" character varying(100) NOT NULL,
          "evidence_name" character varying(200) NOT NULL,
          "evidence_desc" text,
          "evidence_category" character varying(50),
          "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT "PK_evidence_types_evidence_id" PRIMARY KEY ("evidence_id"),
          CONSTRAINT "UQ_evidence_types_evidence_code" UNIQUE ("evidence_code")
        )
      `)
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "idx_evidence_types_category" ON "evidence_types" ("evidence_category")',
      )
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS "idx_evidence_types_status" ON "evidence_types" ("status")',
      )
    }

    const controlEvidenceMapsExists = await queryRunner.hasTable('control_evidence_maps')
    if (!controlEvidenceMapsExists) {
      await queryRunner.query(`
        CREATE TABLE "control_evidence_maps" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "control_id" uuid NOT NULL,
          "evidence_id" uuid NOT NULL,
          "required_level" character varying(20) NOT NULL DEFAULT 'RECOMMENDED',
          "notes" text,
          CONSTRAINT "PK_control_evidence_maps_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_control_evidence_maps_control_evidence" UNIQUE ("control_id", "evidence_id"),
          CONSTRAINT "FK_control_evidence_maps_control" FOREIGN KEY ("control_id") REFERENCES "control_points"("control_id") ON DELETE RESTRICT,
          CONSTRAINT "FK_control_evidence_maps_evidence" FOREIGN KEY ("evidence_id") REFERENCES "evidence_types"("evidence_id") ON DELETE RESTRICT
        )
      `)
    }

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_evidence_maps_control" ON "control_evidence_maps" ("control_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_evidence_maps_evidence" ON "control_evidence_maps" ("evidence_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_control_evidence_maps_required_level" ON "control_evidence_maps" ("required_level")',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const controlEvidenceMapsExists = await queryRunner.hasTable('control_evidence_maps')
    if (controlEvidenceMapsExists) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_control_evidence_maps_required_level"')
      await queryRunner.query('DROP INDEX IF EXISTS "idx_control_evidence_maps_evidence"')
      await queryRunner.query('DROP INDEX IF EXISTS "idx_control_evidence_maps_control"')
      await queryRunner.query('DROP TABLE "control_evidence_maps"')
    }

    const evidenceTypesExists = await queryRunner.hasTable('evidence_types')
    if (evidenceTypesExists) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_evidence_types_status"')
      await queryRunner.query('DROP INDEX IF EXISTS "idx_evidence_types_category"')
      await queryRunner.query('DROP TABLE "evidence_types"')
    }
  }
}
