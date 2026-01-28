import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateAITaskEntity1766633092012 implements MigrationInterface {
  name = 'UpdateAITaskEntity1766633092012'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" DROP CONSTRAINT "FK_ai_generation_events_task"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" DROP CONSTRAINT "FK_ai_cost_tracking_task"`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP CONSTRAINT "FK_ai_tasks_project"`)
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_owner"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_user"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_events_task_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_events_model"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_events_created_at"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_cost_tracking_task_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_cost_tracking_model"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_cost_tracking_created_at"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_tasks_project_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_tasks_status"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_tasks_type"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_tasks_created_at"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_owner_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_tenant_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_status"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_created_at"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_users_tenant_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_users_created_at"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_user_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_action"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_resource_type"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_created_at"`)
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "it_standard" TO "metadata"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "input_data"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "result_data"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "metadata"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "resource_type"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "resource_id"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "metadata"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "input" jsonb NOT NULL`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "result" jsonb`)
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD "progress" double precision NOT NULL DEFAULT '0'`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "error_message" text`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "entity_type" character varying`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "entity_id" character varying`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "changes" jsonb`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "user_agent" character varying`)
    await queryRunner.query(`ALTER TYPE "public"."ai_model_enum" RENAME TO "ai_model_enum_old"`)
    await queryRunner.query(
      `CREATE TYPE "public"."ai_generation_events_model_enum" AS ENUM('gpt4', 'claude', 'domestic')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" ALTER COLUMN "model" TYPE "public"."ai_generation_events_model_enum" USING "model"::"text"::"public"."ai_generation_events_model_enum"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_cost_tracking_model_enum" AS ENUM('gpt4', 'claude', 'domestic')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" ALTER COLUMN "model" TYPE "public"."ai_cost_tracking_model_enum" USING "model"::"text"::"public"."ai_cost_tracking_model_enum"`,
    )
    await queryRunner.query(`DROP TYPE "public"."ai_model_enum_old"`)
    await queryRunner.query(
      `ALTER TYPE "public"."ai_task_type_enum" RENAME TO "ai_task_type_enum_old"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_tasks_type_enum" AS ENUM('summary', 'clustering', 'matrix', 'questionnaire', 'action_plan')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ALTER COLUMN "type" TYPE "public"."ai_tasks_type_enum" USING "type"::"text"::"public"."ai_tasks_type_enum"`,
    )
    await queryRunner.query(`DROP TYPE "public"."ai_task_type_enum_old"`)
    await queryRunner.query(
      `ALTER TYPE "public"."ai_task_status_enum" RENAME TO "ai_task_status_enum_old"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_tasks_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'manual_mode', 'low_confidence')`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ALTER COLUMN "status" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ALTER COLUMN "status" TYPE "public"."ai_tasks_status_enum" USING "status"::"text"::"public"."ai_tasks_status_enum"`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'`)
    await queryRunner.query(`DROP TYPE "public"."ai_task_status_enum_old"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "priority"`)
    await queryRunner.query(`DROP TYPE "public"."ai_task_priority_enum"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "priority" integer NOT NULL DEFAULT '1'`)
    await queryRunner.query(
      `ALTER TYPE "public"."project_status_enum" RENAME TO "project_status_enum_old"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."projects_status_enum" AS ENUM('draft', 'active', 'completed', 'archived')`,
    )
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum" USING "status"::"text"::"public"."projects_status_enum"`,
    )
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'draft'`)
    await queryRunner.query(`DROP TYPE "public"."project_status_enum_old"`)
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "metadata"`)
    await queryRunner.query(`ALTER TABLE "projects" ADD "metadata" jsonb`)
    await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`)
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('consultant', 'client_pm', 'respondent')`,
    )
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`,
    )
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'respondent'`)
    await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_id"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "user_id" character varying`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "action"`)
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('create', 'update', 'delete', 'login', 'logout')`,
    )
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "action" "public"."audit_logs_action_enum" NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" ADD CONSTRAINT "FK_dfd3bf4272d3882c7e7aaf37da0" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" ADD CONSTRAINT "FK_857f791a0de362bee9c613beda6" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD CONSTRAINT "FK_c7388f0106b9d3609c35db87a61" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" DROP CONSTRAINT "FK_c7388f0106b9d3609c35db87a61"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" DROP CONSTRAINT "FK_857f791a0de362bee9c613beda6"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" DROP CONSTRAINT "FK_dfd3bf4272d3882c7e7aaf37da0"`,
    )
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "action"`)
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "action" character varying NOT NULL`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_id"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "user_id" uuid`)
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum_old" AS ENUM('consultant', 'client_pm', 'respondent')`,
    )
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::"text"::"public"."user_role_enum_old"`,
    )
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'respondent'`)
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`)
    await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`)
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "metadata"`)
    await queryRunner.query(`ALTER TABLE "projects" ADD "metadata" character varying`)
    await queryRunner.query(
      `CREATE TYPE "public"."project_status_enum_old" AS ENUM('draft', 'active', 'completed', 'archived')`,
    )
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."project_status_enum_old" USING "status"::"text"::"public"."project_status_enum_old"`,
    )
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'draft'`)
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`)
    await queryRunner.query(
      `ALTER TYPE "public"."project_status_enum_old" RENAME TO "project_status_enum"`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "priority"`)
    await queryRunner.query(
      `CREATE TYPE "public"."ai_task_priority_enum" AS ENUM('low', 'medium', 'high')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD "priority" "public"."ai_task_priority_enum" NOT NULL DEFAULT 'medium'`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_task_status_enum_old" AS ENUM('pending', 'running', 'completed', 'failed', 'timeout', 'low_confidence', 'manual_mode')`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ALTER COLUMN "status" DROP DEFAULT`)
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ALTER COLUMN "status" TYPE "public"."ai_task_status_enum_old" USING "status"::"text"::"public"."ai_task_status_enum_old"`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'`)
    await queryRunner.query(`DROP TYPE "public"."ai_tasks_status_enum"`)
    await queryRunner.query(
      `ALTER TYPE "public"."ai_task_status_enum_old" RENAME TO "ai_task_status_enum"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_task_type_enum_old" AS ENUM('summary_generation', 'clustering', 'maturity_matrix', 'questionnaire_generation', 'action_plan')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ALTER COLUMN "type" TYPE "public"."ai_task_type_enum_old" USING "type"::"text"::"public"."ai_task_type_enum_old"`,
    )
    await queryRunner.query(`DROP TYPE "public"."ai_tasks_type_enum"`)
    await queryRunner.query(
      `ALTER TYPE "public"."ai_task_type_enum_old" RENAME TO "ai_task_type_enum"`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."ai_model_enum_old" AS ENUM('gpt4', 'claude', 'domestic')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" ALTER COLUMN "model" TYPE "public"."ai_model_enum_old" USING "model"::"text"::"public"."ai_model_enum_old"`,
    )
    await queryRunner.query(`DROP TYPE "public"."ai_cost_tracking_model_enum"`)
    await queryRunner.query(`ALTER TYPE "public"."ai_model_enum_old" RENAME TO "ai_model_enum"`)
    await queryRunner.query(
      `CREATE TYPE "public"."ai_model_enum_old" AS ENUM('gpt4', 'claude', 'domestic')`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" ALTER COLUMN "model" TYPE "public"."ai_model_enum_old" USING "model"::"text"::"public"."ai_model_enum_old"`,
    )
    await queryRunner.query(`DROP TYPE "public"."ai_generation_events_model_enum"`)
    await queryRunner.query(`ALTER TYPE "public"."ai_model_enum_old" RENAME TO "ai_model_enum"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_agent"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "changes"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "entity_id"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "entity_type"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "error_message"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "progress"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "result"`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" DROP COLUMN "input"`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "metadata" jsonb`)
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "resource_id" character varying`)
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD "resource_type" character varying NOT NULL`,
    )
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "metadata" jsonb`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "result_data" jsonb`)
    await queryRunner.query(`ALTER TABLE "ai_tasks" ADD "input_data" jsonb NOT NULL`)
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "metadata" TO "it_standard"`)
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_resource_type" ON "audit_logs" ("resource_type") `,
    )
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action") `)
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id") `)
    await queryRunner.query(`CREATE INDEX "IDX_users_created_at" ON "users" ("created_at") `)
    await queryRunner.query(`CREATE INDEX "IDX_users_tenant_id" ON "users" ("tenant_id") `)
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email") `)
    await queryRunner.query(`CREATE INDEX "IDX_projects_created_at" ON "projects" ("created_at") `)
    await queryRunner.query(`CREATE INDEX "IDX_projects_status" ON "projects" ("status") `)
    await queryRunner.query(`CREATE INDEX "IDX_projects_tenant_id" ON "projects" ("tenant_id") `)
    await queryRunner.query(`CREATE INDEX "IDX_projects_owner_id" ON "projects" ("owner_id") `)
    await queryRunner.query(`CREATE INDEX "IDX_ai_tasks_created_at" ON "ai_tasks" ("created_at") `)
    await queryRunner.query(`CREATE INDEX "IDX_ai_tasks_type" ON "ai_tasks" ("type") `)
    await queryRunner.query(`CREATE INDEX "IDX_ai_tasks_status" ON "ai_tasks" ("status") `)
    await queryRunner.query(`CREATE INDEX "IDX_ai_tasks_project_id" ON "ai_tasks" ("project_id") `)
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_cost_tracking_created_at" ON "ai_cost_tracking" ("created_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_cost_tracking_model" ON "ai_cost_tracking" ("model") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_cost_tracking_task_id" ON "ai_cost_tracking" ("task_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_events_created_at" ON "ai_generation_events" ("created_at") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_events_model" ON "ai_generation_events" ("model") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_events_task_id" ON "ai_generation_events" ("task_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_tasks" ADD CONSTRAINT "FK_ai_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_cost_tracking" ADD CONSTRAINT "FK_ai_cost_tracking_task" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_events" ADD CONSTRAINT "FK_ai_generation_events_task" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }
}
