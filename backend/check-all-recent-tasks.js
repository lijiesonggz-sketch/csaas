const { Client } = require('pg');

async function checkAllRecentTasks() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    // 查找所有最近的任务
    const result = await client.query(`
      SELECT id, project_id, type, status, error_message, created_at, updated_at
      FROM ai_tasks
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('=== 最近的10个任务 ===');
    if (result.rows.length === 0) {
      console.log('❌ 没有找到任何任务');
      return;
    }

    result.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. 任务ID: ${row.id}`);
      console.log(`   项目ID: ${row.project_id}`);
      console.log(`   类型: ${row.type}`);
      console.log(`   状态: ${row.status}`);
      console.log(`   创建时间: ${row.created_at}`);
      console.log(`   更新时间: ${row.updated_at}`);
      if (row.error_message) {
        console.log(`   错误信息: ${row.error_message.substring(0, 200)}...`);
      }
    });

    // 查找最新的standard_interpretation任务
    const interpretationResult = await client.query(`
      SELECT id, project_id, type, status, error_message, created_at, updated_at,
        input->>'standardDocument'->>'name' as doc_name
      FROM ai_tasks
      WHERE type = 'standard_interpretation'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (interpretationResult.rows.length > 0) {
      const row = interpretationResult.rows[0];
      console.log('\n\n=== 最新的标准解读任务 ===');
      console.log('任务ID:', row.id);
      console.log('状态:', row.status);
      console.log('文档名称:', row.doc_name);
      console.log('创建时间:', row.created_at);
      console.log('更新时间:', row.updated_at);

      if (row.error_message) {
        console.log('\n错误详情:', row.error_message);
      }

      // 检查AI生成事件
      const eventsResult = await client.query(`
        SELECT model, status, error_message, created_at
        FROM ai_generation_events
        WHERE task_id = $1
        ORDER BY created_at DESC
      `, [row.id]);

      if (eventsResult.rows.length > 0) {
        console.log('\nAI模型调用事件:');
        eventsResult.rows.forEach(event => {
          console.log(`  - ${event.model}: ${event.status}`);
          if (event.error_message) {
            console.log(`    错误: ${event.error_message.substring(0, 200)}`);
          }
        });
      } else {
        console.log('\n❌ 没有找到AI生成事件（任务可能还没有开始处理）');
      }
    } else {
      console.log('\n❌ 没有找到标准解读任务');
    }

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkAllRecentTasks();
