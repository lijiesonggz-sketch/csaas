const { Client } = require('pg');

async function cleanFailedTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 删除失败的 action_plan 任务
    const result = await client.query(`
      DELETE FROM ai_tasks
      WHERE type = 'action_plan'
      AND status = 'failed'
      AND created_at > NOW() - INTERVAL '1 day'
      RETURNING id
    `);

    console.log(`删除了 ${result.rowCount} 个失败的 action_plan 任务`);
    result.rows.forEach(r => console.log('  -', r.id));

    // 同时删除相关的 action_plan_measures
    for (const task of result.rows) {
      const measuresResult = await client.query(`
        DELETE FROM action_plan_measures
        WHERE task_id = $1
      `, [task.id]);
      if (measuresResult.rowCount > 0) {
        console.log(`  删除了 ${measuresResult.rowCount} 条相关措施记录`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

cleanFailedTasks();
