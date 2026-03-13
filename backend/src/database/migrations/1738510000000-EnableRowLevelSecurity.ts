import { MigrationInterface, QueryRunner } from 'typeorm'

export class EnableRowLevelSecurity1738510000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1738510000000'

  private readonly TABLES = [
    'organizations',
    'projects',
    'radar_pushes',
    'watched_topics',
    'watched_peers',
    'push_preferences',
    'compliance_playbooks',
  ] as const

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }

      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)

      await queryRunner.query(`
        CREATE POLICY tenant_isolation_policy ON ${table}
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
      `)

      await queryRunner.query(`
        CREATE POLICY admin_bypass_policy ON ${table}
        FOR ALL
        USING (current_setting('app.is_admin', true)::boolean = true)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        continue
      }
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON ${table}`)
      await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON ${table}`)
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`)
    }
  }
}
