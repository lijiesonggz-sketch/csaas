import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Customer Activity Tracking
 *
 * Creates tables for customer activity logs and interventions.
 * Adds activity tracking fields to organizations table.
 *
 * @story 7-3
 * @migration
 */
export class AddCustomerActivityTracking1738700000000 implements MigrationInterface {
  name = 'AddCustomerActivityTracking1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create customer_activity_logs table
    await queryRunner.query(`
      CREATE TABLE "customer_activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "activity_type" varchar(50) NOT NULL,
        "activity_date" date NOT NULL,
        "activity_count" int NOT NULL DEFAULT 1,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_activity_logs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for customer_activity_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_org_date" ON "customer_activity_logs" ("organization_id", "activity_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_type_created" ON "customer_activity_logs" ("activity_type", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_activity_logs_organization_id" ON "customer_activity_logs" ("organization_id")
    `);

    // Create customer_interventions table
    await queryRunner.query(`
      CREATE TABLE "customer_interventions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "intervention_type" varchar(50) NOT NULL,
        "result" varchar(50) NOT NULL,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_interventions" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for customer_interventions
    await queryRunner.query(`
      CREATE INDEX "IDX_interventions_org_created" ON "customer_interventions" ("organization_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_interventions_organization_id" ON "customer_interventions" ("organization_id")
    `);

    // Add activity tracking columns to organizations table
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "last_active_at" timestamp,
      ADD COLUMN IF NOT EXISTS "monthly_activity_rate" decimal(5,2),
      ADD COLUMN IF NOT EXISTS "activity_status" varchar(50)
    `);

    // Create indexes for organizations activity fields
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_last_active" ON "organizations" ("last_active_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_activity_rate" ON "organizations" ("monthly_activity_rate")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_activity_status" ON "organizations" ("activity_status")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "customer_activity_logs"
      ADD CONSTRAINT "FK_activity_logs_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_interventions"
      ADD CONSTRAINT "FK_interventions_organization"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "customer_interventions" DROP CONSTRAINT IF EXISTS "FK_interventions_organization"
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_organization"
    `);

    // Drop indexes from organizations
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_activity_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_activity_rate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_last_active"`);

    // Drop columns from organizations
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP COLUMN IF EXISTS "activity_status",
      DROP COLUMN IF EXISTS "monthly_activity_rate",
      DROP COLUMN IF EXISTS "last_active_at"
    `);

    // Drop indexes from customer_interventions
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interventions_organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interventions_org_created"`);

    // Drop customer_interventions table
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_interventions"`);

    // Drop indexes from customer_activity_logs
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_organization_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_org_date"`);

    // Drop customer_activity_logs table
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_activity_logs"`);
  }
}
