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
    SELECT id, type, status, progress, result,
           created_at, updated_at, completed_at
    FROM ai_tasks
    WHERE type = 'action_plan'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log(`\n找到 ${result.rows.length} 个 action_plan 任务:\n`);

  result.rows.forEach((task, idx) => {
    console.log(`${idx + 1}. 任务 ID: ${task.id}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   进度: ${task.progress}%`);
    console.log(`   创建时间: ${task.created_at}`);
    console.log(`   完成时间: ${task.completed_at || '未完成'}`);
    console.log(`   Result 是否存在: ${!!task.result}`);
    if (task.result) {
      const resultKeys = typeof task.result === 'object' ? Object.keys(task.result) : '非对象';
      console.log(`   Result 字段: ${resultKeys}`);
      if (task.result.content) {
        const contentLength = typeof task.result.content === 'string'
          ? task.result.content.length
          : '非字符串';
        console.log(`   Content 长度: ${contentLength}`);
      }
    }
    console.log('');
  });

  await client.end();
}

check().catch(console.error);
