import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryModuleConfigs1772000000029 implements MigrationInterface {
  name = 'CreateAdvisoryModuleConfigs1772000000029'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advisory_module_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "module_key" character varying(50) NOT NULL DEFAULT 'thinktank',
        "enabled" boolean NOT NULL DEFAULT false,
        "allowed_roles" text[] NOT NULL DEFAULT '{}',
        "data_retention_days" integer NOT NULL DEFAULT 90,
        "privacy_confirmed_at" TIMESTAMP WITH TIME ZONE,
        "privacy_confirmed_by" uuid,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advisory_module_configs" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_advisory_module_configs_tenant_module"
      ON "advisory_module_configs" ("tenant_id", "module_key")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_advisory_module_configs_tenant_id"
      ON "advisory_module_configs" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_advisory_module_configs_module_key"
      ON "advisory_module_configs" ("module_key")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_advisory_module_configs_module_key"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_advisory_module_configs_tenant_id"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_advisory_module_configs_tenant_module"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "advisory_module_configs"
    `)
  }
}
