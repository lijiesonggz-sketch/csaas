const { Client } = require('pg');

async function resetStuckTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 将所有processing状态但超过10分钟没有更新的任务标记为失败
    const result = await client.query(`
      UPDATE ai_tasks
      SET status = 'failed',
          error_message = '任务已超时（可能是旧代码创建的任务，需要用新代码重试）'
      WHERE type = 'standard_interpretation'
        AND status = 'processing'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      RETURNING id, created_at
    `);

    if (result.rows.length > 0) {
      console.log(`✅ 已重置 ${result.rows.length} 个卡住的任务`);
      result.rows.forEach(row => {
        console.log(`  - 任务ID: ${row.id.substring(0, 8)}... 创建于: ${row.created_at}`);
      });
    } else {
      console.log('✅ 没有发现卡住的任务');
    }

    console.log('\n✅ 数据库清理完成！现在可以创建新任务测试了。');
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

resetStuckTask();
