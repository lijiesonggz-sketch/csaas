/**
 * 检查最新矩阵任务的完整input字段
 */
const { DataSource } = require('typeorm');

async function checkMatrixTaskInput() {
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

    const tasks = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        input,
        created_at
      FROM ai_tasks
      WHERE type = 'matrix'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log(`\n📋 最近3个矩阵任务的完整input字段：\n`);

    tasks.forEach((task, index) => {
      console.log(`${index + 1}. 任务ID: ${task.id}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   创建时间: ${task.created_at}`);
      console.log(`   Input字段: ${JSON.stringify(task.input, null, 2)}`);
      console.log('');
    });

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkMatrixTaskInput();
