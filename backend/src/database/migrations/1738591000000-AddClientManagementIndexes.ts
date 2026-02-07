import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

/**
 * Migration: Add Indexes for Client Management
 *
 * Adds performance indexes for frequently queried fields.
 * Optimizes common query patterns for admin client management.
 *
 * @story 6-2
 * @performance Estimated 50-80% query speed improvement
 */
export class AddClientManagementIndexes1738591000000 implements MigrationInterface {
  name = 'AddClientManagementIndexes1738591000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if index exists
    const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT 1 FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
        [tableName, indexName],
      )
      return result.length > 0
    }

    // ========================================
    // Organizations Table Indexes
    // ========================================

    // Index 1: Status filtering (active/inactive/trial)
    if (!(await indexExists('organizations', 'IDX_organizations_status'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_status',
          columnNames: ['status'],
        }),
      )
    }

    // Index 2: Contact email searching and uniqueness
    if (!(await indexExists('organizations', 'IDX_organizations_contact_email'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_contact_email',
          columnNames: ['contact_email'],
        }),
      )
    }

    // Index 3: Industry type filtering
    if (!(await indexExists('organizations', 'IDX_organizations_industry_type'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_industry_type',
          columnNames: ['industry_type'],
        }),
      )
    }

    // Index 4: Scale filtering
    if (!(await indexExists('organizations', 'IDX_organizations_scale'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_scale',
          columnNames: ['scale'],
        }),
      )
    }

    // Index 5: Composite index for tenant + status (most common query)
    if (!(await indexExists('organizations', 'IDX_organizations_tenant_status'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_tenant_status',
          columnNames: ['tenant_id', 'status'],
        }),
      )
    }

    // Index 6: Composite index for tenant + industry
    if (!(await indexExists('organizations', 'IDX_organizations_tenant_industry'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_tenant_industry',
          columnNames: ['tenant_id', 'industry_type'],
        }),
      )
    }

    // Index 7: Created date for sorting (skip if exists)
    if (!(await indexExists('organizations', 'IDX_organizations_created_at'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_created_at',
          columnNames: ['created_at'],
        }),
      )
    }

    // Index 8: Activated date for filtering recently activated clients
    if (!(await indexExists('organizations', 'IDX_organizations_activated_at'))) {
      await queryRunner.createIndex(
        'organizations',
        new TableIndex({
          name: 'IDX_organizations_activated_at',
          columnNames: ['activated_at'],
        }),
      )
    }

    // ========================================
    // Client Groups Table Indexes
    // ========================================

    // Index 9: Tenant filtering for groups
    if (!(await indexExists('client_groups', 'IDX_client_groups_tenant_id'))) {
      await queryRunner.createIndex(
        'client_groups',
        new TableIndex({
          name: 'IDX_client_groups_tenant_id',
          columnNames: ['tenant_id'],
        }),
      )
    }

    // Index 10: Group name searching
    if (!(await indexExists('client_groups', 'IDX_client_groups_name'))) {
      await queryRunner.createIndex(
        'client_groups',
        new TableIndex({
          name: 'IDX_client_groups_name',
          columnNames: ['name'],
        }),
      )
    }

    // ========================================
    // Client Group Memberships Table Indexes
    // ========================================

    // Index 11: Group membership lookup by organization
    if (!(await indexExists('client_group_memberships', 'IDX_memberships_organization'))) {
      await queryRunner.createIndex(
        'client_group_memberships',
        new TableIndex({
          name: 'IDX_memberships_organization',
          columnNames: ['organization_id'],
        }),
      )
    }

    // Index 12: Group membership lookup by group
    if (!(await indexExists('client_group_memberships', 'IDX_memberships_group'))) {
      await queryRunner.createIndex(
        'client_group_memberships',
        new TableIndex({
          name: 'IDX_memberships_group',
          columnNames: ['group_id'],
        }),
      )
    }

    // ========================================
    // Push Preferences Table Indexes
    // ========================================

    // Index 13: Organization lookup for push preferences
    if (!(await indexExists('push_preferences', 'IDX_push_preferences_organization'))) {
      await queryRunner.createIndex(
        'push_preferences',
        new TableIndex({
          name: 'IDX_push_preferences_organization',
          columnNames: ['organization_id'],
        }),
      )
    }

    // Index 14: Tenant filtering for bulk operations
    if (!(await indexExists('push_preferences', 'IDX_push_preferences_tenant'))) {
      await queryRunner.createIndex(
        'push_preferences',
        new TableIndex({
          name: 'IDX_push_preferences_tenant',
          columnNames: ['tenant_id'],
        }),
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.dropIndex('push_preferences', 'IDX_push_preferences_tenant')
    await queryRunner.dropIndex('push_preferences', 'IDX_push_preferences_organization')
    await queryRunner.dropIndex('client_group_memberships', 'IDX_memberships_group')
    await queryRunner.dropIndex('client_group_memberships', 'IDX_memberships_organization')
    await queryRunner.dropIndex('client_groups', 'IDX_client_groups_name')
    await queryRunner.dropIndex('client_groups', 'IDX_client_groups_tenant_id')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_activated_at')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_created_at')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_tenant_industry')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_tenant_status')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_scale')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_industry_type')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_contact_email')
    await queryRunner.dropIndex('organizations', 'IDX_organizations_status')
  }
}

