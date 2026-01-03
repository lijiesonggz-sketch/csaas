/**
 * 检查聚类任务的生成事件
 */
const { DataSource } = require('typeorm');

async function checkClusteringEvents() {
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

    const taskId = 'a785e8fd-1889-441d-b435-733ba93c4602';

    const events = await dataSource.query(`
      SELECT
        id,
        model,
        error_message,
        execution_time_ms,
        created_at
      FROM ai_generation_events
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [taskId]);

    console.log(`\n📊 聚类任务 ${taskId} 的生成事件:\n`);
    console.log(`   总数: ${events.length}\n`);

    if (events.length === 0) {
      console.log('❌ 没有生成事件记录！');
      console.log('\n💡 这说明聚类任务被创建了，但代码执行时抛出了异常');
      console.log('   异常发生在生成事件被记录之前\n');
    } else {
      events.forEach((evt, idx) => {
        console.log(`${idx + 1}. 模型: ${evt.model}`);
        console.log(`   执行时间: ${evt.execution_time_ms || '未完成'}ms`);
        console.log(`   创建时间: ${evt.created_at}`);

        if (evt.error_message) {
          console.log(`   ❌ 错误: ${evt.error_message}`);
        } else {
          console.log(`   ✅ 状态: 成功`);
        }
        console.log('');
      });
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkClusteringEvents();
