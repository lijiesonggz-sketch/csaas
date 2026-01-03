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

  // Get the processing task
  const result = await client.query(`
    SELECT id, status, progress, error_message, created_at, updated_at
    FROM ai_tasks
    WHERE id = 'b39d02c6-431a-4605-9537-d3aeea5ccbd7'
  `);

  if (result.rows.length > 0) {
    const task = result.rows[0];
    console.log('📊 最新问卷任务状态：');
    console.log(`   任务ID: ${task.id}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   进度: ${task.progress || 0}%`);
    console.log(`   创建时间: ${task.created_at}`);
    console.log(`   更新时间: ${task.updated_at}`);
    if (task.error_message) {
      console.log(`   错误: ${task.error_message}`);
    }

    // Check how many tasks were created around the same time
    const nearbyTasks = await client.query(`
      SELECT id, status, created_at
      FROM ai_tasks
      WHERE type = 'questionnaire'
        AND created_at >= '2026-01-02 16:43:00'
      ORDER BY created_at DESC
    `);

    console.log(`\n📋 16:43之后创建的问卷任务数量: ${nearbyTasks.rows.length}`);
    nearbyTasks.rows.forEach((t, idx) => {
      console.log(`   ${idx + 1}. ${t.id.substring(0, 8)}... - ${t.status} (${t.created_at})`);
    });

    if (nearbyTasks.rows.length === 1) {
      console.log('\n✅ 确认：只创建了1个任务，useRef修复成功！');
    } else {
      console.log('\n❌ 警告：仍然创建了多个任务！');
    }
  } else {
    console.log('未找到该任务');
  }

  await client.end();
}

check().catch(console.error);
