import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddDetailsAndReqToAuditLogs1737901000000 implements MigrationInterface {
  name = 'AddDetailsAndReqToAuditLogs1737901000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if details column exists
    const table = await queryRunner.getTable('audit_logs')
    const hasDetailsColumn = table?.columns.find((col) => col.name === 'details')
    const hasReqColumn = table?.columns.find((col) => col.name === 'req')

    if (!hasDetailsColumn) {
      await queryRunner.addColumn(
        'audit_logs',
        new TableColumn({
          name: 'details',
          type: 'jsonb',
          isNullable: true,
        }),
      )
    }

    if (!hasReqColumn) {
      await queryRunner.addColumn(
        'audit_logs',
        new TableColumn({
          name: 'req',
          type: 'jsonb',
          isNullable: true,
        }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('audit_logs', 'req')
    await queryRunner.dropColumn('audit_logs', 'details')
  }
}
