/**
 * 根据聚类任务ID查找成熟度矩阵任务
 */
const { DataSource } = require('typeorm');

async function findMatrixByClusteringId() {
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

    const clusteringTaskId = '2f1284ba-8b18-40a7-a787-ed05a9a14128';

    // 查询所有矩阵任务，检查input字段中是否包含这个聚类ID
    const matrixTasks = await dataSource.query(`
      SELECT
        id,
        type,
        status,
        progress,
        input,
        error_message,
        created_at,
        updated_at
      FROM ai_tasks
      WHERE type = 'matrix'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`\n🔍 查找基于聚类任务 ${clusteringTaskId} 的成熟度矩阵任务...\n`);

    const matchedTasks = matrixTasks.filter(task => {
      if (task.input && task.input.clusteringTaskId) {
        return task.input.clusteringTaskId === clusteringTaskId;
      }
      return false;
    });

    if (matchedTasks.length === 0) {
      console.log('❌ 没有找到使用该聚类ID的成熟度矩阵任务');
      console.log('\n📋 最近10个矩阵任务的输入信息：\n');
      matrixTasks.forEach((task, index) => {
        console.log(`${index + 1}. 任务ID: ${task.id}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   输入clusteringTaskId: ${task.input?.clusteringTaskId || '无'}`);
        console.log('');
      });
    } else {
      console.log(`✅ 找到 ${matchedTasks.length} 个匹配的成熟度矩阵任务：\n`);

      for (const task of matchedTasks) {
        console.log(`📦 任务ID: ${task.id}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   进度: ${task.progress}%`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   更新时间: ${task.updated_at}`);

        if (task.error_message) {
          console.log(`   ❌ 错误信息: ${task.error_message.substring(0, 300)}`);
        }

        // 查询该任务的生成事件
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
          LIMIT 10
        `, [task.id]);

        console.log(`   📊 生成事件数: ${events.length}`);

        if (events.length > 0) {
          console.log(`   最近的事件：`);
          events.slice(0, 3).forEach((event, idx) => {
            console.log(`     ${idx + 1}. 模型: ${event.model}, 时间: ${event.execution_time_ms}ms`);
            if (event.error_message) {
              console.log(`        ❌ 错误: ${event.error_message.substring(0, 150)}`);
            }
          });
        } else {
          console.log(`   ⚠️  警告: 没有生成事件！任务可能未被Worker处理`);
        }

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

findMatrixByClusteringId();
