import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm'

export class AddOrganizationIdToAuditLogs1737900000000 implements MigrationInterface {
  name = 'AddOrganizationIdToAuditLogs1737900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const table = await queryRunner.getTable('audit_logs')
    const hasColumn = table?.columns.find((col) => col.name === 'organization_id')

    if (!hasColumn) {
      // Add organization_id column
      await queryRunner.addColumn(
        'audit_logs',
        new TableColumn({
          name: 'organization_id',
          type: 'uuid',
          isNullable: true,
        }),
      )

      // Add foreign key constraint
      await queryRunner.createForeignKey(
        'audit_logs',
        new TableForeignKey({
          name: 'FK_audit_logs_organization',
          columnNames: ['organization_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'organizations',
          onDelete: 'SET NULL',
        }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('audit_logs')
    const foreignKey = table?.foreignKeys.find((fk) => fk.name === 'FK_audit_logs_organization')

    if (foreignKey) {
      await queryRunner.dropForeignKey('audit_logs', foreignKey)
    }

    // Drop column
    await queryRunner.dropColumn('audit_logs', 'organization_id')
  }
}
