const { Client } = require('pg');

async function checkClauseExtraction() {
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
    const bankDoc = input.documents.find(d => d.name.includes('银行保险'));

    if (bankDoc) {
      console.log('【检查第二十二条附近的内容】\n');

      // 找到第二十二条的位置
      const clause22Index = bankDoc.content.indexOf('第二十二条');
      const clause23Index = bankDoc.content.indexOf('第二十三条');
      const clause24Index = bankDoc.content.indexOf('第二十四条');

      console.log(`第二十二条位置: ${clause22Index}`);
      console.log(`第二十三条位置: ${clause23Index}`);
      console.log(`第二十四条位置: ${clause24Index}\n`);

      // 显示第二十二条前后的内容
      const start = Math.max(0, clause22Index - 50);
      const end = Math.min(bankDoc.content.length, clause24Index + 200);

      console.log('=== 第二十二条到第二十四条的原始内容 ===');
      console.log(bankDoc.content.substring(start, end));
      console.log('\n=== 分隔线 ===\n');

      // 测试我当前使用的正则表达式
      const regex = new RegExp(`第二十二条[^\\n]*\\n([\\s\\S]{0,200})`);
      const match = bankDoc.content.match(regex);
      if (match) {
        console.log('【当前错误的提取结果】');
        console.log(match[1].trim());
        console.log('\n');
      }

      // 改进的提取方法：提取到下一个条款之前
      const improvedRegex = /第二十二条[^\n]*\n([\s\S]*?)(?=第二十三条|$)/;
      const improvedMatch = bankDoc.content.match(improvedRegex);
      if (improvedMatch) {
        console.log('【改进后的提取结果】');
        console.log(improvedMatch[1].trim());
        console.log('\n');
      }

      // 显示所有"第XX条"的格式
      console.log('\n=== 检查条款格式 ===');
      const lines = bankDoc.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/第二[十二三四]条/)) {
          console.log(`行 ${i}: ${lines[i].substring(0, 80)}...`);
        }
      }
    }
  }

  await client.end();
}

checkClauseExtraction().catch(console.error);
