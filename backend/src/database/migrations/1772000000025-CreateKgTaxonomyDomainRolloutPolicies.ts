import { MigrationInterface, QueryRunner } from 'typeorm'

const DEFAULT_CUTOVER_THRESHOLDS = {
  canaryPercentage: 10,
  errorBudget: 0.02,
  benchmarkGate: 'cutover',
  rollbackPath: 'Enable kill switch and revert rollout state to legacy-primary',
}

const DEFAULT_RETIREMENT_THRESHOLDS = {
  fallbackRateMax: 0.05,
  unknownRateMax: 0.03,
  manualCorrectionRateMax: 0.1,
  rollbackPath: 'Enable kill switch and revert rollout state to domain-primary',
}

function escapeJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/'/g, "''")
}

export class CreateKgTaxonomyDomainRolloutPolicies1772000000025
  implements MigrationInterface
{
  private readonly bootstrapL1Codes = [
    'IT01',
    'IT02',
    'IT03',
    'IT04',
    'IT05',
    'IT06',
    'IT07',
    'IT08',
  ] as const

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPolicyTable = await queryRunner.hasTable(
      'kg_taxonomy_domain_rollout_policies',
    )

    if (!hasPolicyTable) {
      await queryRunner.query(`
        CREATE TABLE "kg_taxonomy_domain_rollout_policies" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "l1_code" varchar(20) NOT NULL UNIQUE,
          "rollout_state" varchar(30) NOT NULL,
          "allow_legacy_fallback" boolean NOT NULL DEFAULT TRUE,
          "primary_threshold" numeric(5,4) NOT NULL DEFAULT 0.7000,
          "shadow_window_days" int NOT NULL DEFAULT 14,
          "cutover_thresholds_json" jsonb,
          "retirement_thresholds_json" jsonb,
          "kill_switch_enabled" boolean NOT NULL DEFAULT FALSE,
          "active_classifier_version" varchar(50),
          "mapping_owner" varchar(100),
          "rulebook_owner" varchar(100),
          "benchmark_owner" varchar(100),
          "gate_approver" varchar(100),
          "rollback_approver" varchar(100),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_by" uuid
        )
      `)
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kg_taxonomy_domain_rollout_policies_state"
      ON "kg_taxonomy_domain_rollout_policies" ("rollout_state")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kg_taxonomy_domain_rollout_policies_kill_switch"
      ON "kg_taxonomy_domain_rollout_policies" ("kill_switch_enabled")
    `)

    const defaultPolicies = [
      { l1Code: 'IT01', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
      { l1Code: 'IT02', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
      { l1Code: 'IT03', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
      { l1Code: 'IT04', rolloutState: 'it04-on-new-interface', allowLegacyFallback: true, primaryThreshold: 0.70 },
      { l1Code: 'IT05', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
      { l1Code: 'IT06', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
      { l1Code: 'IT07', rolloutState: 'domain-compare', allowLegacyFallback: true, primaryThreshold: 0.78 },
      { l1Code: 'IT08', rolloutState: 'legacy-primary', allowLegacyFallback: true, primaryThreshold: 0.72 },
    ]

    for (const policy of defaultPolicies) {
      await queryRunner.query(`
        INSERT INTO "kg_taxonomy_domain_rollout_policies" (
          "l1_code",
          "rollout_state",
          "allow_legacy_fallback",
          "primary_threshold",
          "shadow_window_days",
          "cutover_thresholds_json",
          "retirement_thresholds_json",
          "kill_switch_enabled",
          "active_classifier_version",
          "mapping_owner",
          "rulebook_owner",
          "benchmark_owner",
          "gate_approver",
          "rollback_approver"
        )
        VALUES (
          '${policy.l1Code}',
          '${policy.rolloutState}',
          ${policy.allowLegacyFallback ? 'TRUE' : 'FALSE'},
          ${policy.primaryThreshold.toFixed(4)},
          14,
          '${escapeJson(DEFAULT_CUTOVER_THRESHOLDS)}'::jsonb,
          '${escapeJson(DEFAULT_RETIREMENT_THRESHOLDS)}'::jsonb,
          FALSE,
          'taxonomy-classifier-6.3',
          'unassigned',
          'unassigned',
          'unassigned',
          'unassigned',
          'unassigned'
        )
        ON CONFLICT ("l1_code") DO NOTHING
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPolicyTable = await queryRunner.hasTable(
      'kg_taxonomy_domain_rollout_policies',
    )

    if (hasPolicyTable) {
      const existingRows = await queryRunner.query(
        `SELECT "l1_code" FROM "kg_taxonomy_domain_rollout_policies"`,
      )

      await queryRunner.query(`
        DELETE FROM "kg_taxonomy_domain_rollout_policies"
        WHERE "l1_code" IN ('${this.bootstrapL1Codes.join(`','`)}')
      `)

      const containsOnlyBootstrapRows =
        Array.isArray(existingRows) &&
        existingRows.length > 0 &&
        existingRows.every((row) =>
          this.bootstrapL1Codes.includes(row.l1_code as (typeof this.bootstrapL1Codes)[number]),
        )

      if (containsOnlyBootstrapRows) {
        await queryRunner.query(
          `DROP INDEX IF EXISTS "idx_kg_taxonomy_domain_rollout_policies_kill_switch"`,
        )
        await queryRunner.query(
          `DROP INDEX IF EXISTS "idx_kg_taxonomy_domain_rollout_policies_state"`,
        )
        await queryRunner.query(`DROP TABLE "kg_taxonomy_domain_rollout_policies"`)
      }
    }
  }
}
