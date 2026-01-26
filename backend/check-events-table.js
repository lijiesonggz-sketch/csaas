const { Client } = require('pg');

async function checkEventsTable() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查看ai_generation_events表结构
    console.log('=== ai_generation_events 表结构 ===');
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_generation_events'
      ORDER BY ordinal_position
    `);

    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // 查找最新失败任务的AI事件
    console.log('\n=== 最新失败任务的AI事件 ===');
    const taskId = '076ba5e6-007c-4801-b6b4-b75ddf07d45c'; // 最新失败的任务ID
    const events = await client.query(`
      SELECT *
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [taskId]);

    if (events.rows.length > 0) {
      console.log(`找到 ${events.rows.length} 个事件\n`);
      events.rows.forEach((event, idx) => {
        console.log(`\n事件 ${idx + 1}:`);
        Object.keys(event).forEach(key => {
          const value = event[key];
          if (value && typeof value === 'string' && value.length > 100) {
            console.log(`  ${key}: ${value.substring(0, 100)}...`);
          } else if (value !== null && value !== undefined) {
            console.log(`  ${key}: ${value}`);
          }
        });
      });
    } else {
      console.log('❌ 没有找到事件记录');
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkEventsTable();
