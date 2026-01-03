const { Client } = require('pg');

async function checkCompletedTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskId = 'c2b1b86d-c8e3-4382-8e8f-3f7c9e1d2b5a';

    // 获取任务详情
    const task = await client.query(`
      SELECT * FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    console.log('=== 任务详情 ===');
    console.log('ID:', task.rows[0].id);
    console.log('Status:', task.rows[0].status);
    console.log('Progress:', task.rows[0].progress);
    console.log('Result:', JSON.stringify(task.rows[0].result, null, 2));
    console.log('Input:', JSON.stringify(task.rows[0].input, null, 2));

    // 获取措施
    const measures = await client.query(`
      SELECT id, cluster_name, title
      FROM action_plan_measures
      WHERE task_id = $1
      ORDER BY priority, sort_order
    `, [taskId]);

    console.log('\n=== 措施数量 ===');
    console.log('Total:', measures.rows.length);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkCompletedTask();
