const { Client } = require('pg');

async function checkClauseFormatDetail() {
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
      console.log('【检查第4-15条之间的内容】\n');

      // 找到第四条的位置
      const idx4 = pbocDoc.content.indexOf('第四条');
      const idx14 = pbocDoc.content.indexOf('第十四条');

      console.log(`第四条位置: ${idx4}`);
      console.log(`第十四条位置: ${idx14}`);
      console.log(`两者之间距离: ${idx14 - idx4} 字符\n`);

      // 提取第四条到第十四条之间的内容
      const between = pbocDoc.content.substring(idx4, idx14 + 100);

      console.log('=== 第四条到第十四条之间的内容 ===');
      console.log(between);

      // 检查这个区域内所有的"第XX条"
      console.log('\n=== 该区域内的所有"第XX条" ===');
      const clauseRegex = /第([一二三四五六七八九十百千]+)条/g;
      const matches = [];
      let match;

      while ((match = clauseRegex.exec(between)) !== null) {
        matches.push({
          id: match[0],
          text: match[0],
          position: match.index,
        });
      }

      console.log(`找到 ${matches.length} 个"第XX条":`);
      matches.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m.id} (相对位置${m.position})`);
      });

      // 检查是否所有字符都正常
      console.log('\n=== 检查字符编码 ===');
      for (let i = idx4; i < Math.min(idx4 + 200, pbocDoc.content.length); i++) {
        const char = pbocDoc.content[i];
        const code = char.charCodeAt(0);

        if (char === '第') {
          const snippet = pbocDoc.content.substring(i, Math.min(i + 20, pbocDoc.content.length));
          console.log(`位置${i}: "${char}" (编码 ${code}) - ${snippet.substring(0, 15)}...`);
          i += 19; // 跳过这个条款
        }
      }
    }
  }

  await client.end();
}

checkClauseFormatDetail().catch(console.error);
