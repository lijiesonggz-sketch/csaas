/**
 * 清理数据库中卡住的processing任务
 */
const { DataSource } = require('typeorm');

async function cleanStuckTasks() {
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

    // 查询所有无生成事件的processing任务
    const stuckTasks = await dataSource.query(`
      SELECT id, type, created_at
      FROM ai_tasks
      WHERE status = 'processing'
        AND id NOT IN (
          SELECT DISTINCT task_id
          FROM ai_generation_events
          WHERE task_id IS NOT NULL
        )
      ORDER BY created_at DESC
    `);

    console.log(`📊 发现 ${stuckTasks.length} 个卡住的任务\n`);

    if (stuckTasks.length > 0) {
      console.log('准备清理以下任务:');
      stuckTasks.forEach((task, idx) => {
        console.log(`   ${idx + 1}. ${task.type} - ${task.id} (${task.created_at})`);
      });

      // 更新任务状态为failed
      const result = await dataSource.query(`
        UPDATE ai_tasks
        SET status = 'failed',
            error_message = '任务执行超时或异常终止，已自动清理'
        WHERE status = 'processing'
          AND id NOT IN (
            SELECT DISTINCT task_id
            FROM ai_generation_events
            WHERE task_id IS NOT NULL
          )
      `);

      console.log(`\n✅ 清理完成! 更新了 ${result[1]} 个任务状态为failed\n`);
    } else {
      console.log('✅ 没有发现卡住的任务\n');
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanStuckTasks();
