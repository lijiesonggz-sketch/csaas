const { Client } = require('pg');

async function checkClusteringCoverage() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 获取最新的聚类任务
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

    console.log('=== 检查缺失条款检测逻辑 ===\n');

    // 找到银行保险机构数据安全管理办法
    const bankDoc = input.documents.find(d => d.name.includes('银行保险'));

    if (bankDoc) {
      console.log(`【文档】${bankDoc.name}`);
      console.log(`文档ID: ${bankDoc.id}`);

      // 1. 从文档内容中提取所有条款ID
      const allClauseMatches = bankDoc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const allClauseIds = [...new Set(allClauseMatches)];
      allClauseIds.sort();

      console.log(`\n文档中的所有条款 (${allClauseIds.length}个):`);
      console.log(allClauseIds.slice(0, 20).join(', ') + (allClauseIds.length > 20 ? '...' : ''));

      // 2. 从聚类结果中提取该文档的已聚类条款
      const clusteredClauseIds = new Set();
      gpt4.categories.forEach(category => {
        category.clusters.forEach(cluster => {
          cluster.clauses.forEach(clause => {
            if (clause.source_document_id === bankDoc.id) {
              clusteredClauseIds.add(clause.clause_id);
            }
          });
        });
      });

      console.log(`\n已聚类的条款 (${clusteredClauseIds.size}个):`);
      const clusteredArray = Array.from(clusteredClauseIds).sort();
      console.log(clusteredArray.slice(0, 20).join(', ') + (clusteredArray.length > 20 ? '...' : ''));

      // 3. 找出缺失的条款
      const missingIds = allClauseIds.filter(id => !clusteredClauseIds.has(id));

      console.log(`\n⚠️ 缺失的条款 (${missingIds.length}个):`);
      if (missingIds.length > 0) {
        console.log(missingIds.join(', '));

        // 显示前5个缺失条款的内容
        console.log('\n缺失条款的内容（前5个）:');
        missingIds.slice(0, 5).forEach(id => {
          const regex = new RegExp(`${id}[^\\n]*\\n([\\s\\S]{0,150})`);
          const match = bankDoc.content.match(regex);
          if (match) {
            console.log(`\n${id}: ${match[1].trim()}`);
          }
        });
      } else {
        console.log('无');
      }

      // 4. 检查coverage_summary中的数据
      console.log('\n=== coverage_summary中的数据 ===');
      if (gpt4.coverage_summary && gpt4.coverage_summary.by_document[bankDoc.id]) {
        const stats = gpt4.coverage_summary.by_document[bankDoc.id];
        console.log(`total_clauses: ${stats.total_clauses}`);
        console.log(`clustered_clauses: ${stats.clustered_clauses}`);
        console.log(`missing_clause_ids: ${stats.missing_clause_ids.join(', ') || '空'}`);
      }
    }
  }

  await client.end();
}

checkClusteringCoverage().catch(console.error);
