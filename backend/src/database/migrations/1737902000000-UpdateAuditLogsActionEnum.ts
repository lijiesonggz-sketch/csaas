import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateAuditLogsActionEnum1737902000000 implements MigrationInterface {
  name = 'UpdateAuditLogsActionEnum1737902000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'audit_logs_action_enum'
            AND n.nspname = 'public'
        ) THEN
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'ACCESS_PROJECT';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'RERUN_TASK';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'VIEW_VERSION';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'ACCESS_DENIED';
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type if you want to remove values
    // For now, we'll leave this empty as it's not critical for rollback
  }
}
