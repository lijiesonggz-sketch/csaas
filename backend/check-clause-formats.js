const { Client } = require('pg');

async function checkClauseFormats() {
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
    SELECT t.input
    FROM ai_tasks t
    WHERE t.type = 'clustering'
    ORDER BY t.created_at DESC
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    const { input } = res.rows[0];

    // 找到银行保险机构数据安全管理办法
    const bankDoc = input.documents.find(d => d.name.includes('银行保险'));

    if (bankDoc) {
      console.log(`【文档】${bankDoc.name}\n`);

      // 检查各种可能的条款格式
      const patterns = [
        { name: '第XX条', pattern: /第[一二三四五六七八九十百千]+条/g },
        { name: '数字编号', pattern: /^\d+[\.\、]/gm },
        { name: '中文数字', pattern: /^[一二三四五六七八九十百]+[\.\、]/gm },
        { name: '章节', pattern: /第[一二三四五六七八九十百千]+[章节]/g },
      ];

      patterns.forEach(({ name, pattern }) => {
        const matches = bankDoc.content.match(pattern) || [];
        const uniqueMatches = [...new Set(matches)];
        console.log(`${name}格式: 找到 ${matches.length} 个匹配，${uniqueMatches.length} 个唯一`);
        if (uniqueMatches.length > 0 && uniqueMatches.length <= 20) {
          console.log(`  示例: ${uniqueMatches.slice(0, 10).join(', ')}`);
        }
      });

      // 显示文档的前500个字符，看看格式
      console.log('\n文档开头内容（前500字符）:');
      console.log(bankDoc.content.substring(0, 500));

      // 检查是否有特殊标记
      console.log('\n\n搜索可能的非标准条款标识...');
      const lines = bankDoc.content.split('\n');
      const suspiciousLines = lines.filter(line => {
        return line.match(/^[第\d\(\（][^\]]*[\）\)\、\.]/) && !line.match(/第[一二三四五六七八九十百千]+条/);
      });

      if (suspiciousLines.length > 0) {
        console.log(`找到 ${suspiciousLines.length} 行可能的非标准条款格式：`);
        suspiciousLines.slice(0, 20).forEach((line, idx) => {
          console.log(`  ${idx + 1}. ${line.trim().substring(0, 60)}`);
        });
      }
    }
  }

  await client.end();
}

checkClauseFormats().catch(console.error);
