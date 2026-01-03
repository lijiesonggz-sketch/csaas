const { Client } = require('pg');

async function checkSuccessEvents() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const successTaskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';
    const failedTaskId = '40be5cfa-ae35-4e4a-b5f1-ec8ca41feb82';

    console.log('='.repeat(80));
    console.log('成功任务 vs 失败任务的AI生成事件对比');
    console.log('='.repeat(80));

    // 查询成功任务的事件
    console.log('\n✅ 成功任务 (' + successTaskId + '):');
    const successEvents = await client.query(`
      SELECT
        model,
        error_message,
        execution_time_ms,
        created_at,
        LENGTH(output::text) as output_length
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [successTaskId]);

    console.log('AI事件数:', successEvents.rows.length);
    successEvents.rows.forEach((event, index) => {
      console.log(`\n事件 ${index + 1}:`);
      console.log('  - 模型:', event.model);
      console.log('  - 错误:', event.error_message || '(无)');
      console.log('  - 执行时间:', event.execution_time_ms, 'ms');
      console.log('  - 输出长度:', event.output_length, 'bytes');
      console.log('  - 时间:', event.created_at);
    });

    // 查询失败任务的事件
    console.log('\n\n❌ 失败任务 (' + failedTaskId + '):');
    const failedEvents = await client.query(`
      SELECT
        model,
        error_message,
        execution_time_ms,
        created_at,
        LENGTH(output::text) as output_length
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [failedTaskId]);

    console.log('AI事件数:', failedEvents.rows.length);
    failedEvents.rows.forEach((event, index) => {
      console.log(`\n事件 ${index + 1}:`);
      console.log('  - 模型:', event.model);
      console.log('  - 错误:', event.error_message ? event.error_message.substring(0, 100) : '(无)');
      console.log('  - 执行时间:', event.execution_time_ms, 'ms');
      console.log('  - 输出长度:', event.output_length, 'bytes');
      console.log('  - 时间:', event.created_at);
    });

    // 对比分析
    console.log('\n\n' + '='.repeat(80));
    console.log('关键发现:');
    console.log('='.repeat(80));

    if (successEvents.rows.length > 0) {
      const successModels = successEvents.rows.map(e => e.model);
      console.log('\n成功任务使用的模型:', [...new Set(successModels)].join(', '));
    }

    if (failedEvents.rows.length > 0) {
      const failedModels = failedEvents.rows.map(e => e.model);
      console.log('失败任务使用的模型:', [...new Set(failedModels)].join(', '));
    }

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkSuccessEvents();
