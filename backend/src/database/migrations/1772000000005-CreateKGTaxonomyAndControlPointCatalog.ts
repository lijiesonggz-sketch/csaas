import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGTaxonomyAndControlPointCatalog1772000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTaxonomyL1 = await queryRunner.hasTable('taxonomy_l1')

    if (!hasTaxonomyL1) {
      await queryRunner.query(`
        CREATE TABLE "taxonomy_l1" (
          "l1_code" varchar(20) PRIMARY KEY,
          "l1_name" varchar(200) NOT NULL,
          "sort_order" int NOT NULL DEFAULT 0,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW()
        )
      `)
    }

    const hasTaxonomyL2 = await queryRunner.hasTable('taxonomy_l2')

    if (!hasTaxonomyL2) {
      await queryRunner.query(`
        CREATE TABLE "taxonomy_l2" (
          "l2_code" varchar(20) PRIMARY KEY,
          "l1_code" varchar(20) NOT NULL REFERENCES "taxonomy_l1"("l1_code"),
          "l2_name" varchar(200) NOT NULL,
          "l2_desc" text,
          "sort_order" int NOT NULL DEFAULT 0,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW()
        )
      `)
    }

    const hasControlPoints = await queryRunner.hasTable('control_points')

    if (!hasControlPoints) {
      await queryRunner.query(`
        CREATE TABLE "control_points" (
          "control_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "control_code" varchar(100) NOT NULL,
          "control_name" varchar(300) NOT NULL,
          "control_desc" text,
          "l1_code" varchar(20) NOT NULL REFERENCES "taxonomy_l1"("l1_code"),
          "l2_code" varchar(20) NOT NULL REFERENCES "taxonomy_l2"("l2_code"),
          "control_family" varchar(100) NOT NULL,
          "control_type" varchar(50) NOT NULL,
          "mandatory_default" boolean NOT NULL DEFAULT false,
          "risk_level_default" varchar(20) NOT NULL DEFAULT 'MEDIUM',
          "owner_role_hint" jsonb,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_control_points_control_code" UNIQUE ("control_code")
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_control_points_l1"
      ON "control_points" ("l1_code")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_control_points_l2"
      ON "control_points" ("l2_code")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_control_points_family"
      ON "control_points" ("control_family")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasControlPoints = await queryRunner.hasTable('control_points')

    if (hasControlPoints) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_control_points_family"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_control_points_l2"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_control_points_l1"`)
      await queryRunner.query(`DROP TABLE "control_points"`)
    }

    const hasTaxonomyL2 = await queryRunner.hasTable('taxonomy_l2')

    if (hasTaxonomyL2) {
      await queryRunner.query(`DROP TABLE "taxonomy_l2"`)
    }

    const hasTaxonomyL1 = await queryRunner.hasTable('taxonomy_l1')

    if (hasTaxonomyL1) {
      await queryRunner.query(`DROP TABLE "taxonomy_l1"`)
    }
  }
}
