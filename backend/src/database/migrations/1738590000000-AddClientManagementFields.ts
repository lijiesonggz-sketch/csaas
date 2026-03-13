import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'

export class AddClientManagementFields1738590000000 implements MigrationInterface {
  name = 'AddClientManagementFields1738590000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const organizationsExists = await queryRunner.hasTable('organizations')
    const tenantsExists = await queryRunner.hasTable('tenants')

    if (organizationsExists) {
      if (!(await queryRunner.hasColumn('organizations', 'contact_person'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'contact_person',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        )
      }

      if (!(await queryRunner.hasColumn('organizations', 'contact_email'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'contact_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          }),
        )
      }

      if (!(await queryRunner.hasColumn('organizations', 'industry_type'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'industry_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          }),
        )
      }

      if (!(await queryRunner.hasColumn('organizations', 'scale'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'scale',
            type: 'varchar',
            length: '50',
            isNullable: true,
          }),
        )
      }

      if (!(await queryRunner.hasColumn('organizations', 'status'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'trial'",
          }),
        )
      }

      if (!(await queryRunner.hasColumn('organizations', 'activated_at'))) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'activated_at',
            type: 'timestamp',
            isNullable: true,
          }),
        )
      }
    }

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
        foreignKeys: tenantsExists
          ? [
              {
                name: 'FK_client_groups_tenant',
                columnNames: ['tenant_id'],
                referencedTableName: 'tenants',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
              },
            ]
          : [],
        indices: [
          {
            name: 'IDX_client_groups_tenant_id',
            columnNames: ['tenant_id'],
          },
        ],
      }),
      true,
    )

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
        foreignKeys: organizationsExists
          ? [
              {
                name: 'FK_client_group_memberships_group',
                columnNames: ['group_id'],
                referencedTableName: 'client_groups',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
              },
              {
                name: 'FK_client_group_memberships_organization',
                columnNames: ['organization_id'],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
              },
            ]
          : [
              {
                name: 'FK_client_group_memberships_group',
                columnNames: ['group_id'],
                referencedTableName: 'client_groups',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
              },
            ],
        indices: [
          {
            name: 'IDX_memberships_group',
            columnNames: ['group_id'],
          },
          {
            name: 'IDX_memberships_organization',
            columnNames: ['organization_id'],
          },
          {
            name: 'UQ_memberships_group_org',
            columnNames: ['group_id', 'organization_id'],
            isUnique: true,
          },
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('client_group_memberships')) {
      await queryRunner.dropTable('client_group_memberships', true, true, true)
    }

    if (await queryRunner.hasTable('client_groups')) {
      await queryRunner.dropTable('client_groups', true, true, true)
    }

    if (await queryRunner.hasTable('organizations')) {
      if (await queryRunner.hasColumn('organizations', 'contact_person')) {
        await queryRunner.dropColumn('organizations', 'contact_person')
      }
      if (await queryRunner.hasColumn('organizations', 'contact_email')) {
        await queryRunner.dropColumn('organizations', 'contact_email')
      }
      if (await queryRunner.hasColumn('organizations', 'industry_type')) {
        await queryRunner.dropColumn('organizations', 'industry_type')
      }
      if (await queryRunner.hasColumn('organizations', 'scale')) {
        await queryRunner.dropColumn('organizations', 'scale')
      }
      if (await queryRunner.hasColumn('organizations', 'status')) {
        await queryRunner.dropColumn('organizations', 'status')
      }
      if (await queryRunner.hasColumn('organizations', 'activated_at')) {
        await queryRunner.dropColumn('organizations', 'activated_at')
      }
    }
  }
}
