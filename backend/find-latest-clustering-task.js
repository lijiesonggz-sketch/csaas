/**
 * 查找最近一次成功的聚类任务
 */
const { DataSource } = require('typeorm');

async function findLatestClusteringTask() {
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
        created_at,
        result
      FROM ai_tasks
      WHERE type = 'clustering'
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📋 最近5个成功的聚类任务：\n');

    if (result.length === 0) {
      console.log('❌ 没有找到成功的聚类任务');
    } else {
      result.forEach((task, index) => {
        console.log(`${index + 1}. 任务ID: ${task.id}`);
        console.log(`   类型: ${task.type}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   结果数据: ${task.result ? '有数据' : '无数据'}`);
        console.log('');
      });

      console.log(`\n✅ 最新的聚类任务ID: ${result[0].id}\n`);
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

findLatestClusteringTask();
