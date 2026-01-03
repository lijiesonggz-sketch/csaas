const { Client } = require('pg');

const taskId = '58576dd4-9c63-4420-b01d-f12ad9569809';

async function checkMeasures() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT COUNT(*) as count FROM action_plan_measures WHERE task_id = $1',
      [taskId]
    );

    console.log('任务ID:', taskId);
    console.log('当前数据库中措施数量:', result.rows[0].count, '条');

    // 查询任务详情
    const taskResult = await client.query(
      'SELECT status, progress, result FROM ai_tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];
      console.log('\n任务状态:', task.status);
      console.log('任务进度:', task.progress);
      if (task.result) {
        console.log('任务结果:', JSON.stringify(task.result, null, 2));
      }
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkMeasures();
