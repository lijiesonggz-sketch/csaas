const { Client } = require('pg');

async function checkAllModels() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(
    "SELECT gpt4_result, claude_result, domestic_result, selected_model, confidence_level, quality_scores FROM ai_generation_results WHERE task_id = '51627820-d0d1-492c-ab05-d78371fe324f'"
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];

    console.log('=== 聚类结果对比 ===\n');
    console.log('当前选中模型:', row.selected_model);
    console.log('置信度:', row.confidence_level);

    // 分析每个模型的结果
    const models = [
      { name: 'GPT-4/GLM-4.7', result: row.gpt4_result, key: 'gpt4_result' },
      { name: 'Claude', result: row.claude_result, key: 'claude_result' },
      { name: '通义千问(Domestic)', result: row.domestic_result, key: 'domestic_result' }
    ];

    models.forEach(model => {
      console.log(`\n【${model.name}】`);
      if (!model.result) {
        console.log('  结果: null/失败');
        return;
      }

      try {
        const parsed = typeof model.result === 'string' ? JSON.parse(model.result) : model.result;

        if (parsed.categories) {
          let totalClusters = 0;
          let totalClauses = 0;

          parsed.categories.forEach((cat, idx) => {
            console.log(`\n  Category ${idx + 1}: ${cat.name || '(未命名)'}`);
            if (cat.clusters) {
              totalClusters += cat.clusters.length;
              cat.clusters.forEach((cluster, cIdx) => {
                const clauseCount = cluster.clauses?.length || 0;
                totalClauses += clauseCount;
                console.log(`    Cluster ${cIdx + 1}: ${cluster.name || '(未命名)'} - ${clauseCount}个条款`);
              });
            }
          });

          console.log(`\n  ✅ 总计: ${parsed.categories.length}个大类, ${totalClusters}个聚类, ${totalClauses}个条款`);

          // 显示第一个条款的内容示例
          if (parsed.categories[0]?.clusters[0]?.clauses[0]) {
            const firstClause = parsed.categories[0].clusters[0].clauses[0];
            console.log(`\n  示例条款:`);
            console.log(`    来源: ${firstClause.sourceDocumentId || 'N/A'}`);
            console.log(`    内容: ${firstClause.content?.substring(0, 100) || 'N/A'}...`);
          }
        } else {
          console.log('  无categories字段');
          console.log('  结果keys:', Object.keys(parsed));
        }
      } catch (e) {
        console.log('  解析失败:', e.message);
        console.log('  raw result:', String(model.result).substring(0, 200));
      }
    });

    // 显示质量分数
    console.log('\n\n=== 质量评估 ===');
    if (row.quality_scores) {
      console.log(JSON.stringify(row.quality_scores, null, 2));
    }
  }

  await client.end();
}

checkAllModels().catch(console.error);
