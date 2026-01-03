const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();

  // 检查已完成的问卷任务属于哪个项目
  const result = await client.query(`
    SELECT id, project_id, type, status, created_at
    FROM ai_tasks
    WHERE type = 'questionnaire' AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 3
  `);

  console.log('📊 已完成的问卷任务及其项目ID：\n');

  result.rows.forEach((task, idx) => {
    console.log(`${idx + 1}. 任务ID: ${task.id}`);
    console.log(`   项目ID: ${task.project_id}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   创建时间: ${task.created_at}`);
    console.log('');
  });

  // 检查项目 8e815c62-f034-4497-8eab-a6f37d42b3d9 的问卷任务
  const projectTasks = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE project_id = '8e815c62-f034-4497-8eab-a6f37d42b3d9' AND type = 'questionnaire'
    ORDER BY created_at DESC
  `);

  console.log(`\n📁 项目 8e815c62-f034-4497-8eab-a6f37d42b3d9 的问卷任务：`);
  console.log(`   总数: ${projectTasks.rows.length} 个\n`);

  projectTasks.rows.forEach((task, idx) => {
    console.log(`${idx + 1}. ${task.id.substring(0, 8)}... - ${task.status} (${task.created_at})`);
  });

  // 如果有已完成的，检查数据结构
  if (projectTasks.rows.length > 0) {
    const latestTask = projectTasks.rows[0];
    const fullTask = await client.query(`
      SELECT id, status, result
      FROM ai_tasks
      WHERE id = $1
    `, [latestTask.id]);

    if (fullTask.rows.length > 0) {
      const task = fullTask.rows[0];
      console.log(`\n📦 最新任务数据结构检查：`);
      console.log(`   任务ID: ${task.id}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   有 result: ${!!task.result}`);

      if (task.result) {
        console.log(`   result keys: ${Object.keys(task.result)}`);
        if (task.result.content) {
          console.log(`   content 类型: ${typeof task.result.content}`);

          try {
            const content = typeof task.result.content === 'string'
              ? JSON.parse(task.result.content)
              : task.result.content;

            console.log(`   解析后 keys: ${Object.keys(content)}`);

            if (content.questionnaire) {
              console.log(`   ✅ questionnaire 数量: ${content.questionnaire.length} 题`);
            }
          } catch (e) {
            console.log(`   ❌ 解析失败: ${e.message}`);
          }
        }
      }
    }
  }

  await client.end();
}

check().catch(console.error);
