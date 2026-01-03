const { Client } = require('pg');

async function checkPBOCClauses() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

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

    const pbocDoc = input.documents.find(d => d.name.includes('人民银行'));

    if (pbocDoc) {
      console.log(`【文档】${pbocDoc.name}\n`);
      console.log(`文档ID: ${pbocDoc.id}\n`);

      // 从文档内容提取所有条款
      const allMatches = pbocDoc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const uniqueIds = [...new Set(allMatches)];

      console.log(`文档中"第XX条"出现次数: ${allMatches.length}`);
      console.log(`唯一条款数: ${uniqueIds.length}\n`);

      // 显示前20个和最后20个
      console.log(`前20个条款: ${uniqueIds.slice(0, 20).join(', ')}`);
      console.log(`后20个条款: ${uniqueIds.slice(-20).join(', ')}\n`);

      // 从聚类结果中提取该文档的条款
      const clusteredIds = [];
      gpt4.categories.forEach(cat => {
        cat.clusters.forEach(cluster => {
          cluster.clauses.forEach(clause => {
            if (clause.source_document_id === pbocDoc.id) {
              clusteredIds.push(clause.clause_id);
            }
          });
        });
      });

      const uniqueClusteredIds = [...new Set(clusteredIds)];

      console.log(`聚类中的条款总数（含重复）: ${clusteredIds.length}`);
      console.log(`聚类中的唯一条款数: ${uniqueClusteredIds.length}\n`);

      // 找出缺失的
      const missing = uniqueIds.filter(id => !uniqueClusteredIds.includes(id));
      console.log(`缺失的条款 (${missing.length}个): ${missing.join(', ') || '无'}\n`);

      // 找出重复的
      const idCount = {};
      clusteredIds.forEach(id => {
        idCount[id] = (idCount[id] || 0) + 1;
      });

      const duplicates = Object.entries(idCount).filter(([id, count]) => count > 1);
      console.log(`重复的条款 (${duplicates.length}个):`);
      duplicates.slice(0, 10).forEach(([id, count]) => {
        console.log(`  ${id}: 出现${count}次`);
      });

      // 检查coverage_summary
      console.log('\n=== coverage_summary中的数据 ===');
      if (gpt4.coverage_summary && gpt4.coverage_summary.by_document[pbocDoc.id]) {
        const stats = gpt4.coverage_summary.by_document[pbocDoc.id];
        console.log(`total_clauses: ${stats.total_clauses}`);
        console.log(`clustered_clauses: ${stats.clustered_clauses}`);
        console.log(`missing_clause_ids: ${stats.missing_clause_ids.join(', ') || '空'}`);
      }
    }
  }

  await client.end();
}

checkPBOCClauses().catch(console.error);
