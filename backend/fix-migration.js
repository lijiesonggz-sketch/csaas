const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fix() {
  await client.connect();

  console.log('=== 开始修复数据迁移 ===\n');

  // 查询两个项目的ID
  const defaultProject = await client.query(`
    SELECT id, name
    FROM projects
    WHERE name = 'Default Project'
  `);

  const dataSecurityProject = await client.query(`
    SELECT id, name
    FROM projects
    WHERE name = '数据安全测试项目'
  `);

  if (defaultProject.rowCount === 0 || dataSecurityProject.rowCount === 0) {
    console.log('错误: 找不到项目');
    await client.end();
    return;
  }

  const defaultProjectId = defaultProject.rows[0].id;
  const dataSecurityProjectId = dataSecurityProject.rows[0].id;

  console.log(`Default Project ID: ${defaultProjectId}`);
  console.log(`数据安全测试项目 ID: ${dataSecurityProjectId}\n`);

  // 查询Default Project中的所有任务
  const tasks = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at
  `, [defaultProjectId]);

  console.log(`Default Project 中有 ${tasks.rowCount} 个任务\n`);

  // 方案：直接删除新建的"数据安全测试项目"，将"Default Project"重命名
  console.log('=== 方案：重命名 Default Project ===\n');

  await client.query('BEGIN');

  try {
    // 删除新建的空项目
    await client.query(`
      DELETE FROM projects
      WHERE id = $1
    `, [dataSecurityProjectId]);

    console.log('✓ 删除了空的"数据安全测试项目"');

    // 重命名 Default Project
    await client.query(`
      UPDATE projects
      SET name = '数据安全测试项目',
          description = '历史数据迁移项目',
          status = 'completed',
          client_name = '历史客户',
          standard_name = '通用标准'
      WHERE id = $1
    `, [defaultProjectId]);

    console.log('✓ 将 "Default Project" 重命名为 "数据安全测试项目"');

    await client.query('COMMIT');
    console.log('\n✅ 迁移完成！');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ 迁移失败:', error.message);
  }

  // 验证结果
  console.log('\n=== 验证结果 ===');

  const verifyProject = await client.query(`
    SELECT id, name, status, description, client_name, standard_name
    FROM projects
    WHERE id = $1
  `, [defaultProjectId]);

  if (verifyProject.rowCount > 0) {
    const p = verifyProject.rows[0];
    console.log('\n项目信息:');
    console.log(`  名称: ${p.name}`);
    console.log(`  状态: ${p.status}`);
    console.log(`  描述: ${p.description}`);
    console.log(`  客户: ${p.client_name}`);
    console.log(`  标准: ${p.standard_name}`);

    // 查询任务统计
    const taskStats = await client.query(`
      SELECT type, status, COUNT(*) as count
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
      ORDER BY type, status
    `, [defaultProjectId]);

    console.log('\n任务统计:');
    taskStats.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.status} = ${row.count}`);
    });
  }

  await client.end();
}

fix().catch(console.error);
