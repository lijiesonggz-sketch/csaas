/**
 * 查询任务的生成事件
 */
const { DataSource } = require('typeorm');

async function checkTaskEvents() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    // 查询最新的matrix任务
    const [latestTask] = await dataSource.query(`
      SELECT id, status, created_at
      FROM ai_tasks
      WHERE type = 'matrix'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!latestTask) {
      console.log('❌ 没有找到matrix任务');
      await dataSource.destroy();
      return;
    }

    console.log(`\n🔍 检查任务: ${latestTask.id}`);
    console.log(`   状态: ${latestTask.status}`);
    console.log(`   创建时间: ${latestTask.created_at}\n`);

    // 查询该任务的所有生成事件
    const events = await dataSource.query(`
      SELECT
        id,
        model,
        created_at,
        error_message,
        execution_time_ms
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 30
    `, [latestTask.id]);

    console.log(`📊 生成事件数量: ${events.length}\n`);

    if (events.length === 0) {
      console.log('❌ 没有找到任何生成事件！');
      console.log('   可能原因：');
      console.log('   1. Worker未启动或已崩溃');
      console.log('   2. Redis连接问题');
      console.log('   3. 任务未被Queue消费');
    } else {
      console.log('📋 最近的生成事件：\n');
      events.forEach((event, index) => {
        console.log(`${index + 1}. Event ID: ${event.id}`);
        console.log(`   模型: ${event.model}`);
        console.log(`   执行时间: ${event.execution_time_ms}ms`);
        console.log(`   时间: ${event.created_at}`);
        if (event.error_message) {
          console.log(`   ❌ 错误: ${event.error_message.substring(0, 200)}`);
        }
        console.log('');
      });
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkTaskEvents();
