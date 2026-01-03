const { Client } = require('pg');

async function checkResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();

    // 1. 查询最近的聚类任务
    const tasksResult = await client.query(`
      SELECT id, type, status, project_id, created_at
      FROM ai_tasks
      WHERE type = 'clustering'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('\n📋 最近的聚类任务:');
    console.table(tasksResult.rows);

    if (tasksResult.rows.length === 0) {
      console.log('❌ 没有找到聚类任务');
      return;
    }

    const latestTaskId = tasksResult.rows[0].id;
    console.log(`\n🔍 检查最新任务 ${latestTaskId} 的聚合结果...`);

    // 2. 查询对应的聚合结果
    const resultsResult = await client.query(`
      SELECT id, task_id, generation_type, selected_model, confidence_level
      FROM ai_generation_results
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [latestTaskId]);

    if (resultsResult.rows.length === 0) {
      console.log(`❌ 任务 ${latestTaskId} 在 ai_generation_results 表中没有记录`);
      console.log('💡 这个任务可能是在旧的流程中创建的，没有通过 ResultAggregatorService');
    } else {
      console.log('\n✅ 找到聚合结果:');
      console.table(resultsResult.rows);
    }

    // 3. 检查任务是否有 projectId
    console.log('\n📌 任务的 projectId:', tasksResult.rows[0].project_id || '无（未关联项目）');

    // 4. 检查 ai_generation_results 表中的记录数
    const countResult = await client.query(`
      SELECT COUNT(*) as count
      FROM ai_generation_results
    `);
    console.log(`\n📊 ai_generation_results 表总记录数: ${countResult.rows[0].count}`);

  } finally {
    await client.end();
  }
}

checkResult().catch(console.error);
