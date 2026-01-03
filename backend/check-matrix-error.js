/**
 * 检查矩阵任务错误
 */
const { DataSource } = require('typeorm');

async function checkMatrixError() {
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

    // 查询最近的矩阵任务
    const tasks = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        progress,
        error_message,
        created_at,
        input
      FROM ai_tasks
      WHERE type = 'matrix'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('📊 最近3个矩阵任务:\n');

    tasks.forEach((task, index) => {
      console.log(`${index + 1}. 任务ID: ${task.id}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   进度: ${task.progress}%`);
      console.log(`   创建时间: ${task.created_at}`);

      if (task.error_message) {
        console.log(`   ❌ 错误信息: ${task.error_message}`);
      } else {
        console.log(`   错误信息: 无`);
      }

      // 检查输入数据
      if (task.input && task.input.clusteringResult) {
        console.log(`   ✅ 输入数据存在`);
        const categories = task.input.clusteringResult.categories || [];
        let totalClusters = 0;
        categories.forEach(cat => {
          if (cat.clusters) {
            totalClusters += cat.clusters.length;
          }
        });
        console.log(`   聚类数量: ${totalClusters}`);
      } else {
        console.log(`   ⚠️  输入数据缺失或格式错误`);
      }

      console.log('');
    });

    // 查询是否有生成事件
    console.log('🔍 检查生成事件...\n');

    for (const task of tasks.slice(0, 1)) {
      const events = await dataSource.query(`
        SELECT
          id,
          model,
          error_message,
          execution_time_ms,
          created_at
        FROM ai_generation_events
        WHERE task_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [task.id]);

      console.log(`任务 ${task.id.substring(0, 8)}... 的生成事件:`);
      if (events.length === 0) {
        console.log('   ⚠️  没有生成事件记录\n');
      } else {
        events.forEach((evt, idx) => {
          console.log(`   ${idx + 1}. 模型: ${evt.model}, 执行时间: ${evt.execution_time_ms || 'N/A'}ms`);
          if (evt.error_message) {
            console.log(`      ❌ 错误: ${evt.error_message.substring(0, 200)}`);
          }
        });
        console.log('');
      }
    }

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkMatrixError();
