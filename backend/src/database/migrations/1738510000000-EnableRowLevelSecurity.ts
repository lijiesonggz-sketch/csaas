import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRowLevelSecurity1738510000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1738510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: 启用 RLS
    await queryRunner.query(`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE radar_pushes ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE watched_topics ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE watched_peers ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE push_preferences ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE compliance_playbooks ENABLE ROW LEVEL SECURITY`);

    // Step 2: 创建 RLS 策略 - 使用 true 参数允许未设置时返回空
    // 添加 WITH CHECK 子句确保 INSERT/UPDATE 操作也受到租户隔离保护
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON organizations
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON projects
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON radar_pushes
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON watched_topics
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON watched_peers
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON push_preferences
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON compliance_playbooks
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `);

    // Step 3: 为系统管理员创建豁免策略（可选）
    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON organizations
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON projects
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON radar_pushes
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON watched_topics
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON watched_peers
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON push_preferences
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);

    await queryRunner.query(`
      CREATE POLICY admin_bypass_policy ON compliance_playbooks
      FOR ALL
      USING (current_setting('app.is_admin', true)::boolean = true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除 RLS 策略
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON organizations`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON organizations`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON projects`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON projects`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON radar_pushes`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON radar_pushes`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON watched_topics`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON watched_topics`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON watched_peers`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON watched_peers`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON push_preferences`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON push_preferences`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON compliance_playbooks`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_bypass_policy ON compliance_playbooks`);

    // 禁用 RLS
    await queryRunner.query(`ALTER TABLE organizations DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE projects DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE radar_pushes DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE watched_topics DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE watched_peers DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE push_preferences DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE compliance_playbooks DISABLE ROW LEVEL SECURITY`);
  }
}
