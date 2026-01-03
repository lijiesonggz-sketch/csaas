const { Client } = require('pg');

async function findCompletedTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    // 查询所有完成的 action_plan 任务
    const tasks = await client.query(`
      SELECT id, status, progress, result, created_at, completed_at
      FROM ai_tasks
      WHERE type = 'action_plan'
      AND status = 'completed'
      ORDER BY completed_at DESC
    `);

    console.log(`找到 ${tasks.rows.length} 个已完成的 action_plan 任务\n`);

    if (tasks.rows.length === 0) {
      console.log('没有已完成的任务');
      return;
    }

    for (const task of tasks.rows) {
      console.log('=== Task ===');
      console.log('ID:', task.id);
      console.log('Completed:', task.completed_at);
      console.log('Result:', JSON.stringify(task.result, null, 2));

      // 获取措施数量
      const measures = await client.query(`
        SELECT COUNT(*) as count
        FROM action_plan_measures
        WHERE task_id = $1
      `, [task.id]);

      console.log('Measures count:', measures.rows[0].count);
      console.log('---\n');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

findCompletedTasks();
