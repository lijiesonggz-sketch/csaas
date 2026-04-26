import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRetirementEvidenceToDomainRolloutPolicies1772000000026
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPolicyTable = await queryRunner.hasTable(
      'kg_taxonomy_domain_rollout_policies',
    )

    if (!hasPolicyTable) {
      return
    }

    await queryRunner.query(`
      ALTER TABLE "kg_taxonomy_domain_rollout_policies"
      ADD COLUMN IF NOT EXISTS "state_changed_at" timestamp
    `)
    await queryRunner.query(`
      UPDATE "kg_taxonomy_domain_rollout_policies"
      SET "state_changed_at" = COALESCE("updated_at", NOW())
      WHERE "state_changed_at" IS NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "kg_taxonomy_domain_rollout_policies"
      ALTER COLUMN "state_changed_at" SET NOT NULL,
      ALTER COLUMN "state_changed_at" SET DEFAULT NOW()
    `)
    await queryRunner.query(`
      ALTER TABLE "kg_taxonomy_domain_rollout_policies"
      ADD COLUMN IF NOT EXISTS "retirement_evidence_json" jsonb
    `)
    await queryRunner.query(`
      UPDATE "kg_taxonomy_domain_rollout_policies"
      SET "retirement_evidence_json" = COALESCE("retirement_evidence_json", '{}'::jsonb)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPolicyTable = await queryRunner.hasTable(
      'kg_taxonomy_domain_rollout_policies',
    )

    if (!hasPolicyTable) {
      return
    }

    await queryRunner.query(`
      ALTER TABLE "kg_taxonomy_domain_rollout_policies"
      DROP COLUMN IF EXISTS "retirement_evidence_json"
    `)
    await queryRunner.query(`
      ALTER TABLE "kg_taxonomy_domain_rollout_policies"
      DROP COLUMN IF EXISTS "state_changed_at"
    `)
  }
}
