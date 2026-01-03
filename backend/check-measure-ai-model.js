const { Client } = require('pg');

async function checkMeasureModels() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const successTaskId = 'd5e35635-b2c7-4c53-8057-69d229f2d6c4';

    console.log('查询成功任务的AI模型配置:\n');

    // 查询所有措施使用的AI模型
    const modelsResult = await client.query(`
      SELECT DISTINCT ai_model
      FROM action_plan_measures
      WHERE task_id = $1
    `, [successTaskId]);

    console.log('使用的AI模型:');
    modelsResult.rows.forEach(row => {
      console.log('  -', row.ai_model);
    });

    // 查询措施样本，看完整的记录
    console.log('\n\n措施样本（前3条）:');
    const sampleResult = await client.query(`
      SELECT
        cluster_name,
        title,
        ai_model,
        created_at
      FROM action_plan_measures
      WHERE task_id = $1
      ORDER BY sort_order
      LIMIT 3
    `, [successTaskId]);

    sampleResult.rows.forEach((measure, index) => {
      console.log(`\n${index + 1}. ${measure.title}`);
      console.log('   聚类:', measure.cluster_name);
      console.log('   AI模型:', measure.ai_model);
      console.log('   创建时间:', measure.created_at);
    });

    // 统计每个聚类的措施数
    console.log('\n\n各聚类措施数量:');
    const clusterCount = await client.query(`
      SELECT
        cluster_name,
        COUNT(*) as count
      FROM action_plan_measures
      WHERE task_id = $1
      GROUP BY cluster_name
      ORDER BY count DESC
    `, [successTaskId]);

    clusterCount.rows.forEach(row => {
      console.log(`  ${row.cluster_name}: ${row.count}条`);
    });

    // 总计
    const totalCount = await client.query(`
      SELECT COUNT(*) as count
      FROM action_plan_measures
      WHERE task_id = $1
    `, [successTaskId]);

    console.log('\n总计:', totalCount.rows[0].count, '条措施');

  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    await client.end();
  }
}

checkMeasureModels();
