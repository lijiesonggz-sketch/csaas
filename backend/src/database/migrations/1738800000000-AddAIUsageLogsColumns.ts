import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class AddAIUsageLogsColumns1738800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_usage_logs'))) {
      return
    }

    const addCol = async (column: TableColumn): Promise<void> => {
      if (!(await queryRunner.hasColumn('ai_usage_logs', column.name))) {
        await queryRunner.addColumn('ai_usage_logs', column)
      }
    }

    await addCol(
      new TableColumn({
        name: 'model_name',
        type: 'varchar',
        length: '50',
        default: "'qwen-max'",
      }),
    )
    await addCol(
      new TableColumn({
        name: 'input_tokens',
        type: 'integer',
        default: 0,
      }),
    )
    await addCol(
      new TableColumn({
        name: 'output_tokens',
        type: 'integer',
        default: 0,
      }),
    )
    await addCol(
      new TableColumn({
        name: 'request_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    )
    await addCol(
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp with time zone',
        default: 'NOW()',
      }),
    )

    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN task_type TYPE varchar(50),
      ALTER COLUMN task_type SET NOT NULL;
    `)

    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN organization_id SET NOT NULL;
    `)

    const indexExists = async (name: string): Promise<boolean> => {
      const rows = await queryRunner.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='ai_usage_logs' AND indexname=$1`,
        [name],
      )
      return rows.length > 0
    }

    if (!(await indexExists('IDX_ai_usage_org_created'))) {
      await queryRunner.createIndex(
        'ai_usage_logs',
        new TableIndex({
          name: 'IDX_ai_usage_org_created',
          columnNames: ['organization_id', 'created_at'],
        }),
      )
    }

    if (!(await indexExists('IDX_ai_usage_task_type'))) {
      await queryRunner.createIndex(
        'ai_usage_logs',
        new TableIndex({
          name: 'IDX_ai_usage_task_type',
          columnNames: ['task_type'],
        }),
      )
    }

    if (await queryRunner.hasTable('organizations')) {
      const hasFk = await queryRunner.query(`
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FK_ai_usage_organization'
      `)
      if (hasFk.length === 0) {
        await queryRunner.createForeignKey(
          'ai_usage_logs',
          new TableForeignKey({
            name: 'FK_ai_usage_organization',
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        )
      }
    }

    await queryRunner.query(`COMMENT ON TABLE ai_usage_logs IS 'AI usage logs'`)
    await queryRunner.query(
      `COMMENT ON COLUMN ai_usage_logs.task_type IS 'Task type for usage tracking'`,
    )
    await queryRunner.query(`COMMENT ON COLUMN ai_usage_logs.cost IS 'Cost amount'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_usage_logs'))) {
      return
    }

    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP CONSTRAINT IF EXISTS "FK_ai_usage_organization"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_usage_task_type"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_usage_org_created"`)

    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN organization_id DROP NOT NULL;
    `)
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ALTER COLUMN task_type DROP NOT NULL;
    `)

    for (const col of ['updated_at', 'request_id', 'output_tokens', 'input_tokens', 'model_name']) {
      if (await queryRunner.hasColumn('ai_usage_logs', col)) {
        await queryRunner.dropColumn('ai_usage_logs', col)
      }
    }
  }
}
