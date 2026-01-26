const { Client } = require('pg');

async function checkDetailedErrors() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查找最新失败的任务
    const taskResult = await client.query(`
      SELECT id, project_id, type, status, error_message, created_at, updated_at
      FROM ai_tasks
      WHERE type = 'standard_interpretation' AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (taskResult.rows.length === 0) {
      console.log('❌ 没有找到失败的标准解读任务');
      return;
    }

    const task = taskResult.rows[0];
    console.log('=== 最新失败的任务 ===');
    console.log('任务ID:', task.id);
    console.log('创建时间:', task.created_at);
    console.log('任务错误:', task.error_message);

    // 检查AI生成事件的详细错误
    const eventsResult = await client.query(`
      SELECT id, task_id, model, status, error_message, created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [task.id]);

    if (eventsResult.rows.length > 0) {
      console.log('\n=== AI模型调用详情 ===');
      eventsResult.rows.forEach((event, idx) => {
        console.log(`\n${idx + 1}. ${event.model}`);
        console.log(`   状态: ${event.status}`);
        console.log(`   时间: ${event.created_at}`);
        if (event.error_message) {
          console.log(`   错误: ${event.error_message}`);
        }
      });
    } else {
      console.log('\n❌ 没有找到AI生成事件');
    }

    // 检查是否有ai_generation_results记录
    const resultCheck = await client.query(`
      SELECT selected_model, gpt4_result, claude_result, domestic_result
      FROM ai_generation_results
      WHERE task_id = $1
    `, [task.id]);

    if (resultCheck.rows.length > 0) {
      console.log('\n=== AI生成结果 ===');
      const result = resultCheck.rows[0];
      console.log('选中的模型:', result.selected_model);
      console.log('GPT4结果存在:', !!result.gpt4_result);
      console.log('Claude结果存在:', !!result.claude_result);
      console.log('Domestic结果存在:', !!result.domestic_result);
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkDetailedErrors();
