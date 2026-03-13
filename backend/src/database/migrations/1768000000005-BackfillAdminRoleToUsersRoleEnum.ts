import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillAdminRoleToUsersRoleEnum1768000000005 implements MigrationInterface {
  name = 'BackfillAdminRoleToUsersRoleEnum1768000000005'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'users_role_enum'
            AND n.nspname = 'public'
        ) THEN
          ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'admin';
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values safely.
    void queryRunner
  }
}
