const { Client } = require('pg');

async function cleanStuckTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 将卡住的任务标记为失败
    const result = await client.query(`
      UPDATE ai_tasks
      SET status = 'failed',
        error_message = 'Task was stuck and manually cleaned',
        updated_at = CURRENT_TIMESTAMP
      WHERE type = 'action_plan'
      AND status = 'processing'
      AND created_at < NOW() - INTERVAL '10 minutes'
      RETURNING id
    `);

    console.log(`标记了 ${result.rowCount} 个卡住的任务为失败`);
    result.rows.forEach(r => console.log('  -', r.id));

    // 删除相关的措施记录
    for (const task of result.rows) {
      const measuresResult = await client.query(`
        DELETE FROM action_plan_measures
        WHERE task_id = $1
      `, [task.id]);
      if (measuresResult.rowCount > 0) {
        console.log(`  删除了 ${measuresResult.rowCount} 条相关措施记录`);
      }
    }

    // 显示所有 action_plan 任务
    const tasks = await client.query(`
      SELECT id, status, progress, created_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n当前 action_plan 任务:');
    tasks.rows.forEach(t => {
      console.log(`  ${t.id.substring(0, 8)}... - ${t.status} - ${Math.round(t.progress)}%`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

cleanStuckTasks();
