const { Client } = require('pg');

async function checkPBOCDocument() {
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
      console.log(`【文档】${pbocDoc.name}\n`);
      console.log(`文档总长度: ${pbocDoc.content.length} 字符\n`);

      // 尝试不同的匹配模式
      const patterns = [
        { name: '第XX条格式', pattern: /第[一二三四五六七八九十百千]+条/g },
        { name: '附件格式', pattern: /附件[一二三四五六七八九十百千]+/g },
        { name: '章节', pattern: /第[一二三四五六七八九十百千]+[章]/g },
        { name: '数字编号', pattern: /^\d+[、\.]/gm },
      ];

      patterns.forEach(({ name, pattern }) => {
        const matches = pbocDoc.content.match(pattern) || [];
        const unique = [...new Set(matches)];
        console.log(`${name}: ${matches.length}次匹配, ${unique.length}个唯一`);
        if (unique.length > 0 && unique.length <= 15) {
          console.log(`  示例: ${unique.join(', ')}`);
        }
      });

      // 显示文档开头和结尾
      console.log('\n=== 文档开头（前500字符）===');
      console.log(pbocDoc.content.substring(0, 500));

      console.log('\n=== 文档结尾（最后500字符）===');
      console.log(pbocDoc.content.substring(pbocDoc.content.length - 500));

      // 检查是否有非标准条款编号
      console.log('\n=== 搜索可能的条款编号（包含数字）===');
      const lines = pbocDoc.content.split('\n');
      const clauseLines = lines.filter(line => line.match(/\d+、/));

      if (clauseLines.length > 0) {
        console.log(`找到 ${clauseLines.length} 行数字编号格式：`);
        clauseLines.slice(0, 10).forEach((line, idx) => {
          console.log(`  ${idx + 1}. ${line.trim().substring(0, 60)}`);
        });
      }

      // 统计文档中的所有数字编号
      const numberMatches = pbocDoc.content.match(/\d+、/g) || [];
      const uniqueNumbers = [...new Set(numberMatches)];
      console.log(`\n所有"数字、"格式: ${numberMatches.length}次, ${uniqueNumbers.length}个唯一`);

      if (uniqueNumbers.length > 0) {
        const nums = uniqueNumbers.map(n => parseInt(n)).filter(n => !isNaN(n));
        nums.sort((a, b) => a - b);
        console.log(`编号范围: ${nums[0]} - ${nums[nums.length - 1]}`);
        console.log(`前10个: ${nums.slice(0, 10).join(', ')}`);
        console.log(`后10个: ${nums.slice(-10).join(', ')}`);
      }
    }
  }

  await client.end();
}

checkPBOCDocument().catch(console.error);
