const { Client } = require('pg');

async function check() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查询最近1小时创建的所有任务
  const result = await client.query(
    "SELECT id, type, status, project_id, created_at FROM ai_tasks WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC"
  );

  console.log('最近1小时创建的所有任务:');
  console.log('='.repeat(80));
  
  if (result.rows.length === 0) {
    console.log('❌ 没有找到最近1小时的任务');
  } else {
    result.rows.forEach((task) => {
      const created = new Date(task.created_at);
      console.log('任务ID: ' + task.id);
      console.log('类型: ' + task.type);
      console.log('状态: ' + task.status);
      console.log('项目ID: ' + task.project_id);
      console.log('创建时间: ' + created.toLocaleString('zh-CN'));
      console.log('');
    });
  }

  await client.end();
}

check();
