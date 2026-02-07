import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create system_health_logs table
 *
 * Creates table for storing system health metrics over time.
 *
 * @story 7-1
 * @module backend/src/database/migrations
 */
export class CreateSystemHealthLogs1738601000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'system_health_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'metric_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'metric_value',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'target_value',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'recorded_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_system_health_logs_metric_type',
            columnNames: ['metric_type'],
          },
          {
            name: 'IDX_system_health_logs_recorded_at',
            columnNames: ['recorded_at'],
          },
          {
            name: 'IDX_system_health_logs_metric_type_recorded_at',
            columnNames: ['metric_type', 'recorded_at'],
          },
          {
            name: 'IDX_system_health_logs_status_recorded_at',
            columnNames: ['status', 'recorded_at'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('system_health_logs');
  }
}
