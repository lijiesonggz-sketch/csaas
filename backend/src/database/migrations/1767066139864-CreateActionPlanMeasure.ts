import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateActionPlanMeasure1767066139864 implements MigrationInterface {
    name = 'CreateActionPlanMeasure1767066139864'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "survey_responses" DROP CONSTRAINT "FK_7b10bd08286c2d8cd854037fd3c"`);
        await queryRunner.query(`DROP INDEX "public"."idx_survey_responses_questionnaire_task_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_survey_responses_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_survey_responses_respondent_email"`);
        await queryRunner.query(`CREATE TYPE "public"."action_plan_measures_priority_enum" AS ENUM('high', 'medium', 'low')`);
        await queryRunner.query(`CREATE TYPE "public"."action_plan_measures_status_enum" AS ENUM('planned', 'in_progress', 'completed', 'blocked', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "action_plan_measures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "task_id" uuid NOT NULL, "survey_response_id" character varying NOT NULL, "cluster_name" character varying(200) NOT NULL, "cluster_id" character varying, "current_level" double precision NOT NULL, "target_level" double precision NOT NULL, "gap" double precision NOT NULL, "priority" "public"."action_plan_measures_priority_enum" NOT NULL DEFAULT 'medium', "title" character varying(500) NOT NULL, "description" text NOT NULL, "implementation_steps" jsonb NOT NULL, "timeline" character varying(100) NOT NULL, "responsible_department" character varying(200) NOT NULL, "expected_improvement" double precision NOT NULL, "resources_needed" jsonb, "dependencies" jsonb, "risks" jsonb, "kpi_metrics" jsonb, "status" "public"."action_plan_measures_status_enum" NOT NULL DEFAULT 'planned', "progress" integer NOT NULL DEFAULT '0', "notes" text, "ai_model" character varying(50), "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "started_at" TIMESTAMP, "completed_at" TIMESTAMP, CONSTRAINT "PK_cb112070ab5e696d0d073136111" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."survey_status" RENAME TO "survey_status_old"`);
        await queryRunner.query(`CREATE TYPE "public"."survey_responses_status_enum" AS ENUM('draft', 'submitted', 'completed')`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" TYPE "public"."survey_responses_status_enum" USING "status"::"text"::"public"."survey_responses_status_enum"`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."survey_status_old"`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "answers" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ADD CONSTRAINT "FK_7b10bd08286c2d8cd854037fd3c" FOREIGN KEY ("questionnaire_task_id") REFERENCES "ai_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_plan_measures" ADD CONSTRAINT "FK_c23acbc5e35b295359252d8a0c5" FOREIGN KEY ("task_id") REFERENCES "ai_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_plan_measures" DROP CONSTRAINT "FK_c23acbc5e35b295359252d8a0c5"`);
        await queryRunner.query(`ALTER TABLE "survey_responses" DROP CONSTRAINT "FK_7b10bd08286c2d8cd854037fd3c"`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "answers" SET DEFAULT '{}'`);
        await queryRunner.query(`CREATE TYPE "public"."survey_status_old" AS ENUM('draft', 'submitted', 'completed')`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" TYPE "public"."survey_status_old" USING "status"::"text"::"public"."survey_status_old"`);
        await queryRunner.query(`ALTER TABLE "survey_responses" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."survey_responses_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."survey_status_old" RENAME TO "survey_status"`);
        await queryRunner.query(`DROP TABLE "action_plan_measures"`);
        await queryRunner.query(`DROP TYPE "public"."action_plan_measures_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."action_plan_measures_priority_enum"`);
        await queryRunner.query(`CREATE INDEX "idx_survey_responses_respondent_email" ON "survey_responses" ("respondent_email") `);
        await queryRunner.query(`CREATE INDEX "idx_survey_responses_status" ON "survey_responses" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_survey_responses_questionnaire_task_id" ON "survey_responses" ("questionnaire_task_id") `);
        await queryRunner.query(`ALTER TABLE "survey_responses" ADD CONSTRAINT "FK_7b10bd08286c2d8cd854037fd3c" FOREIGN KEY ("questionnaire_task_id") REFERENCES "ai_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
