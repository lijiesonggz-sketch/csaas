import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdvisorySafeExitLifecycleStatuses1772000000040 implements MigrationInterface {
  name = 'AddAdvisorySafeExitLifecycleStatuses1772000000040'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_sessions_status"
      ON "workflow_sessions" ("status")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_sessions_one_active_actor"
      ON "workflow_sessions" ("tenant_id", "actor_id")
      WHERE "status" = 'active'
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_outputs_tenant_workflow_status"
      ON "workflow_outputs" ("tenant_id", "workflow_key", "status")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_workflow_outputs_one_draft_session"
      ON "workflow_outputs" ("tenant_id", "session_id")
      WHERE "status" = 'draft'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Status values are varchar-only lifecycle data. Do not revive paused/deleted
      -- user data during rollback; earlier migrations own the supporting indexes.
      SELECT 1
    `)
  }
}
