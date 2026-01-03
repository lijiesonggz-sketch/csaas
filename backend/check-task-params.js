const { Client } = require('pg');

async function checkParams() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(`
    SELECT
      t.id,
      t.created_at,
      t.input
    FROM ai_tasks t
    WHERE t.id IN ('2f1284ba-8b18-40a7-a787-ed05a9a14128', '51627820-d0d1-492c-ab05-d78371fe324f')
    ORDER BY t.created_at
  `);

  console.log('=== 检查两个任务的输入参数 ===\n');

  res.rows.forEach(row => {
    const date = row.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    console.log(`\n任务: ${row.id.substring(0, 8)}...`);
    console.log(`创建时间: ${date}`);

    if (row.input) {
      console.log(`文档数量: ${row.input.documents?.length || 0}`);
      console.log(`Temperature: ${row.input.temperature || '未指定（使用默认0.7）'}`);
      console.log(`MaxTokens: ${row.input.maxTokens || '未指定（使用默认8000）'}`);
    }
  });

  await client.end();
}

checkParams().catch(console.error);
