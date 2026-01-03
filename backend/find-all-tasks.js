/**
 * 查找所有AI任务
 */
const { DataSource } = require('typeorm');

async function findAllTasks() {
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

    const result = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        created_at
      FROM ai_tasks
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('\n📋 最近10个AI任务：\n');

    if (result.length === 0) {
      console.log('❌ 没有找到任何任务');
    } else {
      result.forEach((task, index) => {
        console.log(`${index + 1}. 任务ID: ${task.id}`);
        console.log(`   类型: ${task.type}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log('');
      });

      // 统计
      const byClustering = result.filter(t => t.type === 'clustering');
      const byCompleted = result.filter(t => t.status === 'completed');

      console.log('\n📊 统计：');
      console.log(`   总任务数: ${result.length}`);
      console.log(`   聚类任务: ${byClustering.length}`);
      console.log(`   已完成: ${byCompleted.length}`);
      console.log('');
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

findAllTasks();
