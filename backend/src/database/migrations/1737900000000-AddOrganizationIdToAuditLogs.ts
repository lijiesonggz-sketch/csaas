import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOrganizationIdToAuditLogs1737900000000 implements MigrationInterface {
  name = 'AddOrganizationIdToAuditLogs1737900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'organizations'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_audit_logs_organization'
        ) THEN
          ALTER TABLE "audit_logs"
          ADD CONSTRAINT "FK_audit_logs_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP CONSTRAINT IF EXISTS "FK_audit_logs_organization";
    `)

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "organization_id";
    `)
  }
}
