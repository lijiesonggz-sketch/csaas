import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMultiTenantSupport1738500000000 implements MigrationInterface {
  private readonly DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
  private readonly DEFAULT_TENANT_NAME = 'Default Consulting Firm'

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
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        subscription_tier VARCHAR(50) DEFAULT 'basic',
        brand_config JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await queryRunner.query(
      `
      INSERT INTO tenants (id, name, subscription_tier, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
      `,
      [this.DEFAULT_TENANT_ID, this.DEFAULT_TENANT_NAME, 'basic', true]
    )

    for (const table of this.TENANT_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id UUID`)
    }

    for (const table of this.TENANT_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }
      await queryRunner.query(`UPDATE ${table} SET tenant_id = $1 WHERE tenant_id IS NULL`, [
        this.DEFAULT_TENANT_ID,
      ])
    }

    for (const table of this.TENANT_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN tenant_id SET NOT NULL`)
    }

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`
        ALTER TABLE organizations
        ADD CONSTRAINT fk_organizations_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('projects')) {
      await queryRunner.query(`
        ALTER TABLE projects
        ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid
      `)
      await queryRunner.query(`
        ALTER TABLE projects
        ADD CONSTRAINT fk_projects_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`
        ALTER TABLE radar_pushes
        ADD CONSTRAINT fk_radar_pushes_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('watched_topics')) {
      await queryRunner.query(`
        ALTER TABLE watched_topics
        ADD CONSTRAINT fk_watched_topics_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('watched_peers')) {
      await queryRunner.query(`
        ALTER TABLE watched_peers
        ADD CONSTRAINT fk_watched_peers_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('push_preferences')) {
      await queryRunner.query(`
        ALTER TABLE push_preferences
        ADD CONSTRAINT fk_push_preferences_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('compliance_playbooks')) {
      await queryRunner.query(`
        ALTER TABLE compliance_playbooks
        ADD CONSTRAINT fk_compliance_playbooks_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      `)
    }

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id ON organizations(tenant_id)`)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id_created_at
        ON organizations(tenant_id, created_at)
      `)
    }

    if (await queryRunner.hasTable('projects')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id)`)
    }

    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_radar_pushes_tenant_id ON radar_pushes(tenant_id)`)

      const scheduledAtExists = await queryRunner.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'radar_pushes' AND column_name = 'scheduled_at'
      `)

      if (scheduledAtExists.length > 0) {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_radar_pushes_tenant_id_scheduled_at
          ON radar_pushes(tenant_id, scheduled_at)
        `)
      }
    }

    if (await queryRunner.hasTable('watched_topics')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_watched_topics_tenant_id ON watched_topics(tenant_id)`)
    }

    if (await queryRunner.hasTable('watched_peers')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_watched_peers_tenant_id ON watched_peers(tenant_id)`)
    }

    if (await queryRunner.hasTable('push_preferences')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_push_preferences_tenant_id ON push_preferences(tenant_id)
      `)
    }

    if (await queryRunner.hasTable('compliance_playbooks')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_compliance_playbooks_tenant_id ON compliance_playbooks(tenant_id)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_radar_pushes_tenant_id_scheduled_at`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_organizations_tenant_id_created_at`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_compliance_playbooks_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_push_preferences_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_watched_peers_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_watched_topics_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_radar_pushes_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_tenant_id`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_organizations_tenant_id`)

    if (await queryRunner.hasTable('compliance_playbooks')) {
      await queryRunner.query(
        `ALTER TABLE compliance_playbooks DROP CONSTRAINT IF EXISTS fk_compliance_playbooks_tenant`
      )
    }
    if (await queryRunner.hasTable('push_preferences')) {
      await queryRunner.query(`ALTER TABLE push_preferences DROP CONSTRAINT IF EXISTS fk_push_preferences_tenant`)
    }
    if (await queryRunner.hasTable('watched_peers')) {
      await queryRunner.query(`ALTER TABLE watched_peers DROP CONSTRAINT IF EXISTS fk_watched_peers_tenant`)
    }
    if (await queryRunner.hasTable('watched_topics')) {
      await queryRunner.query(`ALTER TABLE watched_topics DROP CONSTRAINT IF EXISTS fk_watched_topics_tenant`)
    }
    if (await queryRunner.hasTable('radar_pushes')) {
      await queryRunner.query(`ALTER TABLE radar_pushes DROP CONSTRAINT IF EXISTS fk_radar_pushes_tenant`)
    }
    if (await queryRunner.hasTable('projects')) {
      await queryRunner.query(`ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_tenant`)
    }
    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_organizations_tenant`)
    }

    for (const table of [
      'compliance_playbooks',
      'push_preferences',
      'watched_peers',
      'watched_topics',
      'radar_pushes',
      'projects',
      'organizations',
    ]) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS tenant_id`)
    }

    await queryRunner.query(`DROP TABLE IF EXISTS tenants`)
  }
}
