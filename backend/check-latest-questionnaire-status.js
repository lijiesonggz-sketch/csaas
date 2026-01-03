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

  // 获取所有问卷任务，按创建时间倒序
  const result = await client.query(`
    SELECT id, status, progress, error_message, created_at, updated_at
    FROM ai_tasks
    WHERE type = 'questionnaire'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log(`\n📊 最近 ${result.rows.length} 个问卷任务状态：\n`);

  result.rows.forEach((task, idx) => {
    console.log(`${idx + 1}. 任务ID: ${task.id}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   进度: ${task.progress || 0}%`);
    console.log(`   创建时间: ${task.created_at}`);
    console.log(`   更新时间: ${task.updated_at}`);
    if (task.error_message) {
      console.log(`   ❌ 错误: ${task.error_message}`);
    }
    console.log('');
  });

  // 统计各状态数量
  const stats = await client.query(`
    SELECT status, COUNT(*) as count
    FROM ai_tasks
    WHERE type = 'questionnaire'
    GROUP BY status
  `);

  console.log('📈 问卷任务状态统计：');
  stats.rows.forEach(stat => {
    console.log(`   ${stat.status}: ${stat.count} 个`);
  });

  // 检查是否有正在处理的任务
  const processingTasks = result.rows.filter(t => t.status === 'processing');
  if (processingTasks.length > 0) {
    console.log(`\n⏳ 正在处理 ${processingTasks.length} 个问卷任务...`);
  }

  // 检查最新完成的任务
  const latestCompleted = await client.query(`
    SELECT id, created_at
    FROM ai_tasks
    WHERE type = 'questionnaire' AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (latestCompleted.rows.length > 0) {
    console.log(`\n✅ 最新完成的问卷任务: ${latestCompleted.rows[0].id}`);
    console.log(`   完成时间: ${latestCompleted.rows[0].created_at}`);
  }

  await client.end();
}

check().catch(console.error);
