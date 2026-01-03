const { Client } = require('pg');

async function checkClusteringResults() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  console.log('=== 检查最近的聚类生成结果 ===\n');

  // 查询最近的聚类结果
  const result = await client.query(`
    SELECT
      agr.id,
      agr.task_id,
      agr.selected_model,
      agr.confidence_level,
      agr.quality_scores,
      agr.created_at,
      at.status,
      at.type
    FROM ai_generation_results agr
    JOIN ai_tasks at ON agr.task_id = at.id
    WHERE at.type = 'clustering'
    ORDER BY agr.created_at DESC
    LIMIT 5
  `);

  if (result.rows.length === 0) {
    console.log('❌ 没有找到聚类任务结果');
    console.log('\n💡 建议：运行一个聚类任务来测试新功能');
  } else {
    console.log(`✅ 找到 ${result.rows.length} 个最近的聚类结果\n`);

    result.rows.forEach((row, index) => {
      console.log(`[${index + 1}] 结果 ID: ${row.id.substring(0, 8)}...`);
      console.log(`    任务ID: ${row.task_id.substring(0, 8)}...`);
      console.log(`    任务状态: ${row.status}`);
      console.log(`    选中模型: ${row.selected_model}`);
      console.log(`    置信度: ${row.confidence_level}`);

      if (row.quality_scores) {
        try {
          // 可能已经是对象，也可能是JSON字符串
          const scores = typeof row.quality_scores === 'string'
            ? JSON.parse(row.quality_scores)
            : row.quality_scores;

          console.log(`    质量分数:`);
          console.log(`      - 结构: ${scores.structural?.toFixed(4) || 'N/A'}`);
          console.log(`      - 语义: ${scores.semantic?.toFixed(4) || 'N/A'}`);
          console.log(`      - 细节: ${scores.detail?.toFixed(4) || 'N/A'}`);
        } catch (e) {
          console.log(`    质量分数: [解析失败] ${e.message}`);
        }
      }

      console.log(`    创建时间: ${row.created_at}`);
      console.log('');
    });

    // 检查置信度分布
    const confidenceDistribution = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    result.rows.forEach(row => {
      confidenceDistribution[row.confidence_level]++;
    });

    console.log('📊 置信度分布:');
    console.log(`    HIGH:   ${confidenceDistribution.HIGH} 个`);
    console.log(`    MEDIUM: ${confidenceDistribution.MEDIUM} 个`);
    console.log(`    LOW:    ${confidenceDistribution.LOW} 个`);

    // 判断是否使用了新功能
    const hasLowConfidence = confidenceDistribution.LOW > 0;
    const hasMediumConfidence = confidenceDistribution.MEDIUM > 0;

    if (hasLowConfidence || hasMediumConfidence) {
      console.log('\n✅ 动态置信度功能已启用！');
      console.log('   - LOW/MEDIUM 置信度表示单模型或2模型结果');
      console.log('   - HIGH 置信度表示3模型结果');
    } else {
      console.log('\n⚠️  所有结果都是 HIGH 置信度');
      console.log('   这可能意味着：');
      console.log('   1. 3个模型都成功了（功能正常）');
      console.log('   2. 或者这些是旧数据（在动态置信度功能之前）');
    }
  }

  await client.end();
}

checkClusteringResults().catch(console.error);
