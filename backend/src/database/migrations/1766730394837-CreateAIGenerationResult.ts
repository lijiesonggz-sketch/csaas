import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAIGenerationResult1766730394837 implements MigrationInterface {
  name = 'CreateAIGenerationResult1766730394837'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" DROP CONSTRAINT "FK_e8ff4033210f6b6618652176904"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" DROP CONSTRAINT "FK_0ae514c4fcf8b08c5b448f9af91"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_results_task_id"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_results_generation_type"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_generation_results_review_status"`)
    await queryRunner.query(`COMMENT ON COLUMN "ai_generation_results"."quality_scores" IS NULL`)
    await queryRunner.query(
      `COMMENT ON COLUMN "ai_generation_results"."consistency_report" IS NULL`,
    )
    await queryRunner.query(`COMMENT ON COLUMN "ai_generation_results"."coverage_report" IS NULL`)
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" ADD CONSTRAINT "FK_e8ff4033210f6b6618652176904" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" ADD CONSTRAINT "FK_0ae514c4fcf8b08c5b448f9af91" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" DROP CONSTRAINT "FK_0ae514c4fcf8b08c5b448f9af91"`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" DROP CONSTRAINT "FK_e8ff4033210f6b6618652176904"`,
    )
    await queryRunner.query(
      `COMMENT ON COLUMN "ai_generation_results"."coverage_report" IS 'Structure: { covered: string[], missing: string[], coverageRate: number }'`,
    )
    await queryRunner.query(
      `COMMENT ON COLUMN "ai_generation_results"."consistency_report" IS 'Structure: { agreements: string[], disagreements: string[] }'`,
    )
    await queryRunner.query(
      `COMMENT ON COLUMN "ai_generation_results"."quality_scores" IS 'Structure: { structural: number, semantic: number, detail: number }'`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_results_review_status" ON "ai_generation_results" ("review_status") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_results_generation_type" ON "ai_generation_results" ("generation_type") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_generation_results_task_id" ON "ai_generation_results" ("task_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" ADD CONSTRAINT "FK_0ae514c4fcf8b08c5b448f9af91" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "ai_generation_results" ADD CONSTRAINT "FK_e8ff4033210f6b6618652176904" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }
}
