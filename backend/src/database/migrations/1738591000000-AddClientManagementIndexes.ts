import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

export class AddClientManagementIndexes1738591000000 implements MigrationInterface {
  name = 'AddClientManagementIndexes1738591000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
        [tableName, indexName],
      )
      return result.length > 0
    }

    if (await queryRunner.hasTable('organizations')) {
      if (await queryRunner.hasColumn('organizations', 'status')) {
        if (!(await indexExists('organizations', 'IDX_organizations_status'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({ name: 'IDX_organizations_status', columnNames: ['status'] }),
          )
        }
      }

      if (await queryRunner.hasColumn('organizations', 'contact_email')) {
        if (!(await indexExists('organizations', 'IDX_organizations_contact_email'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({ name: 'IDX_organizations_contact_email', columnNames: ['contact_email'] }),
          )
        }
      }

      if (await queryRunner.hasColumn('organizations', 'industry_type')) {
        if (!(await indexExists('organizations', 'IDX_organizations_industry_type'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({ name: 'IDX_organizations_industry_type', columnNames: ['industry_type'] }),
          )
        }
      }

      if (await queryRunner.hasColumn('organizations', 'scale')) {
        if (!(await indexExists('organizations', 'IDX_organizations_scale'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({ name: 'IDX_organizations_scale', columnNames: ['scale'] }),
          )
        }
      }

      if (
        (await queryRunner.hasColumn('organizations', 'tenant_id')) &&
        (await queryRunner.hasColumn('organizations', 'status'))
      ) {
        if (!(await indexExists('organizations', 'IDX_organizations_tenant_status'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({
              name: 'IDX_organizations_tenant_status',
              columnNames: ['tenant_id', 'status'],
            }),
          )
        }
      }

      if (
        (await queryRunner.hasColumn('organizations', 'tenant_id')) &&
        (await queryRunner.hasColumn('organizations', 'industry_type'))
      ) {
        if (!(await indexExists('organizations', 'IDX_organizations_tenant_industry'))) {
          await queryRunner.createIndex(
            'organizations',
            new TableIndex({
              name: 'IDX_organizations_tenant_industry',
              columnNames: ['tenant_id', 'industry_type'],
            }),
          )
        }
      }

      if (
        (await queryRunner.hasColumn('organizations', 'created_at')) &&
        !(await indexExists('organizations', 'IDX_organizations_created_at'))
      ) {
        await queryRunner.createIndex(
          'organizations',
          new TableIndex({ name: 'IDX_organizations_created_at', columnNames: ['created_at'] }),
        )
      }

      if (
        (await queryRunner.hasColumn('organizations', 'activated_at')) &&
        !(await indexExists('organizations', 'IDX_organizations_activated_at'))
      ) {
        await queryRunner.createIndex(
          'organizations',
          new TableIndex({ name: 'IDX_organizations_activated_at', columnNames: ['activated_at'] }),
        )
      }
    }

    if (await queryRunner.hasTable('client_groups')) {
      if (
        (await queryRunner.hasColumn('client_groups', 'tenant_id')) &&
        !(await indexExists('client_groups', 'IDX_client_groups_tenant_id'))
      ) {
        await queryRunner.createIndex(
          'client_groups',
          new TableIndex({ name: 'IDX_client_groups_tenant_id', columnNames: ['tenant_id'] }),
        )
      }

      if (
        (await queryRunner.hasColumn('client_groups', 'name')) &&
        !(await indexExists('client_groups', 'IDX_client_groups_name'))
      ) {
        await queryRunner.createIndex(
          'client_groups',
          new TableIndex({ name: 'IDX_client_groups_name', columnNames: ['name'] }),
        )
      }
    }

    if (await queryRunner.hasTable('client_group_memberships')) {
      if (
        (await queryRunner.hasColumn('client_group_memberships', 'organization_id')) &&
        !(await indexExists('client_group_memberships', 'IDX_memberships_organization'))
      ) {
        await queryRunner.createIndex(
          'client_group_memberships',
          new TableIndex({ name: 'IDX_memberships_organization', columnNames: ['organization_id'] }),
        )
      }

      if (
        (await queryRunner.hasColumn('client_group_memberships', 'group_id')) &&
        !(await indexExists('client_group_memberships', 'IDX_memberships_group'))
      ) {
        await queryRunner.createIndex(
          'client_group_memberships',
          new TableIndex({ name: 'IDX_memberships_group', columnNames: ['group_id'] }),
        )
      }
    }

    if (await queryRunner.hasTable('push_preferences')) {
      if (
        (await queryRunner.hasColumn('push_preferences', 'organization_id')) &&
        !(await indexExists('push_preferences', 'IDX_push_preferences_organization'))
      ) {
        await queryRunner.createIndex(
          'push_preferences',
          new TableIndex({ name: 'IDX_push_preferences_organization', columnNames: ['organization_id'] }),
        )
      }

      if (
        (await queryRunner.hasColumn('push_preferences', 'tenant_id')) &&
        !(await indexExists('push_preferences', 'IDX_push_preferences_tenant'))
      ) {
        await queryRunner.createIndex(
          'push_preferences',
          new TableIndex({ name: 'IDX_push_preferences_tenant', columnNames: ['tenant_id'] }),
        )
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dropIndexIfExists = async (table: string, index: string): Promise<void> => {
      if (!(await queryRunner.hasTable(table))) {
        return
      }
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`)
    }

    await dropIndexIfExists('push_preferences', 'IDX_push_preferences_tenant')
    await dropIndexIfExists('push_preferences', 'IDX_push_preferences_organization')
    await dropIndexIfExists('client_group_memberships', 'IDX_memberships_group')
    await dropIndexIfExists('client_group_memberships', 'IDX_memberships_organization')
    await dropIndexIfExists('client_groups', 'IDX_client_groups_name')
    await dropIndexIfExists('client_groups', 'IDX_client_groups_tenant_id')
    await dropIndexIfExists('organizations', 'IDX_organizations_activated_at')
    await dropIndexIfExists('organizations', 'IDX_organizations_created_at')
    await dropIndexIfExists('organizations', 'IDX_organizations_tenant_industry')
    await dropIndexIfExists('organizations', 'IDX_organizations_tenant_status')
    await dropIndexIfExists('organizations', 'IDX_organizations_scale')
    await dropIndexIfExists('organizations', 'IDX_organizations_industry_type')
    await dropIndexIfExists('organizations', 'IDX_organizations_contact_email')
    await dropIndexIfExists('organizations', 'IDX_organizations_status')
  }
}
