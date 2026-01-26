const { Client } = require('pg');

async function checkCurrentTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查找最新的任务（包括正在执行的）
    const result = await client.query(`
      SELECT id, type, status, created_at, updated_at,
        CASE
          WHEN updated_at > created_at THEN '正在执行'
          ELSE '刚创建'
        END as state
      FROM ai_tasks
      WHERE type = 'standard_interpretation'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('=== 最近的标准解读任务 ===\n');
    result.rows.forEach((row, idx) => {
      const timeDiff = new Date().getTime() - new Date(row.created_at).getTime();
      const minutesAgo = Math.floor(timeDiff / 60000);
      const secondsAgo = Math.floor((timeDiff % 60000) / 1000);

      console.log(`${idx + 1}. 任务ID: ${row.id.substring(0, 8)}...`);
      console.log(`   状态: ${row.status}`);
      console.log(`   ${row.state}`);
      console.log(`   创建于: ${minutesAgo}分${secondsAgo}秒前`);
      console.log(`   更新于: ${row.updated_at}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkCurrentTask();
