const { Client } = require('pg');

async function checkOutputLength() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  // 获取所有AI生成事件
  const events = await client.query(`
    SELECT model, output, metadata, execution_time_ms
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('=== 所有AI生成事件 ===');
  console.log(`事件总数: ${events.rows.length}\n`);

  events.rows.forEach((event, idx) => {
    console.log(`[${idx + 1}] ${event.model}`);
    console.log(`  执行时间: ${event.execution_time_ms}ms`);

    if (event.output) {
      if (typeof event.output === 'object' && event.output.content) {
        const content = event.output.content;
        console.log(`  Content类型: ${typeof content}`);
        console.log(`  Content长度: ${content?.length || 0} 字符`);

        // 尝试解析JSON，看看能解析到什么程度
        if (typeof content === 'string') {
          // 查找最后一个完整的category
          const lastCategoryStart = content.lastIndexOf('{"id": "category_');
          const lastCategoryEnd = content.indexOf('}', lastCategoryStart + 1000);

          if (lastCategoryStart > 0 && lastCategoryEnd > lastCategoryStart) {
            // 从最后一个category开始，向前找完整的categories数组
            let bracketCount = 0;
            let arrayStart = -1;

            for (let i = lastCategoryStart; i >= 0; i--) {
              if (content[i] === ']') {
                bracketCount++;
              } else if (content[i] === '[') {
                bracketCount--;
                if (bracketCount === 0) {
                  arrayStart = i;
                  break;
                }
              }
            }

            if (arrayStart >= 0) {
              const categoriesStr = content.substring(arrayStart, lastCategoryEnd + 1);
              try {
                const categories = JSON.parse(categoriesStr);
                console.log(`\n  ✅ 找到 ${categories.length} 个完整的主类别`);

                categories.forEach((cat, idx) => {
                  const clusterCount = cat.clusters?.length || 0;
                  console.log(`    ${idx + 1}. ${cat.name} (${clusterCount}个子聚类)`);
                });

                // 统计总数
                const totalClusters = categories.reduce((sum, cat) => sum + (cat.clusters?.length || 0), 0);
                const totalClauses = categories.reduce((sum, cat) =>
                  sum + cat.clusters.reduce((s, c) => s + (c.clauses?.length || 0), 0), 0);

                console.log(`\n  总计:`);
                console.log(`    主类别: ${categories.length}`);
                console.log(`    子聚类: ${totalClusters}`);
                console.log(`    条款: ${totalClauses}`);
              } catch (parseErr) {
                console.log(`  ❌ 无法解析categories数组: ${parseErr.message}`);
              }
            }
          }
        }
      }

      // 检查coverage_summary
      if (event.output.content && typeof event.output.content === 'string') {
        const coverageIdx = event.output.content.indexOf('"coverage_summary"');
        if (coverageIdx > 0) {
          console.log(`  找到coverage_summary在位置: ${coverageIdx}`);
        }
      }
    }

    console.log('');
  });

  await client.end();
}

checkOutputLength().catch(console.error);
