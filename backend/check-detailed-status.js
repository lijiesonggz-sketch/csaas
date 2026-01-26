const { Client } = require('pg');

async function checkDetailedStatus() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  console.log('=== 最新聚类任务详细状态 ===\n');

  // 获取最新任务
  const taskResult = await client.query(`
    SELECT id, status, error_message, progress, created_at, updated_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (taskResult.rows.length === 0) {
    console.log('❌ 没有找到聚类任务');
    await client.end();
    return;
  }

  const task = taskResult.rows[0];
  console.log(`任务ID: ${task.id}`);
  console.log(`状态: ${task.status}`);
  console.log(`进度: ${task.progress || 'N/A'}`);
  console.log(`创建时间: ${task.created_at}`);
  console.log(`更新时间: ${task.updated_at}`);
  if (task.error_message) {
    console.log(`\n❌ 错误信息:\n${task.error_message}`);
  }

  // 查看所有AI生成事件（包括未完成的）
  console.log('\n=== AI模型调用事件 ===');
  const eventsResult = await client.query(`
    SELECT
      id,
      model,
      error_message,
      execution_time_ms,
      created_at
    FROM ai_generation_events
    WHERE task_id = $1
    ORDER BY created_at ASC
  `, [task.id]);

  if (eventsResult.rows.length === 0) {
    console.log('⚠️ 没有任何AI模型调用记录');
    console.log('\n可能的原因:');
    console.log('1. Worker进程未启动或崩溃');
    console.log('2. Redis连接问题');
    console.log('3. 任务未被消费');
    console.log('4. AIOrchestrator在调用模型前就失败了');
  } else {
    console.log(`总共 ${eventsResult.rows.length} 个事件\n`);

    // 按模型分组统计
    const modelStats = {};
    eventsResult.rows.forEach(event => {
      if (!modelStats[event.model]) {
        modelStats[event.model] = { count: 0, completed: 0, failed: 0 };
      }
      modelStats[event.model].count++;

      if (event.execution_time_ms) {
        modelStats[event.model].completed++;
      }
      if (event.error_message) {
        modelStats[event.model].failed++;
      }

      console.log(`[${event.model}]`);
      console.log(`  Event ID: ${event.id}`);
      console.log(`  时间: ${event.created_at}`);
      console.log(`  执行时间: ${event.execution_time_ms || '进行中...'}`);
      if (event.error_message) {
        console.log(`  ❌ 错误: ${event.error_message.substring(0, 200)}`);
      } else {
        console.log(`  ✅ 状态: ${event.execution_time_ms ? '已完成' : '进行中'}`);
      }
      console.log('');
    });

    console.log('--- 模型统计 ---');
    Object.entries(modelStats).forEach(([model, stats]) => {
      console.log(`${model}: ${stats.count}次 (完成: ${stats.completed}, 失败: ${stats.failed})`);
    });
  }

  // 检查Qwen模型是否被调用
  console.log('\n=== Qwen (Tongyi) 模型调用检查 ===');
  const qwenEvents = eventsResult.rows.filter(e => e.model === 'domestic' || e.model.includes('qwen') || e.model.includes('tongyi'));

  if (qwenEvents.length === 0) {
    console.log('❌ Qwen模型未被调用！');
    console.log('\n需要检查:');
    console.log('1. TongyiClient.isAvailable() 是否返回true');
    console.log('2. AIOrchestrator是否跳过了domestic模型');
    console.log('3. 后端日志中的警告信息');
  } else {
    console.log(`✅ Qwen被调用了 ${qwenEvents.length} 次`);
    qwenEvents.forEach(event => {
      console.log(`  - Event ID: ${event.id}`);
      console.log(`    状态: ${event.execution_time_ms ? '完成' : '进行中'}`);
    });
  }

  await client.end();
}

checkDetailedStatus().catch(console.error);
