import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGApplicabilityBaselineTables1772000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasControlPacks = await queryRunner.hasTable('control_packs')

    if (!hasControlPacks) {
      await queryRunner.query(`
        CREATE TABLE "control_packs" (
          "pack_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "pack_code" varchar(100) NOT NULL,
          "pack_name" varchar(200) NOT NULL,
          "pack_type" varchar(30) NOT NULL,
          "maturity_level" varchar(20) NOT NULL DEFAULT 'preview',
          "priority" int NOT NULL DEFAULT 100,
          "description" text,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_control_packs_pack_code" UNIQUE ("pack_code")
        )
      `)
    }

    const hasApplicabilityRules = await queryRunner.hasTable('applicability_rules')

    if (!hasApplicabilityRules) {
      await queryRunner.query(`
        CREATE TABLE "applicability_rules" (
          "rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "rule_code" varchar(100) NOT NULL,
          "target_type" varchar(30) NOT NULL,
          "target_id" uuid NOT NULL,
          "rule_type" varchar(20) NOT NULL,
          "predicate_json" jsonb NOT NULL,
          "result_json" jsonb,
          "priority" int NOT NULL DEFAULT 100,
          "effective_from" date,
          "effective_to" date,
          "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_applicability_rules_rule_code" UNIQUE ("rule_code")
        )
      `)
      await queryRunner.query(`
        CREATE INDEX "idx_applicability_rules_target"
        ON "applicability_rules" ("target_type", "target_id")
      `)
      await queryRunner.query(`
        CREATE INDEX "idx_applicability_rules_status"
        ON "applicability_rules" ("status", "priority")
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasApplicabilityRules = await queryRunner.hasTable('applicability_rules')

    if (hasApplicabilityRules) {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_applicability_rules_status"`)
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_applicability_rules_target"`)
      await queryRunner.query(`DROP TABLE "applicability_rules"`)
    }

    const hasControlPacks = await queryRunner.hasTable('control_packs')

    if (hasControlPacks) {
      await queryRunner.query(`DROP TABLE "control_packs"`)
    }
  }
}
