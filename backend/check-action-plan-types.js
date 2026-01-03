const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();
  const result = await client.query(`
    SELECT id, status, completed_at, created_at, result
    FROM ai_tasks
    WHERE type = 'action_plan'
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 10
  `);

  console.log('\nAction Plan 任务列表:\n');
  result.rows.forEach((task, idx) => {
    const resultType = task.result
      ? (task.result.measures ? 'has_measures' : task.result.improvements ? 'has_improvements' : 'other')
      : 'no_result';

    console.log(`${idx + 1}. ${task.id.substring(0, 8)}... | ${task.status} | ${resultType} | ${task.completed_at || '未完成'}`);
  });

  // 检查是否有measures格式的任务
  const measuresTask = result.rows.find(t => t.result && t.result.measures);
  if (measuresTask) {
    console.log('\n找到包含 measures 的任务:', measuresTask.id);
    console.log('Measures 数量:', measuresTask.result.measures?.length);
  }

  await client.end();
}

check().catch(console.error);
