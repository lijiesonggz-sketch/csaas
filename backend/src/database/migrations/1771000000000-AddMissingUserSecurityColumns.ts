import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMissingUserSecurityColumns1771000000000 implements MigrationInterface {
  name = 'AddMissingUserSecurityColumns1771000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return
    }

    if (!(await queryRunner.hasColumn('users', 'failed_login_attempts'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "failed_login_attempts" integer NOT NULL DEFAULT 0
      `)
    } else {
      await queryRunner.query(`
        ALTER TABLE "users"
        ALTER COLUMN "failed_login_attempts" SET DEFAULT 0
      `)
      await queryRunner.query(`
        UPDATE "users"
        SET "failed_login_attempts" = 0
        WHERE "failed_login_attempts" IS NULL
      `)
      await queryRunner.query(`
        ALTER TABLE "users"
        ALTER COLUMN "failed_login_attempts" SET NOT NULL
      `)
    }

    if (!(await queryRunner.hasColumn('users', 'locked_until'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "locked_until" timestamp
      `)
    }

    if (!(await queryRunner.hasColumn('users', 'last_login_at'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "last_login_at" timestamp
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return
    }

    if (await queryRunner.hasColumn('users', 'last_login_at')) {
      await queryRunner.query(`
        ALTER TABLE "users"
        DROP COLUMN "last_login_at"
      `)
    }

    if (await queryRunner.hasColumn('users', 'locked_until')) {
      await queryRunner.query(`
        ALTER TABLE "users"
        DROP COLUMN "locked_until"
      `)
    }

    if (await queryRunner.hasColumn('users', 'failed_login_attempts')) {
      await queryRunner.query(`
        ALTER TABLE "users"
        DROP COLUMN "failed_login_attempts"
      `)
    }
  }
}
