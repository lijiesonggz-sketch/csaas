const { Client } = require('pg');

async function testImprovedExtraction() {
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
    const bankDoc = input.documents.find(d => d.name.includes('银行保险'));

    if (bankDoc) {
      console.log('【测试改进后的提取逻辑】\n');

      // 测试几个条款
      const testClauses = ['第二十二条', '第二十三条', '第二十四条'];

      testClauses.forEach(clauseId => {
        const regex = new RegExp(`${clauseId}([\\s\\S]*?)(?=第[一二三四五六七八九十百千]+条|$)`, 'i');
        const match = bankDoc.content.match(regex);

        if (match) {
          const content = match[1].trim().substring(0, 200);
          console.log(`=== ${clauseId} ===`);
          console.log(content + (content.length >= 200 ? '...' : ''));
          console.log(`提取长度: ${match[1].trim().length} 字符\n`);
        } else {
          console.log(`=== ${clauseId} ===`);
          console.log('未匹配到内容\n');
        }
      });
    }
  }

  await client.end();
}

testImprovedExtraction().catch(console.error);
