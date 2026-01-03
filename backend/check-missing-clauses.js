const { Client } = require('pg');

async function checkMissingClauses() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 获取最新聚类任务和输入文档
  const res = await client.query(`
    SELECT t.input, r.gpt4_result
    FROM ai_tasks t
    JOIN ai_generation_results r ON r.task_id = t.id
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const { input, gpt4_result } = res.rows[0];
    const gpt4 = typeof gpt4_result === 'string' ? JSON.parse(gpt4_result) : gpt4_result;

    console.log('=== 检查缺失的条款 ===\n');

    // 提取AI实际使用的所有唯一clause_id
    const extractedClauseIds = new Set();

    if (gpt4.categories) {
      gpt4.categories.forEach(cat => {
        if (cat.clusters) {
          cat.clusters.forEach(cluster => {
            if (cluster.clauses) {
              cluster.clauses.forEach(clause => {
                extractedClauseIds.add(clause.clause_id);
              });
            }
          });
        }
      });
    }

    // 对每个文档检查缺失
    if (input && input.documents) {
      input.documents.forEach(doc => {
        console.log(`\n【文档】${doc.name}`);
        console.log(`文档ID: ${doc.id}`);

        // 找出这个文档对应的所有提取的clause_id
        const docExtractedIds = new Set();
        if (gpt4.categories) {
          gpt4.categories.forEach(cat => {
            if (cat.clusters) {
              cat.clusters.forEach(cluster => {
                if (cluster.clauses) {
                  cluster.clauses.forEach(clause => {
                    if (clause.source_document_id === doc.id) {
                      docExtractedIds.add(clause.clause_id);
                    }
                  });
                }
              });
            }
          });
        }

        // 从文档中提取所有"第XX条"
        const allMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
        const allClauseIds = [...new Set(allMatches)]; // 去重
        allClauseIds.sort();

        console.log(`\n  文档中的所有条款ID (${allClauseIds.length}个):`);
        console.log(`  ${allClauseIds.slice(0, 30).join(', ')}${allClauseIds.length > 30 ? '...' : ''}`);

        // 找出缺失的条款ID
        const missingIds = allClauseIds.filter(id => !docExtractedIds.has(id));

        if (missingIds.length > 0) {
          console.log(`\n  ⚠️ 缺失的条款 (${missingIds.length}个):`);
          console.log(`  ${missingIds.join(', ')}`);

          // 显示缺失条款的内容
          console.log(`\n  缺失条款的内容:`);
          missingIds.slice(0, 10).forEach(id => {
            // 从文档中找到这个条款的内容
            const regex = new RegExp(`${id}[^\n]*\\n([\\s\\S]{0,150})`);
            const match = doc.content.match(regex);
            if (match) {
              console.log(`\n  ${id}: ${match[1].trim()}`);
            }
          });
        } else {
          console.log(`\n  ✅ 所有条款都已提取`);
        }

        console.log(`\n  提取的唯一条款数: ${docExtractedIds.size}`);
        console.log(`  实际条款数: ${allClauseIds.length}`);
        console.log(`  覆盖率: ${(docExtractedIds.size / allClauseIds.length * 100).toFixed(1)}%`);
      });
    }
  }

  await client.end();
}

checkMissingClauses().catch(console.error);
