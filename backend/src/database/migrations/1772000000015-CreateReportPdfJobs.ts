import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateReportPdfJobs1772000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('report_pdf_jobs')

    if (exists) {
      return
    }

    await queryRunner.query(`
      CREATE TABLE "report_pdf_jobs" (
        "pdf_job_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "report_id" uuid NOT NULL,
        "requested_by_user_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'queued',
        "file_name" varchar(255),
        "file_path" varchar(500),
        "file_size_bytes" integer,
        "error_summary" varchar(500),
        "expires_at" timestamp NOT NULL,
        "started_at" timestamp,
        "completed_at" timestamp,
        "failed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_pdf_jobs_pdf_job_id" PRIMARY KEY ("pdf_job_id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_report_pdf_jobs_org_report_created"
      ON "report_pdf_jobs" ("organization_id", "report_id", "created_at")
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_report_pdf_jobs_expires_at"
      ON "report_pdf_jobs" ("expires_at")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('report_pdf_jobs')

    if (!exists) {
      return
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_pdf_jobs_expires_at"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_pdf_jobs_org_report_created"`)
    await queryRunner.query(`DROP TABLE "report_pdf_jobs"`)
  }
}
