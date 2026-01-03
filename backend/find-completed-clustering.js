/**
 * 查找已完成的聚类任务
 */
const { DataSource } = require('typeorm');

async function findCompletedClustering() {
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

    // 查找所有completed状态的聚类任务
    const tasks = await dataSource.query(`
      SELECT
        id,
        status,
        progress,
        created_at,
        completed_at
      FROM ai_tasks
      WHERE type = 'clustering'
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`📊 找到 ${tasks.length} 个已完成的聚类任务:\n`);

    if (tasks.length === 0) {
      console.log('❌ 没有找到已完成的聚类任务!\n');
      console.log('💡 可能的原因:');
      console.log('   1. 所有聚类任务都失败了');
      console.log('   2. 聚类任务卡在processing状态');
      console.log('   3. 聚类生成代码有bug导致任务无法完成\n');

      // 检查是否有processing状态的聚类任务
      const processingTasks = await dataSource.query(`
        SELECT COUNT(*) as count
        FROM ai_tasks
        WHERE type = 'clustering'
          AND status = 'processing'
      `);

      console.log(`⚠️  有 ${processingTasks[0].count} 个聚类任务卡在processing状态\n`);
    } else {
      tasks.forEach((task, idx) => {
        console.log(`${idx + 1}. ID: ${task.id}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   进度: ${task.progress}%`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   完成时间: ${task.completed_at}`);
        console.log('');
      });

      console.log(`✅ 你可以使用任一ID来生成矩阵，例如: ${tasks[0].id}\n`);
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

findCompletedClustering();
