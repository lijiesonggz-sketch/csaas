import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add AI Usage Logs Columns
 *
 * Extends the placeholder ai_usage_logs table created in Story 7.1
 * with complete schema for AI cost tracking.
 *
 * @story 7-4
 * @module backend/src/database/migrations
 */
export class AddAIUsageLogsColumns1738800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns
    await queryRunner.addColumns('ai_usage_logs', [
      new TableColumn({
        name: 'model_name',
        type: 'varchar',
        length: '50',
        default: "'qwen-max'",
      }),
      new TableColumn({
        name: 'input_tokens',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'output_tokens',
        type: 'integer',
        default: 0,
      }),
      new TableColumn({
        name: 'request_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp with time zone',
        default: 'NOW()',
      }),
    ]);

    // Update task_type column to use enum
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN task_type TYPE varchar(50),
      ALTER COLUMN task_type SET NOT NULL;
    `);

    // Update organization_id to NOT NULL
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN organization_id SET NOT NULL;
    `);

    // Create composite index for organization_id and created_at
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({
        name: 'IDX_ai_usage_org_created',
        columnNames: ['organization_id', 'created_at'],
      }),
    );

    // Create index for task_type
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({
        name: 'IDX_ai_usage_task_type',
        columnNames: ['task_type'],
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'ai_usage_logs',
      new TableForeignKey({
        name: 'FK_ai_usage_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE ai_usage_logs IS 'AI调用成本追踪日志';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN ai_usage_logs.task_type IS '任务类型: tech_analysis, industry_analysis, compliance_analysis, roi_calculation, playbook_generation';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN ai_usage_logs.cost IS '成本(元),精确到分';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('ai_usage_logs', 'FK_ai_usage_organization');

    // Drop indexes
    await queryRunner.dropIndex('ai_usage_logs', 'IDX_ai_usage_task_type');
    await queryRunner.dropIndex('ai_usage_logs', 'IDX_ai_usage_org_created');

    // Revert organization_id to nullable
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN organization_id DROP NOT NULL;
    `);

    // Revert task_type to nullable
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN task_type DROP NOT NULL;
    `);

    // Drop columns
    await queryRunner.dropColumn('ai_usage_logs', 'updated_at');
    await queryRunner.dropColumn('ai_usage_logs', 'request_id');
    await queryRunner.dropColumn('ai_usage_logs', 'output_tokens');
    await queryRunner.dropColumn('ai_usage_logs', 'input_tokens');
    await queryRunner.dropColumn('ai_usage_logs', 'model_name');
  }
}
