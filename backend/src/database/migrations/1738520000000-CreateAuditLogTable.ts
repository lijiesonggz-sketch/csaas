import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAuditLogTable1738520000000 implements MigrationInterface {
  name = 'CreateAuditLogTable1738520000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('audit_logs')

    if (!tableExists) {
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
      `)

      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_userId" ON audit_logs("userId")`)
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_tenant_id" ON audit_logs(tenant_id)`)
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityType" ON audit_logs("entityType")`)
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entityId" ON audit_logs("entityId")`)
      await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON audit_logs("createdAt")`)
    } else {
      if (!(await queryRunner.hasColumn('audit_logs', 'tenant_id'))) {
        await queryRunner.query(`ALTER TABLE audit_logs ADD COLUMN tenant_id UUID`)
      }

      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_id" ON audit_logs(tenant_id)`)

      if (await queryRunner.hasColumn('audit_logs', 'ipAddress')) {
        await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "ipAddress" TYPE VARCHAR(45)`)
      } else if (await queryRunner.hasColumn('audit_logs', 'ip_address')) {
        await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "ip_address" TYPE VARCHAR(45)`)
      }

      if (await queryRunner.hasColumn('audit_logs', 'userAgent')) {
        await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "userAgent" TYPE TEXT`)
      } else if (await queryRunner.hasColumn('audit_logs', 'user_agent')) {
        await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN "user_agent" TYPE TEXT`)
      }
    }

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
      END;
      $$ LANGUAGE plpgsql;
    `)

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;
      CREATE TRIGGER prevent_audit_log_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `)

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;
      CREATE TRIGGER prevent_audit_log_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('audit_logs'))) {
      await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_log_modification()`)
      return
    }

    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_log_modification()`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id"`)

    if (await queryRunner.hasColumn('audit_logs', 'tenant_id')) {
      await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN tenant_id`)
    }
  }
}
