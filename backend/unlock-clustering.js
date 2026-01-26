const { Client } = require('pg');

async function unlockStuckTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  try {
    const result = await client.query(
      "SELECT id, type, status, created_at FROM ai_tasks WHERE type = 'clustering' AND status IN ('pending', 'processing') ORDER BY created_at DESC"
    );

    console.log('找到 ' + result.rows.length + ' 个卡住的聚类任务');
    console.log('='.repeat(70));

    for (const task of result.rows) {
      console.log('正在标记为失败:', task.id);
      await client.query(
        "UPDATE ai_tasks SET status = 'failed', error_message = '任务超时，已自动取消' WHERE id = $1",
        [task.id]
      );
      console.log('✅ 已标记:', task.id);
    }

    console.log('\n✅ 所有卡住的任务已清理！');
    console.log('\n现在可以在前端重新生成聚类任务了。');

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await client.end();
  }
}

unlockStuckTasks();
