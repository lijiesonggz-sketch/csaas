import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillLateForeignKeysAndColumns1768000000006 implements MigrationInterface {
  name = 'BackfillLateForeignKeysAndColumns1768000000006'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('action_plan_measures')) {
      const hasSourceType = await queryRunner.hasColumn('action_plan_measures', 'source_type')
      if (!hasSourceType) {
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_type t
              JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE t.typname = 'action_plan_measure_source_type_enum'
                AND n.nspname = 'public'
            ) THEN
              CREATE TYPE action_plan_measure_source_type_enum AS ENUM (
                'MATURITY_GAP',
                'BINARY_GAP',
                'QUICK_GAP'
              );
            END IF;
          END $$;
        `)

        await queryRunner.query(`
          ALTER TABLE "action_plan_measures"
          ADD COLUMN "source_type" action_plan_measure_source_type_enum
        `)

        await queryRunner.query(`
          UPDATE "action_plan_measures"
          SET "source_type" = 'MATURITY_GAP'
          WHERE "source_type" IS NULL
        `)
      }
    }

    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`
        ALTER TABLE "organizations"
        ADD COLUMN IF NOT EXISTS "last_active_at" timestamp,
        ADD COLUMN IF NOT EXISTS "monthly_activity_rate" decimal(5,2),
        ADD COLUMN IF NOT EXISTS "activity_status" varchar(50)
      `)
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_organizations_last_active" ON "organizations" ("last_active_at")`,
      )
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_organizations_activity_rate" ON "organizations" ("monthly_activity_rate")`,
      )
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_organizations_activity_status" ON "organizations" ("activity_status")`,
      )
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='customer_activity_logs'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='organizations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname='FK_activity_logs_organization'
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
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='customer_interventions'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='organizations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname='FK_interventions_organization'
        ) THEN
          ALTER TABLE "customer_interventions"
          ADD CONSTRAINT "FK_interventions_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='ai_usage_logs'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='organizations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname='FK_ai_usage_organization'
        ) THEN
          ALTER TABLE "ai_usage_logs"
          ADD CONSTRAINT "FK_ai_usage_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP CONSTRAINT IF EXISTS "FK_ai_usage_organization"`)
    await queryRunner.query(
      `ALTER TABLE "customer_interventions" DROP CONSTRAINT IF EXISTS "FK_interventions_organization"`,
    )
    await queryRunner.query(
      `ALTER TABLE "customer_activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_organization"`,
    )
  }
}
