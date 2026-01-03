const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function test() {
  await client.connect();

  const projectId = '16639558-c44d-41eb-a328-277182335f90';

  // 查询action_plan类型的最新任务
  const result = await client.query(`
    SELECT id, type, status, result, input, created_at
    FROM ai_tasks
    WHERE project_id = $1
    AND type = 'action_plan'
    ORDER BY created_at DESC
    LIMIT 1
  `, [projectId]);

  if (result.rowCount > 0) {
    const task = result.rows[0];
    console.log('=== Action Plan 任务信息 ===');
    console.log('ID:', task.id);
    console.log('Type:', task.type);
    console.log('Status:', task.status);
    console.log('Has Result:', task.result !== null);
    console.log('Result Type:', typeof task.result);

    if (task.result) {
      console.log('\n=== Result 数据 ===');
      console.log(JSON.stringify(task.result, null, 2));
    } else {
      console.log('\n⚠️  Result 为 null！');
    }

    // 检查result字段
    const checkResult = await client.query(`
      SELECT
        result IS NOT NULL as has_result,
        pg_column_size(result) as result_size
      FROM ai_tasks
      WHERE id = $1
    `, [task.id]);

    console.log('\n=== Result 字段信息 ===');
    console.log(checkResult.rows[0]);
  } else {
    console.log('没有找到 action_plan 任务');
  }

  await client.end();
}

test().catch(console.error);
