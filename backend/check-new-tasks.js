const { Client } = require('pg');

async function checkNewTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskIds = ['c208a021-8c67-4d4f-aa0f-2921209c6ac0', '34d9e9ed-d499-4ca2-b14d-b9532459fa8d'];

    for (const taskId of taskIds) {
      console.log('\n' + '='.repeat(80));
      console.log('任务ID:', taskId);

      // 查询任务信息
      const taskResult = await client.query(`
        SELECT id, type, status, created_at, updated_at, completed_at, progress, error_message, result, input
        FROM ai_tasks
        WHERE id = $1
      `, [taskId]);

      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0];
        console.log('状态:', task.status);
        console.log('进度:', task.progress, '%');
        console.log('创建时间:', task.created_at);
        console.log('更新时间:', task.updated_at);
        console.log('错误信息:', task.error_message || '(无)');

        // 查询措施数量
        const measuresResult = await client.query(`
          SELECT COUNT(*) as count
          FROM action_plan_measures
          WHERE task_id = $1
        `, [taskId]);

        console.log('措施数量:', measuresResult.rows[0].count);
      } else {
        console.log('未找到该任务');
      }
    }

    // 查询旧任务 2e8eaa55
    console.log('\n\n' + '='.repeat(80));
    console.log('对比旧任务 2e8eaa55-4de0-470d-8269-2d076a828747:');

    const oldTaskResult = await client.query(`
      SELECT id, status, created_at, result
      FROM ai_tasks
      WHERE id = $1
    `, ['2e8eaa55-4de0-470d-8269-2d076a828747']);

    if (oldTaskResult.rows.length > 0) {
      const task = oldTaskResult.rows[0];
      console.log('状态:', task.status);
      console.log('创建时间:', task.created_at);
      console.log('结果:', JSON.stringify(task.result, null, 2));
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkNewTasks();
