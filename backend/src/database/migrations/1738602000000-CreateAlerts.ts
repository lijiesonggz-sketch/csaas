import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create alerts table
 *
 * Creates table for storing system alerts and notifications.
 *
 * @story 7-1
 * @module backend/src/database/migrations
 */
export class CreateAlerts1738602000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'alerts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'alert_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'unresolved'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'occurred_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
          {
            name: 'resolved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'resolved_by',
            type: 'uuid',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX_alerts_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_alerts_occurred_at',
            columnNames: ['occurred_at'],
          },
          {
            name: 'IDX_alerts_status_occurred_at',
            columnNames: ['status', 'occurred_at'],
          },
          {
            name: 'IDX_alerts_severity_occurred_at',
            columnNames: ['severity', 'occurred_at'],
          },
          {
            name: 'IDX_alerts_alert_type_occurred_at',
            columnNames: ['alert_type', 'occurred_at'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('alerts');
  }
}
