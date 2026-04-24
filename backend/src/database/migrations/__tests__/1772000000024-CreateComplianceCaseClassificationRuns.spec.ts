import { CreateComplianceCaseClassificationRuns1772000000024 } from '../1772000000024-CreateComplianceCaseClassificationRuns'

describe('CreateComplianceCaseClassificationRuns1772000000024', () => {
  let migration: CreateComplianceCaseClassificationRuns1772000000024

  beforeEach(() => {
    migration = new CreateComplianceCaseClassificationRuns1772000000024()
  })

  it('should add latest snapshot telemetry columns to compliance_cases', async () => {
    const queryRunner = {
      hasColumn: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('ADD COLUMN "classification_source" varchar(30)')
    expect(sql).toContain('ADD COLUMN "classification_version" varchar(50)')
    expect(sql).toContain('ADD COLUMN "fallback_reason" varchar(50)')
  })

  it('should create compliance_case_classification_runs with append-only fields and latest pointer indexes', async () => {
    const queryRunner = {
      hasColumn: jest.fn().mockResolvedValue(true),
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('CREATE TABLE "compliance_case_classification_runs"')
    expect(sql).toContain('"classifier_version" varchar(50) NOT NULL')
    expect(sql).toContain('"decision_trace_json" jsonb')
    expect(sql).toContain('"path_decision" varchar(30) NOT NULL')
    expect(sql).toContain('"classification_status" varchar(30) NOT NULL')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_cccr_latest"')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_cccr_latest_true"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_cccr_versions"')
  })

  it('should drop indexes and table on down without deleting possibly pre-existing snapshot columns', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_cccr_batch"')
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_cccr_latest_true"')
    expect(sql).toContain('DROP TABLE "compliance_case_classification_runs"')
    expect(sql).not.toContain('DROP COLUMN "fallback_reason"')
    expect(sql).not.toContain('DROP COLUMN "classification_version"')
    expect(sql).not.toContain('DROP COLUMN "classification_source"')
  })
})
