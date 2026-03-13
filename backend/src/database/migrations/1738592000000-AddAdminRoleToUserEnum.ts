import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add Admin Role to User Enum
 *
 * Adds 'admin' value to users_role_enum for Story 6-2.
 * Allows admin users to manage consulting company clients.
 *
 * @story 6-2
 */
export class AddAdminRoleToUserEnum1738592000000 implements MigrationInterface {
  name = 'AddAdminRoleToUserEnum1738592000000'

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
    // Note: PostgreSQL does not support removing enum values
    // This would require recreating the enum type and updating all references
    // For safety, we leave the enum value in place
    console.log('Cannot remove enum value in PostgreSQL. Skipping down migration.')
  }
}
