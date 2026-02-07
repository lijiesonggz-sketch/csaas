import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration: Create ai_usage_logs placeholder table
 *
 * Creates a placeholder table for AI usage tracking.
 * This resolves circular dependency with Story 7.4.
 * Story 7.4 will add full schema (input_tokens, output_tokens, model_name, etc.)
 *
 * @story 7-1
 * @module backend/src/database/migrations
 */
export class CreateAiUsageLogsPlaceholder1738600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_usage_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'task_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
        indices: [
          {
            name: 'IDX_ai_usage_logs_organization_id',
            columnNames: ['organization_id'],
          },
          {
            name: 'IDX_ai_usage_logs_created_at',
            columnNames: ['created_at'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ai_usage_logs');
  }
}
