import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGOrganizationProfiles1772000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organization_profiles')

    if (hasTable) {
      return
    }

    await queryRunner.query(`
      CREATE TABLE "organization_profiles" (
        "org_id" uuid PRIMARY KEY,
        "industry" varchar(50) NOT NULL,
        "legal_person_type" varchar(50) NOT NULL,
        "asset_bucket" varchar(30) NOT NULL,
        "has_personal_info" boolean NOT NULL DEFAULT true,
        "cross_border_data" boolean NOT NULL DEFAULT false,
        "important_data_status" varchar(50) NOT NULL DEFAULT 'unknown',
        "ciio_status" varchar(50) NOT NULL DEFAULT 'unknown',
        "has_datacenter" boolean NOT NULL DEFAULT false,
        "uses_cloud" boolean NOT NULL DEFAULT false,
        "outsourcing_level" varchar(30) NOT NULL DEFAULT 'none',
        "critical_system_level" varchar(30) NOT NULL DEFAULT 'medium',
        "has_online_trading" boolean NOT NULL DEFAULT false,
        "has_ai_services" boolean NOT NULL DEFAULT false,
        "public_service_scope" varchar(50) NOT NULL DEFAULT 'none',
        "regulatory_attention_level" varchar(50) NOT NULL DEFAULT 'low',
        "recent_major_incident" boolean NOT NULL DEFAULT false,
        "extended_profile" jsonb,
        "updated_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_organization_profiles_org_id"
          FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('organization_profiles')

    if (!hasTable) {
      return
    }

    await queryRunner.query(`DROP TABLE "organization_profiles"`)
  }
}
