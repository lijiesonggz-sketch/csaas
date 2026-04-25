import { CreateKgTaxonomyDomainRolloutPolicies1772000000025 } from '../1772000000025-CreateKgTaxonomyDomainRolloutPolicies'

describe('CreateKgTaxonomyDomainRolloutPolicies1772000000025', () => {
  let migration: CreateKgTaxonomyDomainRolloutPolicies1772000000025

  beforeEach(() => {
    migration = new CreateKgTaxonomyDomainRolloutPolicies1772000000025()
  })

  it('should create the rollout policy table with required control-plane columns', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('CREATE TABLE "kg_taxonomy_domain_rollout_policies"')
    expect(sql).toContain('"rollout_state" varchar(30) NOT NULL')
    expect(sql).toContain('"allow_legacy_fallback" boolean NOT NULL DEFAULT TRUE')
    expect(sql).toContain('"cutover_thresholds_json" jsonb')
    expect(sql).toContain('"retirement_thresholds_json" jsonb')
    expect(sql).toContain('"kill_switch_enabled" boolean NOT NULL DEFAULT FALSE')
    expect(sql).toContain('"active_classifier_version" varchar(50)')
    expect(sql).toContain('"rollback_approver" varchar(100)')
  })

  it('should seed bootstrap policies for IT01-IT08', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain(`'IT01'`)
    expect(sql).toContain(`'IT04'`)
    expect(sql).toContain(`'IT07'`)
    expect(sql).toContain(`'it04-on-new-interface'`)
    expect(sql).toContain(`'domain-compare'`)
    expect(sql).toContain(`ON CONFLICT ("l1_code") DO NOTHING`)
  })

  it('should drop indexes and table on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { l1_code: 'IT01' },
          { l1_code: 'IT04' },
          { l1_code: 'IT07' },
        ])
        .mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('DELETE FROM "kg_taxonomy_domain_rollout_policies"')
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "idx_kg_taxonomy_domain_rollout_policies_kill_switch"',
    )
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "idx_kg_taxonomy_domain_rollout_policies_state"',
    )
    expect(sql).toContain('DROP TABLE "kg_taxonomy_domain_rollout_policies"')
  })

  it('should keep the table when non-bootstrap policies already exist', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ l1_code: 'IT01' }, { l1_code: 'IT09' }])
        .mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('DELETE FROM "kg_taxonomy_domain_rollout_policies"')
    expect(sql).not.toContain('DROP TABLE "kg_taxonomy_domain_rollout_policies"')
  })
})
