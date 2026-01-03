const { Client } = require('pg');

async function checkLatestActionPlan() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const taskId = '1a43051a-bee3-4635-b4ab-df1fc96f03fe';

    // 1. 查询任务信息
    const taskResult = await client.query(`
      SELECT id, type, status, created_at, completed_at, progress, error_message, result, input
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];
      console.log('=== 任务信息 ===');
      console.log('任务ID:', task.id);
      console.log('状态:', task.status);
      console.log('进度:', task.progress, '%');
      console.log('错误信息:', task.error_message || '(无)');
      console.log('创建时间:', task.created_at);
      console.log('完成时间:', task.completed_at || '(未完成)');
      console.log('\n输入数据:', JSON.stringify(task.input, null, 2));
      console.log('\n结果数据:', JSON.stringify(task.result, null, 2));
    }

    // 2. 查询措施数量
    const measuresResult = await client.query(`
      SELECT COUNT(*) as count
      FROM action_plan_measures
      WHERE task_id = $1
    `, [taskId]);

    console.log('\n=== 措施统计 ===');
    console.log('措施数量:', measuresResult.rows[0].count);

    // 3. 查询是否有生成错误
    const errorResult = await client.query(`
      SELECT error_message, result
      FROM ai_tasks
      WHERE id = $1
    `, [taskId]);

    if (errorResult.rows[0].error_message) {
      console.log('\n错误信息:', errorResult.rows[0].error_message);
    }

    // 4. 对比成功任务 d5e35635
    const successTaskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';
    const successResult = await client.query(`
      SELECT id, status, input, result
      FROM ai_tasks
      WHERE id = $1
    `, [successTaskId]);

    if (successResult.rows.length > 0) {
      console.log('\n\n=== 对比成功任务 d5e35635 ===');
      console.log('输入数据:', JSON.stringify(successResult.rows[0].input, null, 2));
      console.log('结果数据:', JSON.stringify(successResult.rows[0].result, null, 2));
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkLatestActionPlan();
