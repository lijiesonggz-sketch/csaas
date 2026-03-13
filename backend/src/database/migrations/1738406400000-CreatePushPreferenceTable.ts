import { MigrationInterface, QueryRunner, Table } from 'typeorm'

/**
 * Migration: Create Push Preference Table
 *
 * Creates the push_preferences table for storing organization push notification preferences.
 * Each organization has exactly one push preference record.
 */
export class CreatePushPreferenceTable1738406400000 implements MigrationInterface {
  name = 'CreatePushPreferenceTable1738406400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const organizationsExists = await queryRunner.hasTable('organizations')

    await queryRunner.createTable(
      new Table({
        name: 'push_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'push_start_time',
            type: 'time',
            default: "'09:00:00'",
            isNullable: false,
          },
          {
            name: 'push_end_time',
            type: 'time',
            default: "'18:00:00'",
            isNullable: false,
          },
          {
            name: 'daily_push_limit',
            type: 'int',
            default: 5,
            isNullable: false,
          },
          {
            name: 'relevance_filter',
            type: 'varchar',
            length: '20',
            default: "'high_only'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        indices: [
          {
            name: 'IDX_PUSH_PREFERENCE_ORG',
            columnNames: ['organization_id'],
            isUnique: true,
          },
        ],
        foreignKeys: organizationsExists
          ? [
              {
                name: 'FK_PUSH_PREFERENCE_ORGANIZATION',
                columnNames: ['organization_id'],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
              },
            ]
          : [],
      }),
      true,
    )

    // Add trigger for automatic updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_push_preferences_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `)

    await queryRunner.query(`
      CREATE TRIGGER trigger_push_preferences_updated_at
      BEFORE UPDATE ON push_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_push_preferences_updated_at();
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger first
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_push_preferences_updated_at ON push_preferences;`,
    )
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_push_preferences_updated_at();`)

    // Drop table
    await queryRunner.dropTable('push_preferences', true)
  }
}
