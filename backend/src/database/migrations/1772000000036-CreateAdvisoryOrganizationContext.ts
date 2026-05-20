import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdvisoryOrganizationContext1772000000036 implements MigrationInterface {
  name = 'CreateAdvisoryOrganizationContext1772000000036'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_context" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "context_type" character varying(80) NOT NULL,
        "context_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "completeness_score" real NOT NULL DEFAULT 0,
        "completeness_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_context" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organization_context_tenant_id"
      ON "organization_context" ("tenant_id")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_organization_context_tenant_context"
      ON "organization_context" ("tenant_id", "context_type")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organization_context_context_data_gin"
      ON "organization_context" USING GIN ("context_data")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_organization_context_completeness_metadata_gin"
      ON "organization_context" USING GIN ("completeness_metadata")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_organization_context_completeness_metadata_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_organization_context_context_data_gin"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_organization_context_tenant_context"
    `)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_organization_context_tenant_id"
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS "organization_context"
    `)
  }
}
