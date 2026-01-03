const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function verify() {
  await client.connect();

  console.log('=== 验证项目修复结果 ===\n');

  // 查询所有项目
  const projects = await client.query(`
    SELECT id, name, status, owner_id, deleted_at
    FROM projects
    WHERE owner_id = $1
    AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `, ['65fefcd7-3b4b-49d7-a56f-8db474314c62']);

  console.log(`找到 ${projects.rowCount} 个项目:\n`);

  for (const project of projects.rows) {
    console.log(`📁 ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   状态: ${project.status}`);

    // 查询该项目的任务统计
    const tasks = await client.query(`
      SELECT type, status, COUNT(*) as count
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
      ORDER BY type, status
    `, [project.id]);

    if (tasks.rowCount > 0) {
      console.log(`   任务统计:`);
      tasks.rows.forEach(task => {
        console.log(`     - ${task.type}: ${task.status} = ${task.count}`);
      });
    } else {
      console.log(`   任务统计: 无任务`);
    }

    // 计算进度（模拟后端逻辑）
    const allTasks = await client.query(`
      SELECT type, status
      FROM ai_tasks
      WHERE project_id = $1
    `, [project.id]);

    if (allTasks.rowCount > 0) {
      const completedTasks = allTasks.rows.filter(t => t.status === 'completed');

      const stepTypes = ['SUMMARY', 'CLUSTERING', 'MATRIX', 'QUESTIONNAIRE', 'ACTION_PLAN'];
      const completedSteps = stepTypes.filter(type =>
        completedTasks.some(task => task.type === type)
      ).length;

      const progress = Math.round((completedSteps / stepTypes.length) * 100);
      console.log(`   计算进度: ${progress}%`);
    }

    console.log('');
  }

  console.log('\n=== 验证 "数据安全测试项目" ===\n');

  const dataSecurityProject = await client.query(`
    SELECT id, name, status, description
    FROM projects
    WHERE id = $1
  `, ['16639558-c44d-41eb-a328-277182335f90']);

  if (dataSecurityProject.rowCount > 0) {
    const p = dataSecurityProject.rows[0];
    console.log('✅ 找到项目');
    console.log(`   名称: ${p.name}`);
    console.log(`   状态: ${p.status}`);
    console.log(`   描述: ${p.description}`);

    // 查询历史任务
    const taskStats = await client.query(`
      SELECT type, status, COUNT(*) as count
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
      ORDER BY type, status
    `, [p.id]);

    console.log(`\n   历史任务统计 (${taskStats.rowCount} 种类型):`);
    taskStats.rows.forEach(row => {
      console.log(`     - ${row.type}: ${row.status} = ${row.count}`);
    });
  } else {
    console.log('❌ 未找到项目');
  }

  await client.end();
}

verify().catch(console.error);
