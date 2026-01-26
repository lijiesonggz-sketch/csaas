const { Client } = require('pg');

async function terminateTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '538e16f3-5ad1-48c4-987f-ee11b7ab33c5';

  // 更新任务状态为 failed
  await client.query(`
    UPDATE ai_tasks
    SET status = 'failed',
        error_message = '任务已手动终止（代码更新后需要重新触发）',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [taskId]);

  console.log(`✅ 任务 ${taskId.substring(0, 8)}... 已终止`);

  await client.end();
}

terminateTask().catch(console.error);
