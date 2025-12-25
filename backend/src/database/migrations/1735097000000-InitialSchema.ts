import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1735097000000 implements MigrationInterface {
  name = 'InitialSchema1735097000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('consultant', 'client_pm', 'respondent');
    `)

    await queryRunner.query(`
      CREATE TYPE "project_status_enum" AS ENUM ('draft', 'active', 'completed', 'archived');
    `)

    await queryRunner.query(`
      CREATE TYPE "ai_task_type_enum" AS ENUM (
        'summary_generation',
        'clustering',
        'maturity_matrix',
        'questionnaire_generation',
        'action_plan'
      );
    `)

    await queryRunner.query(`
      CREATE TYPE "ai_task_status_enum" AS ENUM (
        'pending',
        'running',
        'completed',
        'failed',
        'timeout',
        'low_confidence',
        'manual_mode'
      );
    `)

    await queryRunner.query(`
      CREATE TYPE "ai_task_priority_enum" AS ENUM ('low', 'medium', 'high');
    `)

    await queryRunner.query(`
      CREATE TYPE "ai_model_enum" AS ENUM ('gpt4', 'claude', 'domestic');
    `)

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'respondent',
        "name" varchar,
        "tenant_id" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP
      )
    `)

    // Create indexes for users
    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email");
      CREATE INDEX "IDX_users_tenant_id" ON "users" ("tenant_id");
      CREATE INDEX "IDX_users_created_at" ON "users" ("created_at");
    `)

    // Create projects table
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "tenant_id" varchar,
        "owner_id" uuid NOT NULL,
        "status" "project_status_enum" NOT NULL DEFAULT 'draft',
        "description" text,
        "it_standard" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "FK_projects_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `)

    // Create indexes for projects
    await queryRunner.query(`
      CREATE INDEX "IDX_projects_owner_id" ON "projects" ("owner_id");
      CREATE INDEX "IDX_projects_tenant_id" ON "projects" ("tenant_id");
      CREATE INDEX "IDX_projects_status" ON "projects" ("status");
      CREATE INDEX "IDX_projects_created_at" ON "projects" ("created_at");
    `)

    // Create ai_tasks table
    await queryRunner.query(`
      CREATE TABLE "ai_tasks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "type" "ai_task_type_enum" NOT NULL,
        "status" "ai_task_status_enum" NOT NULL DEFAULT 'pending',
        "priority" "ai_task_priority_enum" NOT NULL DEFAULT 'medium',
        "input_data" jsonb NOT NULL,
        "result_data" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        CONSTRAINT "FK_ai_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `)

    // Create indexes for ai_tasks
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_tasks_project_id" ON "ai_tasks" ("project_id");
      CREATE INDEX "IDX_ai_tasks_status" ON "ai_tasks" ("status");
      CREATE INDEX "IDX_ai_tasks_type" ON "ai_tasks" ("type");
      CREATE INDEX "IDX_ai_tasks_created_at" ON "ai_tasks" ("created_at");
    `)

    // Create ai_generation_events table
    await queryRunner.query(`
      CREATE TABLE "ai_generation_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "model" "ai_model_enum" NOT NULL,
        "input" jsonb NOT NULL,
        "output" jsonb,
        "metadata" jsonb,
        "error_message" text,
        "execution_time_ms" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ai_generation_events_task" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE
      )
    `)

    // Create indexes for ai_generation_events
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_generation_events_task_id" ON "ai_generation_events" ("task_id");
      CREATE INDEX "IDX_ai_generation_events_model" ON "ai_generation_events" ("model");
      CREATE INDEX "IDX_ai_generation_events_created_at" ON "ai_generation_events" ("created_at");
    `)

    // Create ai_cost_tracking table
    await queryRunner.query(`
      CREATE TABLE "ai_cost_tracking" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "model" "ai_model_enum" NOT NULL,
        "tokens" integer NOT NULL,
        "cost" decimal(10, 2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ai_cost_tracking_task" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE
      )
    `)

    // Create indexes for ai_cost_tracking
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_cost_tracking_task_id" ON "ai_cost_tracking" ("task_id");
      CREATE INDEX "IDX_ai_cost_tracking_model" ON "ai_cost_tracking" ("model");
      CREATE INDEX "IDX_ai_cost_tracking_created_at" ON "ai_cost_tracking" ("created_at");
    `)

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "action" varchar NOT NULL,
        "resource_type" varchar NOT NULL,
        "resource_id" varchar,
        "metadata" jsonb,
        "ip_address" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `)

    // Create indexes for audit_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id");
      CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action");
      CREATE INDEX "IDX_audit_logs_resource_type" ON "audit_logs" ("resource_type");
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "audit_logs"`)
    await queryRunner.query(`DROP TABLE "ai_cost_tracking"`)
    await queryRunner.query(`DROP TABLE "ai_generation_events"`)
    await queryRunner.query(`DROP TABLE "ai_tasks"`)
    await queryRunner.query(`DROP TABLE "projects"`)
    await queryRunner.query(`DROP TABLE "users"`)

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "ai_model_enum"`)
    await queryRunner.query(`DROP TYPE "ai_task_priority_enum"`)
    await queryRunner.query(`DROP TYPE "ai_task_status_enum"`)
    await queryRunner.query(`DROP TYPE "ai_task_type_enum"`)
    await queryRunner.query(`DROP TYPE "project_status_enum"`)
    await queryRunner.query(`DROP TYPE "user_role_enum"`)
  }
}
