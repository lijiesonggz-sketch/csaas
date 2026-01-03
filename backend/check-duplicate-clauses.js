const { Client } = require('pg');

async function checkDuplicates() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(`
    SELECT r.gpt4_result
    FROM ai_generation_results r
    WHERE r.generation_type = 'clustering'
    ORDER BY r.created_at DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const row = res.rows[0];
    const gpt4 = typeof row.gpt4_result === 'string' ? JSON.parse(row.gpt4_result) : row.gpt4_result;

    console.log('=== 检查重复和异常条款 ===\n');

    const docClausesMap = new Map();

    if (gpt4.categories) {
      gpt4.categories.forEach(cat => {
        if (cat.clusters) {
          cat.clusters.forEach(cluster => {
            if (cluster.clauses) {
              cluster.clauses.forEach(clause => {
                const docId = clause.source_document_id;
                if (!docClausesMap.has(docId)) {
                  docClausesMap.set(docId, []);
                }
                docClausesMap.get(docId).push({
                  clause_id: clause.clause_id,
                  text: clause.clause_text,
                  category: cat.name,
                  cluster: cluster.name,
                });
              });
            }
          });
        }
      });
    }

    docClausesMap.forEach((clauses, docId) => {
      console.log(`\n文档ID: ${docId}`);
      console.log(`  总提取条款数: ${clauses.length}`);

      // 检查重复的clause_id
      const clauseIdCount = new Map();
      clauses.forEach(c => {
        const id = c.clause_id;
        clauseIdCount.set(id, (clauseIdCount.get(id) || 0) + 1);
      });

      const duplicates = [];
      clauseIdCount.forEach((count, id) => {
        if (count > 1) {
          duplicates.push({ id, count });
        }
      });

      if (duplicates.length > 0) {
        console.log(`\n  ⚠️ 发现重复的条款ID (${duplicates.length}个):`);
        duplicates.forEach(d => {
          console.log(`    - ${d.clause_id || d.id}: 出现${d.count}次`);
          // 显示这些重复条款的详细信息
          const duplicateClauses = clauses.filter(c => c.clause_id === (d.clause_id || d.id));
          duplicateClauses.forEach((c, idx) => {
            console.log(`      [${idx + 1}] ${c.category} / ${c.cluster}`);
            console.log(`         ${c.text?.substring(0, 60)}...`);
          });
        });
      }

      // 检查异常的clause_id（不匹配"第XX条"格式）
      const abnormalClauses = clauses.filter(c => {
        const id = c.clause_id;
        // 正常格式应该是"第XX条"或数字
        return !/^第[一二三四五六七八九十百]+条/.test(id) && !/^\d+$/.test(id);
      });

      if (abnormalClauses.length > 0) {
        console.log(`\n  ⚠️ 发现异常格式的条款ID (${abnormalClauses.length}个):`);
        abnormalClauses.slice(0, 10).forEach(c => {
          console.log(`    - ID: "${c.clause_id}"`);
          console.log(`      ${c.text?.substring(0, 60)}...`);
        });
      }

      // 显示所有唯一的条款ID（按出现顺序）
      const uniqueIds = [...new Set(clauses.map(c => c.clause_id))];
      console.log(`\n  唯一条款ID数: ${uniqueIds.length}`);
      console.log(`  前20个唯一ID: ${uniqueIds.slice(0, 20).join(', ')}`);

      // 检查是否有遗漏（通过数字ID排序）
      const numericIds = uniqueIds
        .map(id => {
          // 尝试从"第XX条"中提取数字
          const match = id.match(/第([一二三四五六七八九十百]+)条/);
          if (match) {
            const chineseNum = match[1];
            // 简单转换中文数字到阿拉伯数字
            const num = chineseToNumber(chineseNum);
            return num;
          }
          return null;
        })
        .filter(n => n !== null)
        .sort((a, b) => a - b);

      console.log(`  检测到的数字条款号范围: ${numericIds[0]} - ${numericIds[numericIds.length - 1]}`);

      // 检查缺失的数字
      const missingNumbers = [];
      for (let i = numericIds[0]; i <= numericIds[numericIds.length - 1]; i++) {
        if (!numericIds.includes(i)) {
          missingNumbers.push(i);
        }
      }

      if (missingNumbers.length > 0 && missingNumbers.length <= 20) {
        console.log(`  可能缺失的条款号: ${missingNumbers.slice(0, 20).join(', ')}`);
      }
    });
  }

  await client.end();
}

// 简单的中文数字转换
function chineseToNumber(chinese) {
  const map = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '二十': 20, '三十': 30, '四十': 40, '五十': 50,
    '六十': 60, '七十': 70, '八十': 80, '九十': 90
  };

  if (map[chinese]) return map[chinese];

  // 处理"二十X"格式
  if (chinese.startsWith('二十') || chinese.startsWith('三十') ||
      chinese.startsWith('四十') || chinese.startsWith('五十') ||
      chinese.startsWith('六十') || chinese.startsWith('七十') ||
      chinese.startsWith('八十') || chinese.startsWith('九十')) {
    const tens = chinese[0] + chinese[1];
    const ones = chinese.substring(2);
    return (map[tens] || 0) + (map[ones] || 0);
  }

  // 处理"十几"格式
  if (chinese.startsWith('十')) {
    const ones = chinese.substring(1);
    return 10 + (map[ones] || 0);
  }

  return parseInt(chinese) || 0;
}

checkDuplicates().catch(console.error);
