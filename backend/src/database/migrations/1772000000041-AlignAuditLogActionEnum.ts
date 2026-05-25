import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlignAuditLogActionEnum1772000000041 implements MigrationInterface {
  name = 'AlignAuditLogActionEnum1772000000041'

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
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'playbook_view';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'checklist_submit';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'checklist_update';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'push_sent';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'push_failed';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'create';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'update';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'delete';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'read';
          ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'access_denied';
        END IF;
      END $$;
    `)
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values cannot be removed safely without rebuilding the type.
  }
}
