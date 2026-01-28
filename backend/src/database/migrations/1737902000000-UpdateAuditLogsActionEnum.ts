import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateAuditLogsActionEnum1737902000000 implements MigrationInterface {
  name = 'UpdateAuditLogsActionEnum1737902000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values to audit_logs_action_enum
    await queryRunner.query(`
      ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'ACCESS_PROJECT';
      ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'RERUN_TASK';
      ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'VIEW_VERSION';
      ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'ACCESS_DENIED';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type if you want to remove values
    // For now, we'll leave this empty as it's not critical for rollback
  }
}
