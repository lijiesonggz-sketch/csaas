import { MigrationInterface, QueryRunner } from 'typeorm'

export class MigrateHistoricalData1700000000001 implements MigrationInterface {
  name = 'MigrateHistoricalData1700000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建"数据安全测试项目"（使用现有用户作为owner）
    // 先查找一个现有的用户
    const users = await queryRunner.query(`SELECT id FROM users LIMIT 1`)

    if (users.length === 0) {
      console.log('⚠️  没有找到用户，跳过历史数据迁移')
      return
    }

    const userId = users[0].id
    console.log(`✅ 使用用户 ${userId} 作为"数据安全测试项目"的owner`)

    // 检查项目是否已存在
    const existingProject = await queryRunner.query(
      `SELECT id FROM projects WHERE name = '数据安全测试项目' AND owner_id = $1`,
      [userId],
    )

    let projectId: string

    if (existingProject.length === 0) {
      // 创建新项目
      const result = await queryRunner.query(
        `INSERT INTO projects (id, name, description, client_name, standard_name, owner_id, status, metadata, created_at, updated_at)
         VALUES (uuid_generate_v4(), '数据安全测试项目', '历史数据迁移项目', '历史客户', '通用标准', $1, 'completed', '{}', NOW(), NOW())
         RETURNING id`,
        [userId],
      )
      projectId = result[0].id

      // 为用户添加项目成员关系
      await queryRunner.query(
        `INSERT INTO project_members (project_id, user_id, role, added_at)
         VALUES ($1, $2, 'OWNER', NOW())`,
        [projectId, userId],
      )
    } else {
      projectId = existingProject[0].id
    }

    // 2. 将所有无project_id的ai_tasks关联到该项目
    await queryRunner.query(
      `UPDATE ai_tasks
       SET project_id = $1
       WHERE project_id IS NULL`,
      [projectId],
    )

    console.log(`✅ 历史数据迁移完成：`)
    console.log(`   项目ID: ${projectId}`)
    console.log(`   所有旧的ai_tasks已关联到"数据安全测试项目"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回退：将project_id设置为NULL
    await queryRunner.query(
      `UPDATE ai_tasks
       SET project_id = NULL
       WHERE project_id IN (
         SELECT id FROM projects WHERE name = '数据安全测试项目' AND owner_id = '00000000-0000-0000-0000-000000000001'
       )`,
    )

    // 可选：删除"数据安全测试项目"（谨慎操作）
    // await queryRunner.query(`DELETE FROM projects WHERE name = '数据安全测试项目' AND owner_id = '00000000-0000-0000-0000-000000000001'`)

    console.log(`⏪ 历史数据迁移已回退`)
  }
}
