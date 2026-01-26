const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'csaas',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

(async () => {
  await client.connect();
  const taskId = '70aa5fdc-6923-4ad1-8082-9a3b33238a4e';

  try {
    // 检查任务状态
    const taskResult = await client.query(
      'SELECT id, type, status, progress, error_message, created_at, updated_at, result FROM ai_tasks WHERE id = $1',
      [taskId]
    );

    console.log('📋 任务状态:');
    if (taskResult.rows.length > 0) {
      console.log(JSON.stringify(taskResult.rows[0], null, 2));
    } else {
      console.log('❌ 任务不存在');
    }

    // 检查相关事件
    const eventsResult = await client.query(
      'SELECT * FROM ai_generation_events WHERE task_id = $1 ORDER BY created_at DESC LIMIT 20',
      [taskId]
    );

    console.log('\n📊 相关事件 (最近20条):');
    eventsResult.rows.forEach(event => {
      const metadata = event.metadata ? JSON.stringify(event.metadata).substring(0, 100) : '';
      console.log(`  ${event.created_at} | ${event.event_type} | ${metadata}`);
    });

    // 检查成本追踪
    const costResult = await client.query(
      'SELECT * FROM ai_cost_tracking WHERE task_id = $1',
      [taskId]
    );

    console.log('\n💰 成本追踪:');
    console.log(JSON.stringify(costResult.rows, null, 2));

    // 检查所有问卷类型的任务
    const allQTasks = await client.query(
      "SELECT id, status, progress, error_message, created_at FROM ai_tasks WHERE type = 'questionnaire_generation' ORDER BY created_at DESC LIMIT 5"
    );

    console.log('\n📝 最近的问卷生成任务:');
    allQTasks.rows.forEach(task => {
      console.log(`  ${task.id} | ${task.status} | ${task.progress}% | ${task.created_at}`);
      if (task.error_message) {
        console.log(`    ❌ ${task.error_message}`);
      }
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await client.end();
  }
})();
