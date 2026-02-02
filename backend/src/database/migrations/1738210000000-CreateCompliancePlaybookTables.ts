import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

/**
 * Story 4.2: 合规风险分析与应对剧本生成
 *
 * 创建合规剧本相关表：
 * 1. compliance_playbooks - 合规剧本表
 * 2. compliance_checklist_submissions - 合规自查清单提交记录表
 */
export class CreateCompliancePlaybookTables1738210000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建 compliance_playbooks 表
    await queryRunner.createTable(
      new Table({
        name: 'compliance_playbooks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'pushId',
            type: 'uuid',
          },
          {
            name: 'checklistItems',
            type: 'json',
          },
          {
            name: 'solutions',
            type: 'json',
          },
          {
            name: 'reportTemplate',
            type: 'text',
          },
          {
            name: 'policyReference',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'generatedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    )

    // 为 compliance_playbooks 创建索引
    await queryRunner.createIndex(
      'compliance_playbooks',
      new TableIndex({
        name: 'IDX_compliance_playbooks_pushId',
        columnNames: ['pushId'],
      }),
    )

    // 2. 创建 compliance_checklist_submissions 表
    await queryRunner.createTable(
      new Table({
        name: 'compliance_checklist_submissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'pushId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'checkedItems',
            type: 'json',
          },
          {
            name: 'uncheckedItems',
            type: 'json',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'submittedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    )

    // 为 compliance_checklist_submissions 创建复合索引用于幂等性检查
    await queryRunner.createIndex(
      'compliance_checklist_submissions',
      new TableIndex({
        name: 'IDX_compliance_checklist_submissions_pushId_userId',
        columnNames: ['pushId', 'userId'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚 compliance_checklist_submissions 表
    await queryRunner.dropIndex(
      'compliance_checklist_submissions',
      'IDX_compliance_checklist_submissions_pushId_userId',
    )
    await queryRunner.dropTable('compliance_checklist_submissions')

    // 回滚 compliance_playbooks 表
    await queryRunner.dropIndex('compliance_playbooks', 'IDX_compliance_playbooks_pushId')
    await queryRunner.dropTable('compliance_playbooks')
  }
}
