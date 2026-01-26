const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  await client.connect();

  const result = await client.query(`
    SELECT
      id,
      type,
      status,
      generation_stage,
      progress,
      error_message,
      created_at,
      updated_at,
      completed_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('没有找到聚类任务');
  } else {
    const task = result.rows[0];
    console.log('最新聚类任务:');
    console.log('='.repeat(70));
    console.log('任务ID:', task.id);
    console.log('类型:', task.type);
    console.log('状态:', task.status);
    console.log('阶段:', task.generation_stage || 'N/A');
    console.log('进度:', task.progress || 0, '%');
    if (task.error_message) {
      console.log('错误信息:', task.error_message);
    }
    console.log('创建时间:', new Date(task.created_at).toLocaleString('zh-CN'));
    if (task.updated_at) {
      console.log('更新时间:', new Date(task.updated_at).toLocaleString('zh-CN'));
    }
    if (task.completed_at) {
      console.log('完成时间:', new Date(task.completed_at).toLocaleString('zh-CN'));
    }
    console.log('='.repeat(70));
  }

  await client.end();
})();
