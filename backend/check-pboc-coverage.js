const { Client } = require('pg');

async function checkPBOCCoverage() {
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

    console.log('=== 检查人民银行文档缺失条款 ===\n');

    // 找到人民银行文档
    const pbocDoc = input.documents.find(d => d.name.includes('人民银行'));

    if (pbocDoc) {
      console.log(`【文档】${pbocDoc.name}`);
      console.log(`文档ID: ${pbocDoc.id}`);

      // 1. 从文档内容中提取所有条款ID
      const allClauseMatches = pbocDoc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const allClauseIds = [...new Set(allClauseMatches)];
      allClauseIds.sort();

      console.log(`\n文档中的所有条款 (${allClauseIds.length}个):`);
      console.log(allClauseIds.join(', '));

      // 2. 从聚类结果中提取该文档的已聚类条款
      const clusteredClauseIds = new Set();
      const clusteredClausesDetail = [];

      gpt4.categories.forEach(category => {
        category.clusters.forEach(cluster => {
          cluster.clauses.forEach(clause => {
            if (clause.source_document_id === pbocDoc.id) {
              clusteredClauseIds.add(clause.clause_id);
              clusteredClausesDetail.push({
                id: clause.clause_id,
                text: clause.clause_text.substring(0, 100)
              });
            }
          });
        });
      });

      console.log(`\n已聚类的条款 (${clusteredClauseIds.size}个):`);
      const clusteredArray = Array.from(clusteredClauseIds).sort();
      console.log(clusteredArray.join(', '));

      // 3. 找出缺失的条款
      const missingIds = allClauseIds.filter(id => !clusteredClauseIds.has(id));

      console.log(`\n⚠️ 缺失的条款 (${missingIds.length}个):`);
      if (missingIds.length > 0) {
        console.log(missingIds.join(', '));

        // 显示所有缺失条款的内容
        console.log('\n缺失条款的内容:');
        missingIds.forEach(id => {
          const regex = new RegExp(`${id}[^\\n]*\\n([\\s\\S]{0,200})`);
          const match = pbocDoc.content.match(regex);
          if (match) {
            console.log(`\n${id}: ${match[1].trim().substring(0, 150)}`);
          }
        });
      } else {
        console.log('无');
      }

      // 4. 检查coverage_summary中的数据
      console.log('\n=== coverage_summary中的数据 ===');
      if (gpt4.coverage_summary && gpt4.coverage_summary.by_document[pbocDoc.id]) {
        const stats = gpt4.coverage_summary.by_document[pbocDoc.id];
        console.log(`total_clauses: ${stats.total_clauses}`);
        console.log(`clustered_clauses: ${stats.clustered_clauses}`);
        console.log(`missing_clause_ids: ${stats.missing_clause_ids.join(', ') || '空'}`);
      }

      // 5. 统计分析
      console.log('\n=== 覆盖率分析 ===');
      const coverageRate = (clusteredClauseIds.size / allClauseIds.length * 100).toFixed(1);
      console.log(`覆盖率: ${coverageRate}% (${clusteredClauseIds.size}/${allClauseIds.length})`);
      console.log(`缺失率: ${(100 - coverageRate).toFixed(1)}% (${missingIds.length}/${allClauseIds.length})`);

      // 6. 检查已提取的条款详情
      console.log('\n=== 已提取条款详情（前10条）===');
      clusteredClausesDetail.slice(0, 10).forEach(clause => {
        console.log(`\n${clause.id}:`);
        console.log(`  ${clause.text}...`);
      });
    }
  }

  await client.end();
}

checkPBOCCoverage().catch(console.error);
