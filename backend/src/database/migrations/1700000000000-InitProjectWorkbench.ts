import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitProjectWorkbench1700000000000 implements MigrationInterface {
  name = 'InitProjectWorkbench1700000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 扩展 projects 表
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN client_name VARCHAR(100),
      ADD COLUMN standard_name VARCHAR(100);
    `)

    // 创建索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
    `)

    // 2. 创建 project_members 表
    await queryRunner.query(`
      CREATE TABLE project_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW(),
        added_by UUID REFERENCES users(id),
        UNIQUE(project_id, user_id)
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    `)

    // 3. 修改 ai_tasks 表（添加版本管理字段）
    await queryRunner.query(`
      ALTER TABLE ai_tasks
      ADD COLUMN backup_result JSONB,
      ADD COLUMN backup_created_at TIMESTAMP;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_tasks_backup
      ON ai_tasks(project_id, type)
      WHERE backup_result IS NOT NULL;
    `)

    // 4. 创建 system_users 表
    await queryRunner.query(`
      CREATE TABLE system_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(100) UNIQUE,
        name VARCHAR(100),
        type VARCHAR(50) DEFAULT 'SYSTEM',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // 插入系统账号
    await queryRunner.query(`
      INSERT INTO system_users (id, email, name, type)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'system@csaas.local',
        'System Account',
        'SYSTEM'
      )
      ON CONFLICT (email) DO NOTHING;
    `)

    // 5. 扩展 audit_logs 表
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
      ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS error_message TEXT;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回退操作（按相反顺序）

    // 5. 回退 audit_logs 表
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_action;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_project;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_user;`)
    await queryRunner.query(`
      ALTER TABLE audit_logs
      DROP COLUMN IF EXISTS error_message,
      DROP COLUMN IF EXISTS success,
      DROP COLUMN IF EXISTS project_id;
    `)

    // 4. 删除 system_users 表
    await queryRunner.query(`DELETE FROM system_users WHERE email = 'system@csaas.local';`)
    await queryRunner.query(`DROP TABLE IF EXISTS system_users;`)

    // 3. 回退 ai_tasks 表
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_tasks_backup;`)
    await queryRunner.query(`
      ALTER TABLE ai_tasks
      DROP COLUMN IF EXISTS backup_created_at,
      DROP COLUMN IF EXISTS backup_result;
    `)

    // 2. 删除 project_members 表
    await queryRunner.query(`DROP INDEX IF EXISTS idx_project_members_user;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_project_members_project;`)
    await queryRunner.query(`DROP TABLE IF EXISTS project_members;`)

    // 1. 回退 projects 表
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_tenant;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_status;`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_owner;`)
    await queryRunner.query(`
      ALTER TABLE projects
      DROP COLUMN IF EXISTS standard_name,
      DROP COLUMN IF EXISTS client_name;
    `)
  }
}
