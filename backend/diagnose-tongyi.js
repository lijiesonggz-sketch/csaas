const { Client } = require('pg');

async function diagnoseTongyiIssue() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  console.log('=== 通义千问聚类调用问题诊断报告 ===\n');

  // 1. 检查最近的聚类任务
  const clusteringTasks = await client.query(`
    SELECT id, status, error_message, created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 3
  `);

  console.log('1. 最近的聚类任务:');
  clusteringTasks.rows.forEach((task, i) => {
    console.log(`   [${i + 1}] ${task.id.substring(0, 8)}...`);
    console.log(`       状态: ${task.status}`);
    console.log(`       错误: ${task.error_message || '无'}`);
  });

  // 2. 检查这些任务的事件记录
  console.log('\n2. 这些任务的AI模型调用情况:');
  for (const task of clusteringTasks.rows) {
    const events = await client.query(`
      SELECT model, error_message, execution_time_ms
      FROM ai_generation_events
      WHERE task_id = $1
    `, [task.id]);

    console.log(`\n   任务 ${task.id.substring(0, 8)}...:`);
    if (events.rows.length === 0) {
      console.log('     ⚠️ 没有任何AI模型调用记录！');
    } else {
      events.rows.forEach(event => {
        console.log(`     - ${event.model}: ${event.execution_time_ms || 0}ms`);
        if (event.error_message) {
          console.log(`       错误: ${event.error_message.substring(0, 100)}...`);
        }
      });
    }
  }

  // 3. 统计所有模型调用
  console.log('\n3. 全局AI模型调用统计:');
  const modelStats = await client.query(`
    SELECT model, COUNT(*) as count
    FROM ai_generation_events
    GROUP BY model
    ORDER BY count DESC
  `);

  modelStats.rows.forEach(stat => {
    console.log(`   ${stat.model}: ${stat.count} 次`);
  });

  // 4. 检查成本追踪
  console.log('\n4. 成本追踪统计:');
  const costStats = await client.query(`
    SELECT model, COUNT(*) as count
    FROM ai_cost_tracking
    GROUP BY model
    ORDER BY count DESC
  `);

  if (costStats.rows.length === 0) {
    console.log('   ⚠️ 没有任何成本追踪记录');
  } else {
    costStats.rows.forEach(stat => {
      console.log(`   ${stat.model}: ${stat.count} 次`);
    });
  }

  console.log('\n=== 结论 ===');
  console.log('❌ 通义千问（domestic模型）从未被成功调用过！');
  console.log('\n可能的原因:');
  console.log('1. TongyiClient.isAvailable()返回false');
  console.log('2. AIOrchestrator在尝试TongyiClient时遇到异常');
  console.log('3. 环境变量TONGYI_API_KEY在运行时未正确加载');
  console.log('4. 代码中某个地方跳过了domestic模型的调用');

  await client.end();
}

diagnoseTongyiIssue().catch(console.error);
