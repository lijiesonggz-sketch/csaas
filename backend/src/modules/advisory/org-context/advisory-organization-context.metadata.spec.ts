import { APP_ENTITY_NAMES } from '../../../config/typeorm.entities'
import { CreateAdvisoryOrganizationContext1772000000036 } from '../../../database/migrations/1772000000036-CreateAdvisoryOrganizationContext'

describe('AdvisoryOrganizationContext metadata', () => {
  it('registers the tenant-scoped organization_context entity in APP_ENTITIES', () => {
    expect(APP_ENTITY_NAMES).toContain('AdvisoryOrganizationContext')
  })

  it('creates a separate organization_context table with tenant/context uniqueness and JSONB fields', async () => {
    const migration = new CreateAdvisoryOrganizationContext1772000000036()
    const queries: string[] = []
    const queryRunner = {
      query: jest.fn(async (query: string) => {
        queries.push(query)
      }),
    }

    await migration.up(queryRunner as never)

    const migrationSql = queries.join('\n')
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS "organization_context"')
    expect(migrationSql).toContain('"tenant_id" uuid NOT NULL')
    expect(migrationSql).toContain('"context_type" character varying(80) NOT NULL')
    expect(migrationSql).toContain('"context_data" jsonb NOT NULL')
    expect(migrationSql).toContain('"completeness_score" real NOT NULL')
    expect(migrationSql).toContain('"completeness_metadata" jsonb NOT NULL')
    expect(migrationSql).toContain('"idx_organization_context_tenant_id"')
    expect(migrationSql).toContain('"idx_organization_context_tenant_context"')
    expect(migrationSql).toContain('"idx_organization_context_context_data_gin"')
    expect(migrationSql).toContain('"idx_organization_context_completeness_metadata_gin"')
    expect(migrationSql).toContain('("tenant_id", "context_type")')
    expect(migrationSql).not.toContain('"organizations"')
    expect(migrationSql).not.toContain('"organization_profiles"')
  })
})
