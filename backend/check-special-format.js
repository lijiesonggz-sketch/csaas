const { Client } = require('pg');

async function checkSpecialFormat() {
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
      console.log('【检查文档中的所有段落格式】\n');

      // 按段落分割（双换行符）
      const paragraphs = pbocDoc.content.split(/\n\n+/);
      console.log(`总共 ${paragraphs.length} 个段落\n`);

      // 查找包含"中国人民银行负责制定业务数据分类分级"的段落
      const targetParagraph = paragraphs.find(p =>
        p.includes('中国人民银行负责制定业务数据分类分级保护相关规范标准')
      );

      if (targetParagraph) {
        console.log('=== 找到目标段落 ===');
        console.log(targetParagraph);
        console.log('\n');

        // 检查这个段落前后的段落
        const targetIdx = paragraphs.indexOf(targetParagraph);
        console.log(`这是第 ${targetIdx + 1} 个段落\n`);

        console.log('前一个段落:');
        if (targetIdx > 0) {
          console.log(paragraphs[targetIdx - 1].substring(0, 100) + '...');
        }

        console.log('\n后一个段落:');
        if (targetIdx < paragraphs.length - 1) {
          console.log(paragraphs[targetIdx + 1].substring(0, 100) + '...');
        }
      }

      // 检查是否有数字编号格式
      console.log('\n=== 检查所有可能的编号格式 ===');

      // 查找所有包含常见条款关键词的段落
      const keywordParagraphs = paragraphs.filter(p =>
        p.includes('中国人民银行') ||
        p.includes('数据处理者应当') ||
        p.includes('业务数据')
      );

      console.log(`找到 ${keywordParagraphs.length} 个包含关键词的段落`);

      // 显示前20个
      console.log('\n前20个段落的开头:');
      keywordParagraphs.slice(0, 20).forEach((p, idx) => {
        const firstLine = p.split('\n')[0].substring(0, 60);
        console.log(`${idx + 1}. ${firstLine}...`);
      });

      // 检查原始文档中是否有用户说的"第六条"等
      if (pbocDoc.content.includes('第六条')) {
        console.log('\n✅ 文档中包含"第六条"');
      } else {
        console.log('\n❌ 文档中不包含"第六条"');
      }

      if (pbocDoc.content.includes('第七条')) {
        console.log('✅ 文档中包含"第七条"');
      } else {
        console.log('❌ 文档中不包含"第七条"');
      }
    }
  }

  await client.end();
}

checkSpecialFormat().catch(console.error);
