import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateKGRegulationAndCaseMappingTables1772000000006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRegulationSources = await queryRunner.hasTable('regulation_sources')

    if (!hasRegulationSources) {
      await queryRunner.query(`
        CREATE TABLE "regulation_sources" (
          "source_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "source_code" varchar(100) NOT NULL,
          "source_name" varchar(300) NOT NULL,
          "source_level" varchar(50) NOT NULL,
          "authority_name" varchar(200),
          "industry_scope" jsonb,
          "applicable_org_types" jsonb,
          "effective_from" date,
          "effective_to" date,
          "version_no" varchar(50),
          "source_status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
          "raw_text_path" text,
          "metadata_json" jsonb,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_regulation_sources_source_code" UNIQUE ("source_code")
        )
      `)
    }

    const hasRegulationClauses = await queryRunner.hasTable('regulation_clauses')

    if (!hasRegulationClauses) {
      await queryRunner.query(`
        CREATE TABLE "regulation_clauses" (
          "clause_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "source_id" uuid NOT NULL REFERENCES "regulation_sources"("source_id"),
          "clause_code" varchar(100) NOT NULL,
          "article_no" varchar(100),
          "section_path" varchar(500),
          "clause_text" text NOT NULL,
          "clause_summary" text,
          "mandatory_level" varchar(20),
          "keywords" jsonb,
          "embedding_id" varchar(100),
          "version_no" varchar(50),
          "effective_from" date,
          "effective_to" date,
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_regulation_clauses_clause_code" UNIQUE ("clause_code")
        )
      `)
    }

    const hasClauseControlMaps = await queryRunner.hasTable('clause_control_maps')

    if (!hasClauseControlMaps) {
      await queryRunner.query(`
        CREATE TABLE "clause_control_maps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clause_id" uuid NOT NULL REFERENCES "regulation_clauses"("clause_id"),
          "control_id" uuid NOT NULL REFERENCES "control_points"("control_id"),
          "mapping_type" varchar(30) NOT NULL,
          "confidence_score" numeric(5,4),
          "review_status" varchar(20) NOT NULL DEFAULT 'PENDING',
          "reviewer_id" uuid,
          "reviewed_at" timestamp,
          "notes" text,
          CONSTRAINT "UQ_clause_control_maps_clause_control" UNIQUE ("clause_id", "control_id")
        )
      `)
    }

    const hasComplianceCases = await queryRunner.hasTable('compliance_cases')

    if (!hasComplianceCases) {
      await queryRunner.query(`
        CREATE TABLE "compliance_cases" (
          "case_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "case_code" varchar(100) NOT NULL,
          "case_title" varchar(500),
          "source_org" varchar(200),
          "industry" varchar(50),
          "region" varchar(100),
          "case_date" date,
          "authority_name" varchar(200),
          "penalty_type" jsonb,
          "case_facts" text,
          "raw_source_url" text,
          "raw_content_id" uuid,
          "l1_code" varchar(20) REFERENCES "taxonomy_l1"("l1_code"),
          "l2_code" varchar(20) REFERENCES "taxonomy_l2"("l2_code"),
          "confidence_score" numeric(5,4),
          "import_batch_id" varchar(100),
          "status" varchar(30) NOT NULL DEFAULT 'pending',
          "created_at" timestamp NOT NULL DEFAULT NOW(),
          "updated_at" timestamp NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_compliance_cases_case_code" UNIQUE ("case_code")
        )
      `)
    }

    const hasCaseControlMaps = await queryRunner.hasTable('case_control_maps')

    if (!hasCaseControlMaps) {
      await queryRunner.query(`
        CREATE TABLE "case_control_maps" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "case_id" uuid NOT NULL REFERENCES "compliance_cases"("case_id"),
          "control_id" uuid NOT NULL REFERENCES "control_points"("control_id"),
          "relation_type" varchar(30) NOT NULL DEFAULT 'VIOLATES',
          "confidence_score" numeric(5,4),
          "review_status" varchar(20) NOT NULL DEFAULT 'PENDING',
          CONSTRAINT "UQ_case_control_maps_case_control" UNIQUE ("case_id", "control_id")
        )
      `)
    }

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_regulation_clauses_source" ON "regulation_clauses" ("source_id")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_clause_control_maps_control" ON "clause_control_maps" ("control_id")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_compliance_cases_industry" ON "compliance_cases" ("industry")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_compliance_cases_date" ON "compliance_cases" ("case_date")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_case_control_maps_control" ON "case_control_maps" ("control_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCaseControlMaps = await queryRunner.hasTable('case_control_maps')

    if (hasCaseControlMaps) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_case_control_maps_control"')
      await queryRunner.query('DROP TABLE "case_control_maps"')
    }

    const hasComplianceCases = await queryRunner.hasTable('compliance_cases')

    if (hasComplianceCases) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_compliance_cases_date"')
      await queryRunner.query('DROP INDEX IF EXISTS "idx_compliance_cases_industry"')
      await queryRunner.query('DROP TABLE "compliance_cases"')
    }

    const hasClauseControlMaps = await queryRunner.hasTable('clause_control_maps')

    if (hasClauseControlMaps) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_clause_control_maps_control"')
      await queryRunner.query('DROP TABLE "clause_control_maps"')
    }

    const hasRegulationClauses = await queryRunner.hasTable('regulation_clauses')

    if (hasRegulationClauses) {
      await queryRunner.query('DROP INDEX IF EXISTS "idx_regulation_clauses_source"')
      await queryRunner.query('DROP TABLE "regulation_clauses"')
    }

    const hasRegulationSources = await queryRunner.hasTable('regulation_sources')

    if (hasRegulationSources) {
      await queryRunner.query('DROP TABLE "regulation_sources"')
    }
  }
}
