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
    // Add 'admin' to the enum type
    await queryRunner.query(`
      ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'admin'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values
    // This would require recreating the enum type and updating all references
    // For safety, we leave the enum value in place
    console.log('Cannot remove enum value in PostgreSQL. Skipping down migration.')
  }
}
