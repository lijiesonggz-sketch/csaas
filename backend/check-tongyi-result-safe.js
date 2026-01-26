const { Client } = require('pg');
const fs = require('fs');

async function checkTongyiResult() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  // 获取通义千问的AI生成事件
  const events = await client.query(`
    SELECT id, model, output, execution_time_ms
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
    ORDER BY created_at ASC
  `);

  if (events.rows.length > 0) {
    const event = events.rows[0];
    console.log('=== 通义千问生成结果 ===');
    console.log('执行时间:', event.execution_time_ms, 'ms (', (event.execution_time_ms / 1000).toFixed(1), '秒)');

    if (event.output) {
      const outputStr = typeof event.output === 'string' ? event.output : JSON.stringify(event.output);

      // 尝试提取content字段
      const contentMatch = outputStr.match(/"content"\s*:\s*"([^"]*(?:\\"[^"]*[^\\"]*)*[^"]*)"/);
      if (contentMatch) {
        let contentStr = contentMatch[1].replace(/\\"/g, '"');
        console.log('\n找到content，长度:', contentStr.length, '字符');

        // 保存到文件以便检查
        fs.writeFileSync('tongyi-content.json', contentStr);
        console.log('已保存到 tongyi-content.json');

        try {
          // 尝试从后往前解析，找到完整的JSON对象
          let braceCount = 0;
          let jsonStart = -1;

          for (let i = contentStr.length - 1; i >= 0; i--) {
            if (contentStr[i] === '}') {
              braceCount++;
            } else if (contentStr[i] === '{') {
              braceCount--;
              if (braceCount === 0) {
                jsonStart = i;
                break;
              }
            }
          }

          if (jsonStart >= 0) {
            const jsonStr = contentStr.substring(jsonStart);
            const result = JSON.parse(jsonStr);

            console.log('\n=== 聚类统计 ===');
            console.log('主类别数量:', result.categories?.length || 0);

            let totalClusters = 0;
            let totalClauses = 0;

            result.categories?.forEach((cat, idx) => {
              const clusterCount = cat.clusters?.length || 0;
              totalClusters += clusterCount;

              cat.clusters?.forEach(cluster => {
                totalClauses += cluster.clauses?.length || 0;
              });

              console.log(`\n主类别 ${idx + 1}: ${cat.name}`);
              console.log(`  描述: ${cat.description?.substring(0, 80)}...`);
              console.log(`  子聚类数: ${clusterCount}`);
            });

            console.log('\n=== 总计 ===');
            console.log('主类别数:', result.categories?.length || 0);
            console.log('总子聚类数:', totalClusters);
            console.log('总条款数:', totalClauses);

            // 覆盖度统计
            if (result.coverage_summary) {
              console.log('\n=== 覆盖度统计 ===');
              const coverage = result.coverage_summary;
              console.log('总条款数:', coverage.overall?.total_clauses || 'N/A');
              console.log('已聚类条款数:', coverage.overall?.clustered_clauses || 'N/A');
              console.log('覆盖率:', coverage.overall?.coverage_rate
                ? ((coverage.overall.coverage_rate * 100).toFixed(2) + '%')
                : 'N/A');
              console.log('缺失条款数:', coverage.overall?.missing_clause_ids?.length || 0);
            }
          }
        } catch (parseErr) {
          console.log('JSON解析失败:', parseErr.message);
          console.log('请手动检查 tongyi-content.json 文件');
        }
      } else {
        console.log('未找到content字段');
      }
    }
  } else {
    console.log('❌ 没有找到通义千问的生成事件');
  }

  await client.end();
}

checkTongyiResult().catch(console.error);
