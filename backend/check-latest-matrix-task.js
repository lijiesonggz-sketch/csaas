/**
 * 查询最新的成熟度矩阵生成任务
 */
const { DataSource } = require('typeorm');

async function checkLatestMatrixTask() {
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
        progress,
        error_message,
        created_at,
        updated_at
      FROM ai_tasks
      WHERE type = 'matrix'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('\n📋 最近3个成熟度矩阵任务：\n');

    if (result.length === 0) {
      console.log('❌ 没有找到成熟度矩阵任务');
    } else {
      result.forEach((task, index) => {
        console.log(`${index + 1}. 任务ID: ${task.id}`);
        console.log(`   类型: ${task.type}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   进度: ${task.progress}%`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   更新时间: ${task.updated_at}`);
        if (task.error_message) {
          console.log(`   ❌ 错误信息: ${task.error_message}`);
        }
        console.log('');
      });

      const latest = result[0];
      console.log(`\n🔍 最新任务详情：`);
      console.log(`   ID: ${latest.id}`);
      console.log(`   状态: ${latest.status}`);
      console.log(`   进度: ${latest.progress}%`);

      if (latest.status === 'processing') {
        console.log('\n⏳ 任务正在处理中...');
      } else if (latest.status === 'failed') {
        console.log('\n❌ 任务失败！');
      } else if (latest.status === 'completed') {
        console.log('\n✅ 任务已完成！');
      }
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkLatestMatrixTask();
