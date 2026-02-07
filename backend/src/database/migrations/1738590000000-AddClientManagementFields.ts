import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

/**
 * Migration: Add Client Management Fields
 *
 * Adds fields to Organization for Story 6-2 (Consulting Company Bulk Client Management)
 * and creates ClientGroup and ClientGroupMembership tables.
 *
 * @story 6-2
 */
export class AddClientManagementFields1738590000000 implements MigrationInterface {
  name = 'AddClientManagementFields1738590000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to organizations table
    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'contact_person',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'contact_email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'industry_type',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'scale',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    )

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '50',
        default: "'trial'",
      }),
    )

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'activated_at',
        type: 'timestamp',
        isNullable: true,
      }),
    )

    // Create client_groups table
    await queryRunner.createTable(
      new Table({
        name: 'client_groups',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['tenant_id'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            columnNames: ['tenant_id'],
          },
        ],
      }),
      true,
    )

    // Create client_group_memberships table
    await queryRunner.createTable(
      new Table({
        name: 'client_group_memberships',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'group_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['group_id'],
            referencedTableName: 'client_groups',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            columnNames: ['group_id'],
          },
          {
            columnNames: ['organization_id'],
          },
          {
            columnNames: ['group_id', 'organization_id'],
            isUnique: true,
          },
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop client_group_memberships table
    await queryRunner.dropTable('client_group_memberships', true, true, true)

    // Drop client_groups table
    await queryRunner.dropTable('client_groups', true, true, true)

    // Remove columns from organizations table
    await queryRunner.dropColumn('organizations', 'contact_person')
    await queryRunner.dropColumn('organizations', 'contact_email')
    await queryRunner.dropColumn('organizations', 'industry_type')
    await queryRunner.dropColumn('organizations', 'scale')
    await queryRunner.dropColumn('organizations', 'status')
    await queryRunner.dropColumn('organizations', 'activated_at')
  }
}
