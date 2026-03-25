import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGRemediationActions1772000000010 implements MigrationInterface {
  name = 'CreateKGRemediationActions1772000000010'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('remediation_actions')
    if (exists) {
      return
    }

    await queryRunner.query(`
      CREATE TABLE "remediation_actions" (
        "action_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "action_code" character varying(100) NOT NULL,
        "control_id" uuid NOT NULL,
        "action_title" character varying(300) NOT NULL,
        "action_desc" text,
        "priority_default" character varying(20) NOT NULL DEFAULT 'MEDIUM',
        "effort_level" character varying(20),
        "expected_benefit" character varying(20),
        "owner_role_hint" jsonb,
        "output_template" jsonb,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_remediation_actions_action_id" PRIMARY KEY ("action_id"),
        CONSTRAINT "UQ_remediation_actions_action_code" UNIQUE ("action_code"),
        CONSTRAINT "FK_remediation_actions_control" FOREIGN KEY ("control_id") REFERENCES "control_points"("control_id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_remediation_actions_control" ON "remediation_actions" ("control_id")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_remediation_actions_priority" ON "remediation_actions" ("priority_default")',
    )
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_remediation_actions_status" ON "remediation_actions" ("status")',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('remediation_actions')
    if (!exists) {
      return
    }

    await queryRunner.query('DROP INDEX IF EXISTS "idx_remediation_actions_status"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_remediation_actions_priority"')
    await queryRunner.query('DROP INDEX IF EXISTS "idx_remediation_actions_control"')
    await queryRunner.query('DROP TABLE "remediation_actions"')
  }
}
