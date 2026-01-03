const { Client } = require('pg');

async function findMissingClauses() {
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

    const bankDoc = input.documents.find(d => d.name.includes('银行保险'));

    if (bankDoc) {
      console.log(`【文档】${bankDoc.name}\n`);

      // 提取所有"第XX条"（包括重复的）
      const allMatches = bankDoc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const uniqueClauseIds = [...new Set(allMatches)];

      console.log(`所有"第XX条"出现次数: ${allMatches.length}`);
      console.log(`唯一条款数: ${uniqueClauseIds.length}\n`);

      // 找出重复的条款
      const clauseCount = {};
      allMatches.forEach(id => {
        clauseCount[id] = (clauseCount[id] || 0) + 1;
      });

      const duplicateClauses = Object.entries(clauseCount)
        .filter(([id, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

      if (duplicateClauses.length > 0) {
        console.log('重复出现的条款（可能是引用，不是新条款）:');
        duplicateClauses.forEach(([id, count]) => {
          console.log(`  ${id}: 出现 ${count} 次`);

          // 找出这些重复条款出现的位置
          const regex = new RegExp(`(.{0,50})${id}[^\\n]*\\n([\\s\\S]{0,100})`, 'g');
          let match;
          let idx = 0;
          while ((match = regex.exec(bankDoc.content)) !== null && idx < 3) {
            console.log(`    [${idx + 1}] ...${match[1]}${id}...`);
            idx++;
          }
        });
        console.log('');
      }

      // 从聚类中提取已聚类的条款
      const clusteredIds = new Set();
      gpt4.categories.forEach(category => {
        category.clusters.forEach(cluster => {
          cluster.clauses.forEach(clause => {
            if (clause.source_document_id === bankDoc.id) {
              clusteredIds.add(clause.clause_id);
            }
          });
        });
      });

      console.log(`已聚类的唯一条款数: ${clusteredIds.size}\n`);

      // 找出缺失的条款（在文档中存在但未被聚类的）
      const missingIds = uniqueClauseIds.filter(id => !clusteredIds.has(id));

      if (missingIds.length > 0) {
        console.log(`⚠️ 缺失的条款 (${missingIds.length}个):`);
        missingIds.forEach(id => {
          console.log(`  ${id}`);

          // 提取该条款的内容
          const regex = new RegExp(`${id}[^\\n]*\\n([\\s\\S]{0,200})`);
          const match = bankDoc.content.match(regex);
          if (match) {
            console.log(`    内容: ${match[1].trim()}`);
          }

          // 检查这个条款是否是重复的
          if (duplicateClauses.find(([dupId]) => dupId === id)) {
            console.log(`    ℹ️ 这个条款在文档中出现了${clauseCount[id]}次（可能是引用），AI可能只提取了一次`);
          }
        });
      } else {
        console.log('✅ 所有唯一条款都已被聚类');
        console.log(`\n总结: 虽然统计显示80个条款，但实际只有${uniqueClauseIds.length}个不同的条款ID。`);
        console.log(`差异原因: 有${allMatches.length - uniqueClauseIds.length}个条款ID在文档中重复出现（可能是条款间的相互引用）。`);
      }
    }
  }

  await client.end();
}

findMissingClauses().catch(console.error);
