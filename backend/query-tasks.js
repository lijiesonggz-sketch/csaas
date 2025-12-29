require('dotenv').config({ path: '.env.development' });
const { Client } = require('pg');

async function queryTasks() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas'
  });

  try {
    await client.connect();

    // 先查询所有已完成的任务，看看有什么类型
    const allCompleted = await client.query(`
      SELECT id, type, status, created_at
      FROM ai_tasks
      WHERE status = 'completed'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('\n=== 最近完成的所有任务 ===\n');
    allCompleted.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   类型: ${row.type}`);
      console.log(`   状态: ${row.status}`);
      console.log(`   时间: ${row.created_at}`);
      console.log('');
    });

    // 查询最近的聚类任务 (clustering类型)
    const clusteringResult = await client.query(`
      SELECT id, type, status, created_at
      FROM ai_tasks
      WHERE type = 'clustering'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n=== 最近的聚类任务 (clustering) ===\n');

    if (clusteringResult.rows.length === 0) {
      console.log('❌ 没有找到聚类任务');
      console.log('\n提示：请先在前端完成一次聚类生成');
    } else {
      clusteringResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. 任务ID: ${row.id}`);
        console.log(`   类型: ${row.type}`);
        console.log(`   状态: ${row.status}`);
        console.log(`   创建时间: ${row.created_at}`);
        console.log('');
      });

      const latestCompleted = clusteringResult.rows.find(r => r.status === 'completed');
      if (latestCompleted) {
        console.log('\n✅ 最新完成的聚类任务ID（用于测试矩阵生成）:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(latestCompleted.id);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.log('\n⚠️  有聚类任务但都处于processing状态');
        console.log('\n正在检查是否有生成结果...\n');

        // 检查ai_generation_results表
        const resultsQuery = await client.query(`
          SELECT task_id, generation_type, selected_model, confidence_level, created_at
          FROM ai_generation_results
          WHERE task_id = ANY($1)
          ORDER BY created_at DESC
        `, [clusteringResult.rows.map(r => r.id)]);

        if (resultsQuery.rows.length > 0) {
          console.log('✅ 找到生成结果！（任务虽然显示processing，但结果已生成）\n');
          resultsQuery.rows.forEach((row, index) => {
            console.log(`${index + 1}. 任务ID: ${row.task_id}`);
            console.log(`   类型: ${row.generation_type}`);
            console.log(`   选中模型: ${row.selected_model}`);
            console.log(`   置信度: ${row.confidence_level}`);
            console.log(`   创建时间: ${row.created_at}`);
            console.log('');
          });

          console.log('\n💡 使用以下任务ID进行矩阵生成测试:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(resultsQuery.rows[0].task_id);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        } else {
          console.log('❌ 没有找到生成结果');
          console.log('\n建议：请在前端重新运行一次聚类生成任务');
        }
      }
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await client.end();
  }
}

queryTasks();
