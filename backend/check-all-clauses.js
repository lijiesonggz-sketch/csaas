const { Client } = require('pg');

async function checkAllClauses() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(`
    SELECT t.input
    FROM ai_tasks t
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const { input } = res.rows[0];
    const pbocDoc = input.documents.find(d => d.name.includes('人民银行'));

    if (pbocDoc) {
      console.log('【详细检查所有条款】\n');

      // 提取所有"第XX条"及其位置
      const regex = /第([一二三四五六七八九十百千]+)条/g;
      const matches = [];
      let match;

      while ((match = regex.exec(pbocDoc.content)) !== null) {
        matches.push({
          id: `第${match[1]}条`,
          number: match[1],
          position: match.index,
        });
      }

      console.log(`总共找到 ${matches.length} 个"第XX条"\n`);

      // 按顺序显示所有条款
      matches.forEach((m, idx) => {
        // 提取该条款的内容（前100字符）
        const start = Math.max(0, m.position - 10);
        const end = Math.min(pbocDoc.content.length, m.position + 100);
        const context = pbocDoc.content.substring(start, end).replace(/\n/g, ' ');

        console.log(`${idx + 1}. ${m.id} (位置${m.position})`);
        console.log(`   ${context}...\n`);
      });

      // 转换中文数字到阿拉伯数字
      function chineseToNumber(chinese) {
        const map = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
          '二十': 20, '三十': 30, '四十': 40, '五十': 50,
        };

        // 处理"二十X"格式
        if (chinese.startsWith('二十') || chinese.startsWith('三十') ||
            chinese.startsWith('四十') || chinese.startsWith('五十')) {
          const tens = chinese.substring(0, 2);
          const ones = chinese.substring(2);
          return (map[tens] || 0) + (map[ones] || 0);
        }

        // 处理"十几"格式
        if (chinese.startsWith('十')) {
          const ones = chinese.substring(1);
          return 10 + (map[ones] || 0);
        }

        return map[chinese] || parseInt(chinese) || 0;
      }

      // 转换所有条款编号为数字
      const numbers = matches.map(m => chineseToNumber(m.number));
      const uniqueNumbers = [...new Set(numbers)];

      console.log(`=== 统计信息 ===`);
      console.log(`总匹配次数: ${matches.length}`);
      console.log(`唯一条款数: ${uniqueNumbers.length}`);
      console.log(`条款编号范围: ${Math.min(...uniqueNumbers)} - ${Math.max(...uniqueNumbers)}`);
      console.log(`缺失的编号: ${[]}`);

      // 找出缺失的编号
      const missing = [];
      for (let i = Math.min(...uniqueNumbers); i <= Math.max(...uniqueNumbers); i++) {
        if (!uniqueNumbers.includes(i)) {
          missing.push(i);
        }
      }

      if (missing.length > 0) {
        console.log(`缺失条款编号 (${missing.length}个): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '...' : ''}`);
      }
    }
  }

  await client.end();
}

checkAllClauses().catch(console.error);
