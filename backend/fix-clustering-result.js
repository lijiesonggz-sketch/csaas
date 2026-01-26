const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fixClustering() {
  await client.connect();

  const taskId = '4a3f091a-b1a4-4279-a5bc-111c73c88520';

  console.log('=== 修复 Clustering 任务结果 ===\n');
  console.log('任务ID:', taskId);

  // 1. 获取当前的result
  const currentResult = await client.query(
    "SELECT result FROM ai_tasks WHERE id = '" + taskId + "'"
  );

  if (currentResult.rows.length === 0) {
    console.log('❌ 没有找到任务');
    await client.end();
    return;
  }

  const resultObj = typeof currentResult.rows[0].result === 'string'
    ? JSON.parse(currentResult.rows[0].result)
    : currentResult.rows[0].result;

  // 2. 解析content中的实际JSON
  if (!resultObj.content) {
    console.log('❌ result中没有content字段');
    await client.end();
    return;
  }

  const actualResult = JSON.parse(resultObj.content);

  // 3. 添加taskId
  actualResult.taskId = taskId;

  console.log('提取数据:');
  console.log('  selectedModel:', actualResult.selectedModel);
  console.log('  categories数量:', actualResult.categories?.length);

  let totalClusters = 0;
  actualResult.categories?.forEach((cat) => {
    totalClusters += cat.clusters?.length || 0;
  });
  console.log('  clusters总数:', totalClusters);
  console.log('  覆盖率:', ((actualResult.coverage_summary?.overall?.coverage_rate || 0) * 100).toFixed(1) + '%');

  const clusteringData = actualResult;

  // 更新数据库
  await client.query(`
    UPDATE ai_tasks
    SET result = $1
    WHERE id = $2
  `, [JSON.stringify(clusteringData), taskId]);

  console.log('\n✅ 聚类结果已修复并更新！');

  // 验证
  const verify = await client.query(`
    SELECT result
    FROM ai_tasks
    WHERE id = $1
  `, [taskId]);

  const updated = verify.rows[0];
  console.log('\n=== 验证 ===');
  console.log('Has categories:', !!updated.result.categories);
  console.log('Categories count:', updated.result.categories?.length || 0);
  console.log('Has clustering_logic:', !!updated.result.clustering_logic);
  console.log('Has coverage_summary:', !!updated.result.coverage_summary);
  console.log('Coverage rate:', ((updated.result.coverage_summary?.overall?.coverage_rate || 0) * 100).toFixed(1) + '%');

  await client.end();
}

fixClustering().catch(console.error);
