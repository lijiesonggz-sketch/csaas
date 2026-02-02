import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogTable1738520000000 implements MigrationInterface {
  name = 'CreateAuditLogTable1738520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 0: 检查表是否存在，如果不存在则创建
    const tableExists = await queryRunner.hasTable('audit_logs');

    if (!tableExists) {
      // 创建 audit_logs 表
      await queryRunner.query(`
        CREATE TABLE audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" UUID NOT NULL,
          "organizationId" UUID,
          tenant_id UUID,
          action VARCHAR(50) NOT NULL,
          "entityType" VARCHAR(50) NOT NULL,
          "entityId" UUID,
          changes JSONB,
          details JSONB,
          "ipAddress" VARCHAR(45),
          "userAgent" TEXT,
          "createdAt" TIMESTAMP DEFAULT NOW()
        )
      `);

      // 创建索引
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_userId" ON audit_logs("userId")`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_tenant_id" ON audit_logs(tenant_id)`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityType" ON audit_logs("entityType")`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityId" ON audit_logs("entityId")`);
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON audit_logs("createdAt")`);
    } else {
      // Step 1: 如果表已存在，添加 tenant_id 列（如果不存在）
      const hasColumn = await queryRunner.hasColumn('audit_logs', 'tenant_id');
      if (!hasColumn) {
        await queryRunner.query(`ALTER TABLE audit_logs ADD COLUMN tenant_id UUID`);
      }

      // Step 2: 添加 tenant_id 索引（如果不存在）
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_id" ON audit_logs(tenant_id)`);

      // Step 3: 更新 ip_address 列长度（如果需要）
      await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "ipAddress" TYPE VARCHAR(45)`);

      // Step 4: 更新 user_agent 列类型（如果需要）
      await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "userAgent" TYPE TEXT`);
    }

    // Step 5: 创建触发器函数阻止审计日志的修改和删除
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Step 6: 创建触发器
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;
      CREATE TRIGGER prevent_audit_log_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;
      CREATE TRIGGER prevent_audit_log_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除触发器
    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs`);

    // 删除触发器函数
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_log_modification()`);

    // 删除索引
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id"`);

    // 删除列
    const hasColumn = await queryRunner.hasColumn('audit_logs', 'tenant_id');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN tenant_id`);
    }
  }
}
