import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Change contentType from varchar to enum
 * Story 3.1 Code Review Fix: MEDIUM SEVERITY #4
 *
 * Changes contentType column from varchar(50) to enum type
 * with values: 'article', 'recruitment', 'conference'
 */
export class ChangeContentTypeToEnum1738310000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE raw_content_contenttype_enum AS ENUM ('article', 'recruitment', 'conference')
    `)

    // Change column type to enum
    await queryRunner.query(`
      ALTER TABLE raw_contents
      ALTER COLUMN "contentType" TYPE raw_content_contenttype_enum
      USING ("contentType"::raw_content_contenttype_enum)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to varchar
    await queryRunner.query(`
      ALTER TABLE raw_contents
      ALTER COLUMN "contentType" TYPE varchar(50)
    `)

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS raw_content_contenttype_enum
    `)
  }
}
