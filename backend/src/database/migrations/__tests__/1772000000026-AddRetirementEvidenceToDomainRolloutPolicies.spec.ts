import { AddRetirementEvidenceToDomainRolloutPolicies1772000000026 } from '../1772000000026-AddRetirementEvidenceToDomainRolloutPolicies'

describe('AddRetirementEvidenceToDomainRolloutPolicies1772000000026', () => {
  let migration: AddRetirementEvidenceToDomainRolloutPolicies1772000000026

  beforeEach(() => {
    migration = new AddRetirementEvidenceToDomainRolloutPolicies1772000000026()
  })

  it('should add state-changed and retirement-evidence columns to rollout policy table', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls
      .map((call: unknown[]) => call[0])
      .join('\n')

    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS "state_changed_at" timestamp NOT NULL DEFAULT NOW()',
    )
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS "retirement_evidence_json" jsonb',
    )
    expect(sql).toContain(
      'COALESCE("retirement_evidence_json", \'{}\'::jsonb)',
    )
  })

  it('should drop the new columns on down', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls
      .map((call: unknown[]) => call[0])
      .join('\n')

    expect(sql).toContain(
      'DROP COLUMN IF EXISTS "retirement_evidence_json"',
    )
    expect(sql).toContain('DROP COLUMN IF EXISTS "state_changed_at"')
  })
})
