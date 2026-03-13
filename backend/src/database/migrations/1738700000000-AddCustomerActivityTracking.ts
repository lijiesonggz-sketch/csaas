import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCustomerActivityTracking1738700000000 implements MigrationInterface {
  name = 'AddCustomerActivityTracking1738700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const organizationsExists = await queryRunner.hasTable('organizations')

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_activity_logs" (
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
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_org_date"
      ON "customer_activity_logs" ("organization_id", "activity_date")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_type_created"
      ON "customer_activity_logs" ("activity_type", "created_at")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_logs_organization_id"
      ON "customer_activity_logs" ("organization_id")
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_interventions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "intervention_type" varchar(50) NOT NULL,
        "result" varchar(50) NOT NULL,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_interventions" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interventions_org_created"
      ON "customer_interventions" ("organization_id", "created_at")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_interventions_organization_id"
      ON "customer_interventions" ("organization_id")
    `)

    if (organizationsExists) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        ADD COLUMN IF NOT EXISTS "last_active_at" timestamp,
        ADD COLUMN IF NOT EXISTS "monthly_activity_rate" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "activity_status" varchar(50)
      `)

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_organizations_last_active" ON "organizations" ("last_active_at")
      `)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_organizations_activity_rate" ON "organizations" ("monthly_activity_rate")
      `)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_organizations_activity_status" ON "organizations" ("activity_status")
      `)

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_activity_logs_organization'
          ) THEN
            ALTER TABLE "customer_activity_logs"
            ADD CONSTRAINT "FK_activity_logs_organization"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
          END IF;
        END $$;
      `)

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'FK_interventions_organization'
          ) THEN
            ALTER TABLE "customer_interventions"
            ADD CONSTRAINT "FK_interventions_organization"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
          END IF;
        END $$;
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('customer_interventions')) {
      await queryRunner.query(`
        ALTER TABLE "customer_interventions" DROP CONSTRAINT IF EXISTS "FK_interventions_organization"
      `)
    }

    if (await queryRunner.hasTable('customer_activity_logs')) {
      await queryRunner.query(`
        ALTER TABLE "customer_activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_organization"
      `)
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_activity_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_activity_rate"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_last_active"`)

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        DROP COLUMN IF EXISTS "activity_status",
        DROP COLUMN IF EXISTS "monthly_activity_rate",
        DROP COLUMN IF EXISTS "last_active_at"
      `)
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interventions_organization_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interventions_org_created"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_interventions"`)

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_organization_id"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_type_created"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activity_logs_org_date"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_activity_logs"`)
  }
}
