import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillClientManagementAfterOrganizations1768000000004 implements MigrationInterface {
  name = 'BackfillClientManagementAfterOrganizations1768000000004'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('organizations')) {
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_person" varchar(255)`)
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_email" varchar(255)`)
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "industry_type" varchar(50)`)
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "scale" varchar(50)`)
      await queryRunner.query(
        `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'trial'`,
      )
      await queryRunner.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "activated_at" timestamp`)
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'client_groups'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'tenants'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_groups_tenant'
        ) THEN
          ALTER TABLE "client_groups"
          ADD CONSTRAINT "FK_client_groups_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'client_group_memberships'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'client_groups'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_group_memberships_group'
        ) THEN
          ALTER TABLE "client_group_memberships"
          ADD CONSTRAINT "FK_client_group_memberships_group"
          FOREIGN KEY ("group_id") REFERENCES "client_groups"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'client_group_memberships'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organizations'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_client_group_memberships_organization'
        ) THEN
          ALTER TABLE "client_group_memberships"
          ADD CONSTRAINT "FK_client_group_memberships_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `)

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_status" ON "organizations" ("status")`)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_contact_email" ON "organizations" ("contact_email")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_industry_type" ON "organizations" ("industry_type")`,
    )
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_scale" ON "organizations" ("scale")`)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_tenant_status" ON "organizations" ("tenant_id", "status")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_tenant_industry" ON "organizations" ("tenant_id", "industry_type")`,
    )
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organizations_activated_at" ON "organizations" ("activated_at")`,
    )
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_client_groups_name" ON "client_groups" ("name")`)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_memberships_organization" ON "client_group_memberships" ("organization_id")`,
    )
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_memberships_group" ON "client_group_memberships" ("group_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_memberships_group"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_memberships_organization"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_groups_name"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_activated_at"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_tenant_industry"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_tenant_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_scale"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_industry_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_contact_email"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organizations_status"`)

    if (await queryRunner.hasTable('client_group_memberships')) {
      await queryRunner.query(
        `ALTER TABLE "client_group_memberships" DROP CONSTRAINT IF EXISTS "FK_client_group_memberships_organization"`,
      )
      await queryRunner.query(
        `ALTER TABLE "client_group_memberships" DROP CONSTRAINT IF EXISTS "FK_client_group_memberships_group"`,
      )
    }

    if (await queryRunner.hasTable('client_groups')) {
      await queryRunner.query(`ALTER TABLE "client_groups" DROP CONSTRAINT IF EXISTS "FK_client_groups_tenant"`)
    }
  }
}
