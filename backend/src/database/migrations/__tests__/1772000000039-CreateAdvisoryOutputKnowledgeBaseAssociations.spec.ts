import { CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039 } from '../1772000000039-CreateAdvisoryOutputKnowledgeBaseAssociations'

describe('CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039', () => {
  test('[P0][4.5-BE-001][AC1,AC2,AC3] creates tenant-scoped association state with retryable unique destination records', async () => {
    const migration = new CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039()
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "output_knowledge_base_associations"')
    expect(sql).toContain('"tenant_id" uuid NOT NULL')
    expect(sql).toContain('"actor_id" uuid NOT NULL')
    expect(sql).toContain('"output_id" uuid NOT NULL')
    expect(sql).toContain('"session_id" uuid NOT NULL')
    expect(sql).toContain('"destination_key" varchar(128) NOT NULL')
    expect(sql).toContain('"status" varchar(32) NOT NULL')
    expect(sql).toContain('"title" varchar(500) NOT NULL')
    expect(sql).toContain('"summary" text NOT NULL')
    expect(sql).toContain('"source_workflow" varchar(120) NOT NULL')
    expect(sql).toContain('"file_path" text NOT NULL')
    expect(sql).toContain('"ai_metadata" jsonb NOT NULL DEFAULT')
    expect(sql).toContain('"external_reference_id" varchar(255)')
    expect(sql).toContain('"retry_count" integer NOT NULL DEFAULT 0')
    expect(sql).toContain(
      "CONSTRAINT \"CHK_output_kb_associations_status\" CHECK (\"status\" IN ('associated', 'pending', 'failed'))",
    )
    expect(sql).toContain('CONSTRAINT "FK_output_kb_associations_output"')
    expect(sql).toContain('REFERENCES "workflow_outputs" ("id")')
    expect(sql).toContain('CONSTRAINT "FK_output_kb_associations_session"')
    expect(sql).toContain('REFERENCES "workflow_sessions" ("id")')
    expect(sql).toContain(
      'ON "output_knowledge_base_associations" ("tenant_id", "output_id", "destination_key")',
    )
  })

  test('[P0][4.5-BE-002][AC3] creates tenant lookup indexes and drops them on down', async () => {
    const migration = new CreateAdvisoryOutputKnowledgeBaseAssociations1772000000039()
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    }

    await migration.up(queryRunner as never)
    await migration.down(queryRunner as never)

    const sql = queryRunner.query.mock.calls.map((call: unknown[]) => call[0]).join('\n')

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_status"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_output"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_actor"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_tenant_updated"')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_output_kb_associations_ai_metadata_gin"')
    expect(sql).toContain('DROP INDEX IF EXISTS "idx_output_kb_associations_ai_metadata_gin"')
    expect(sql).toContain('DROP TABLE IF EXISTS "output_knowledge_base_associations"')
  })
})
