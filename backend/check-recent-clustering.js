const { Client } = require('pg');

async function checkRecentClustering() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const result = await client.query(`
    SELECT
      id,
      type,
      status,
      progress,
      error_message,
      created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 3
  `);

  console.log('=== 最近的聚类任务 ===');
  result.rows.forEach((r, i) => {
    console.log(`[${i+1}] ${r.id.substring(0, 8)}...`);
    console.log(`    完整ID: ${r.id}`);
    console.log(`    类型: ${r.type}`);
    console.log(`    状态: ${r.status}`);
    console.log(`    进度: ${r.progress || 0}%`);
    console.log(`    错误: ${r.error_message || '无'}`);
    console.log(`    创建时间: ${r.created_at}`);
    console.log('');
  });

  // 如果有任务，查询AI生成事件
  if (result.rows.length > 0) {
    const taskId = result.rows[0].id;
    console.log(`=== 任务 ${taskId.substring(0, 8)}... 的AI生成事件 ===\n`);

    const events = await client.query(`
      SELECT
        model,
        error_message,
        execution_time_ms,
        created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [taskId]);

    if (events.rows.length === 0) {
      console.log('⚠️  暂无AI生成事件（任务可能还在执行中）');
    } else {
      events.rows.forEach((e, i) => {
        console.log(`[${i+1}] 模型: ${e.model}`);
        console.log(`    执行时间: ${e.execution_time_ms || 0}ms`);
        console.log(`    状态: ${e.error_message || '成功'}`);
        console.log(`    创建时间: ${e.created_at}`);
        console.log('');
      });

      const models = events.rows.map(r => r.model);
      console.log(`📊 总结:`);
      console.log(`   总事件数: ${events.rows.length}`);
      console.log(`   模型分布: ${models.join(', ')}`);

      const hasTongyi = models.includes('domestic');
      if (hasTongyi) {
        console.log(`   ✅ 通义千问已被调用！`);
      } else {
        console.log(`   ❌ 通义千问未被调用`);
      }
    }
  }

  await client.end();
}

checkRecentClustering().catch(console.error);
