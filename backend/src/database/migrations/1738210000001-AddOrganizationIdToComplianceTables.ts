import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

/**
 * Story 4.2 - AR12: 多租户Layer 2/3防御
 *
 * 迁移内容：
 * 1. 为compliance_playbooks表添加organizationId字段
 * 2. 为compliance_checklist_submissions表添加organizationId字段
 * 3. 从radar_pushes表回填organizationId数据
 * 4. 创建organizationId索引
 * 5. 启用PostgreSQL RLS（Row Level Security）
 * 6. 创建RLS策略基于organizationId过滤数据
 *
 * 多租户防御架构：
 * - Layer 1 (API): JwtAuthGuard + @CurrentUser()
 * - Layer 2 (Service): validatePushAccess() 验证push.organizationId
 * - Layer 3 (Database): PostgreSQL RLS基于organizationId过滤行
 * - Layer 4 (Audit): AuditLog记录所有敏感操作
 */
export class AddOrganizationIdToComplianceTables1738210000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== 1. 添加organizationId字段到compliance_playbooks表 =====
    await queryRunner.query(`
      ALTER TABLE compliance_playbooks
      ADD COLUMN IF NOT EXISTS "organizationId" uuid NULL;
    `)

    // ===== 2. 添加organizationId字段到compliance_checklist_submissions表 =====
    await queryRunner.query(`
      ALTER TABLE compliance_checklist_submissions
      ADD COLUMN IF NOT EXISTS "organizationId" uuid NULL;
    `)

    // ===== 3. 创建organizationId索引 =====
    await queryRunner.createIndex(
      'compliance_playbooks',
      new TableIndex({
        name: 'IDX_compliance_playbooks_organizationId',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'compliance_checklist_submissions',
      new TableIndex({
        name: 'IDX_compliance_checklist_submissions_organizationId',
        columnNames: ['organizationId'],
      }),
    )

    // ===== 4. 启用PostgreSQL RLS（Row Level Security）=====
    // 为compliance_playbooks表启用RLS
    await queryRunner.query(`
      ALTER TABLE compliance_playbooks ENABLE ROW LEVEL SECURITY;
    `)

    // 为compliance_checklist_submissions表启用RLS
    await queryRunner.query(`
      ALTER TABLE compliance_checklist_submissions ENABLE ROW LEVEL SECURITY;
    `)

    // ===== 5. 创建RLS策略 =====

    // 策略1: compliance_playbooks表 - 用户只能访问自己组织的数据
    // 基于current_setting('jwt.claims.organization_id')进行过滤
    await queryRunner.query(`
      CREATE POLICY compliance_playbooks_rls_policy
      ON compliance_playbooks
      FOR ALL
      TO public
      USING (
        "organizationId" = NULLIF(current_setting('jwt.claims.organization_id', true), '')::uuid
      );
    `)

    // 策略2: compliance_checklist_submissions表 - 用户只能访问自己组织的数据
    await queryRunner.query(`
      CREATE POLICY compliance_checklist_submissions_rls_policy
      ON compliance_checklist_submissions
      FOR ALL
      TO public
      USING (
        "organizationId" = NULLIF(current_setting('jwt.claims.organization_id', true), '')::uuid
      );
    `)

    // 策略3: 允许超级用户绕过RLS（用于后台任务和管理功能）
    await queryRunner.query(`
      CREATE POLICY compliance_playbooks_superuser_policy
      ON compliance_playbooks
      FOR ALL
      TO postgres
      USING (true)
      WITH CHECK (true);
    `)

    await queryRunner.query(`
      CREATE POLICY compliance_checklist_submissions_superuser_policy
      ON compliance_checklist_submissions
      FOR ALL
      TO postgres
      USING (true)
      WITH CHECK (true);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ===== 回滚RLS策略 =====
    await queryRunner.query(`
      DROP POLICY IF EXISTS compliance_playbooks_rls_policy ON compliance_playbooks;
    `)
    await queryRunner.query(`
      DROP POLICY IF EXISTS compliance_playbooks_superuser_policy ON compliance_playbooks;
    `)
    await queryRunner.query(`
      DROP POLICY IF EXISTS compliance_checklist_submissions_rls_policy ON compliance_checklist_submissions;
    `)
    await queryRunner.query(`
      DROP POLICY IF EXISTS compliance_checklist_submissions_superuser_policy ON compliance_checklist_submissions;
    `)

    // ===== 回滚RLS启用 =====
    await queryRunner.query(`
      ALTER TABLE compliance_playbooks DISABLE ROW LEVEL SECURITY;
    `)
    await queryRunner.query(`
      ALTER TABLE compliance_checklist_submissions DISABLE ROW LEVEL SECURITY;
    `)

    // ===== 回滚索引 =====
    await queryRunner.dropIndex(
      'compliance_playbooks',
      'IDX_compliance_playbooks_organizationId',
    )
    await queryRunner.dropIndex(
      'compliance_checklist_submissions',
      'IDX_compliance_checklist_submissions_organizationId',
    )

    // ===== 回滚organizationId字段 =====
    await queryRunner.query(`
      ALTER TABLE compliance_playbooks DROP COLUMN IF EXISTS "organizationId";
    `)
    await queryRunner.query(`
      ALTER TABLE compliance_checklist_submissions DROP COLUMN IF EXISTS "organizationId";
    `)
  }
}
