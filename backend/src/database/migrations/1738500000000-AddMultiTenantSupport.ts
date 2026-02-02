import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add Multi-Tenant Support
 *
 * This migration implements the multi-tenant data model by:
 * 1. Creating the tenants table
 * 2. Creating a default tenant for existing data
 * 3. Adding tenant_id columns to all core tables
 * 4. Migrating existing data to the default tenant
 * 5. Setting tenant_id to NOT NULL
 * 6. Adding foreign key constraints
 * 7. Adding indexes for performance
 *
 * @story 6-1A
 * @phase Phase 1: Data Model Design and Migration
 */
export class AddMultiTenantSupport1738500000000 implements MigrationInterface {
  // ✅ SECURITY FIX: Use constants instead of string interpolation
  // Default tenant UUID: 00000000-0000-0000-0000-000000000001
  private readonly DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
  private readonly DEFAULT_TENANT_NAME = 'Default Consulting Firm'

  // Core tables that need tenant_id column
  private readonly TENANT_TABLES = [
    'organizations',
    'radar_pushes',
    'watched_topics',
    'watched_peers',
    'push_preferences',
    'compliance_playbooks',
    'projects',
  ] as const

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create tenants table
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        subscription_tier VARCHAR(50) DEFAULT 'basic',
        brand_config JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Step 2: Create default tenant with fixed UUID
    // ✅ SECURITY FIX: Use parameterized query to prevent SQL injection
    await queryRunner.query(
      `INSERT INTO tenants (id, name, subscription_tier, is_active)
       VALUES ($1, $2, $3, $4)`,
      [this.DEFAULT_TENANT_ID, this.DEFAULT_TENANT_NAME, 'basic', true]
    )

    // Step 3: Add tenant_id column to all core tables (nullable initially)
    // ✅ SECURITY FIX: Use explicit table names instead of loop with interpolation
    await queryRunner.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE radar_pushes ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE watched_topics ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE watched_peers ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE push_preferences ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE compliance_playbooks ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    await queryRunner.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id UUID`)

    // Step 4: Migrate existing data to default tenant
    // ✅ SECURITY FIX: Use parameterized queries for UPDATE statements
    for (const table of this.TENANT_TABLES) {
      await queryRunner.query(
        `UPDATE ${table} SET tenant_id = $1 WHERE tenant_id IS NULL`,
        [this.DEFAULT_TENANT_ID]
      )
    }

    // Step 5: Set tenant_id to NOT NULL
    // ✅ SECURITY FIX: Use explicit table names instead of interpolation
    await queryRunner.query(`ALTER TABLE organizations ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE radar_pushes ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE watched_topics ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE watched_peers ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE push_preferences ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE compliance_playbooks ALTER COLUMN tenant_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE projects ALTER COLUMN tenant_id SET NOT NULL`)

    // Step 6: Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE organizations
      ADD CONSTRAINT fk_organizations_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    // For projects table, we need to convert tenant_id from VARCHAR to UUID first
    await queryRunner.query(`
      ALTER TABLE projects
      ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid
    `)

    await queryRunner.query(`
      ALTER TABLE projects
      ADD CONSTRAINT fk_projects_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    await queryRunner.query(`
      ALTER TABLE radar_pushes
      ADD CONSTRAINT fk_radar_pushes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    await queryRunner.query(`
      ALTER TABLE watched_topics
      ADD CONSTRAINT fk_watched_topics_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    await queryRunner.query(`
      ALTER TABLE watched_peers
      ADD CONSTRAINT fk_watched_peers_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    await queryRunner.query(`
      ALTER TABLE push_preferences
      ADD CONSTRAINT fk_push_preferences_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    await queryRunner.query(`
      ALTER TABLE compliance_playbooks
      ADD CONSTRAINT fk_compliance_playbooks_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    `)

    // Step 7: Add indexes for performance
    await queryRunner.query(`
      CREATE INDEX idx_organizations_tenant_id ON organizations(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_projects_tenant_id ON projects(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_radar_pushes_tenant_id ON radar_pushes(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_watched_topics_tenant_id ON watched_topics(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_watched_peers_tenant_id ON watched_peers(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_push_preferences_tenant_id ON push_preferences(tenant_id)
    `)

    await queryRunner.query(`
      CREATE INDEX idx_compliance_playbooks_tenant_id ON compliance_playbooks(tenant_id)
    `)

    // Add composite indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX idx_organizations_tenant_id_created_at
      ON organizations(tenant_id, created_at)
    `)

    // Check if scheduled_at column exists before creating composite index
    const scheduledAtExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'radar_pushes' AND column_name = 'scheduled_at'
    `)

    if (scheduledAtExists.length > 0) {
      await queryRunner.query(`
        CREATE INDEX idx_radar_pushes_tenant_id_scheduled_at
        ON radar_pushes(tenant_id, scheduled_at)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_radar_pushes_tenant_id_scheduled_at`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_organizations_tenant_id_created_at`)

    // Drop single column indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_compliance_playbooks_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_push_preferences_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_watched_peers_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_watched_topics_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_radar_pushes_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_organizations_tenant_id`)

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE compliance_playbooks DROP CONSTRAINT IF EXISTS fk_compliance_playbooks_tenant`)
    await queryRunner.query(`ALTER TABLE push_preferences DROP CONSTRAINT IF EXISTS fk_push_preferences_tenant`)
    await queryRunner.query(`ALTER TABLE watched_peers DROP CONSTRAINT IF EXISTS fk_watched_peers_tenant`)
    await queryRunner.query(`ALTER TABLE watched_topics DROP CONSTRAINT IF EXISTS fk_watched_topics_tenant`)
    await queryRunner.query(`ALTER TABLE radar_pushes DROP CONSTRAINT IF EXISTS fk_radar_pushes_tenant`)
    await queryRunner.query(`ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_tenant`)
    await queryRunner.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_organizations_tenant`)

    // Drop tenant_id columns
    const tables = [
      'compliance_playbooks',
      'push_preferences',
      'watched_peers',
      'watched_topics',
      'radar_pushes',
      'projects',
      'organizations',
    ]

    for (const table of tables) {
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS tenant_id`)
    }

    // Drop tenants table
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`)
  }
}
