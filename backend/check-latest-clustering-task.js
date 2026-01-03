const { Client } = require('pg');

async function checkLatestTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查询新项目的最新任务
  const res = await client.query(`
    SELECT id, project_id, type, status, progress, error_message, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, ['ce5c613d-fce0-4ee8-bb0a-64a23e3793dc']);

  console.log('=== 新项目最新任务 ===');
  console.log('项目ID: ce5c613d-fce0-4ee8-bb0a-64a23e3793dc');

  if (res.rows.length === 0) {
    console.log('❌ 没有找到任务');
  } else {
    const task = res.rows[0];
    console.log('\nTask ID:', task.id);
    console.log('Project ID:', task.project_id);
    console.log('Type:', task.type);
    console.log('Status:', task.status);
    console.log('Progress:', task.progress, '%');
    console.log('Error:', task.error_message || '无');
    console.log('Created:', task.created_at);

    // 检查是否有生成结果
    const resultRes = await client.query(`
      SELECT id, selected_model, confidence_level, review_status
      FROM ai_generation_results
      WHERE task_id = $1
    `, [task.id]);

    if (resultRes.rows.length > 0) {
      const result = resultRes.rows[0];
      console.log('\n✅ 有生成结果:');
      console.log('  Result ID:', result.id);
      console.log('  Selected Model:', result.selected_model);
      console.log('  Confidence:', result.confidence_level);
      console.log('  Review Status:', result.review_status);
    } else {
      console.log('\n❌ 暂无生成结果');
    }
  }

  await client.end();
}

checkLatestTask().catch(console.error);
