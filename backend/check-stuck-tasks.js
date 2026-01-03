/**
 * 检查卡住的任务
 */
const { DataSource } = require('typeorm');

async function checkStuckTasks() {
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
    console.log('✅ Database connected\n');

    // 查询所有processing状态的任务
    const tasks = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        progress,
        created_at,
        updated_at,
        error_message
      FROM ai_tasks
      WHERE status = 'processing'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`📊 找到 ${tasks.length} 个processing状态的任务\n`);

    for (const task of tasks) {
      console.log(`📦 任务ID: ${task.id}`);
      console.log(`   类型: ${task.type}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   进度: ${task.progress}%`);
      console.log(`   创建时间: ${task.created_at}`);
      console.log(`   更新时间: ${task.updated_at}`);

      // 检查BullMQ中是否有对应的job
      console.log(`\n   🔍 检查任务的生成事件...`);

      const events = await dataSource.query(`
        SELECT
          id,
          model,
          created_at,
          execution_time_ms,
          error_message
        FROM ai_generation_events
        WHERE task_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [task.id]);

      if (events.length === 0) {
        console.log(`   ⚠️  警告: 没有生成事件! Worker可能没有处理这个任务`);
      } else {
        console.log(`   找到 ${events.length} 个生成事件:`);
        events.forEach((event, idx) => {
          console.log(`     ${idx + 1}. 模型: ${event.model}, 时间: ${event.execution_time_ms || 'N/A'}ms`);
          if (event.error_message) {
            console.log(`        ❌ 错误: ${event.error_message.substring(0, 100)}`);
          }
        });
      }

      console.log('');
    }

    // 检查队列状态
    console.log('\n📊 检查BullMQ队列状态...\n');
    const { Queue } = require('bullmq');
    const queue = new Queue('ai-tasks', {
      connection: {
        host: 'localhost',
        port: 6379,
      },
    });

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    console.log(`   等待中: ${waiting}`);
    console.log(`   处理中: ${active}`);
    console.log(`   已完成: ${completed}`);
    console.log(`   失败: ${failed}`);

    await queue.close();
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkStuckTasks();
