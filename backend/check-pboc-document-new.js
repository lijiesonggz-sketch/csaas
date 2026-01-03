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

  const projectId = 'ce5c613d-fce0-4ee8-bb0a-64a23e3793dc';

  const res = await client.query(`
    SELECT id, name, file_name, file_type, content, uploaded_at
    FROM documents
    WHERE project_id = $1
    ORDER BY uploaded_at DESC
  `, [projectId]);

  console.log('=== 项目文档分析 ===');
  console.log('项目ID:', projectId);
  console.log('文档数量:', res.rows.length);

  for (const doc of res.rows) {
    console.log('\n文档: ' + doc.name);
    console.log('  ID:', doc.id);
    console.log('  文件名:', doc.file_name);
    console.log('  类型:', doc.file_type);
    console.log('  上传时间:', doc.uploaded_at);

    const content = doc.content;
    const clauseMatches = content.match(/第[一二三四五六七八九十百千]+条/g) || [];
    const uniqueClauses = [...new Set(clauseMatches)];
    uniqueClauses.sort();

    console.log('  内容长度:', content.length, '字符');
    console.log('  检测到的条款数:', uniqueClauses.length);

    if (doc.name.includes('人民银行')) {
      console.log('\n  ⚠️ 这是人民银行文档');
      console.log('  预期条款数: 54');
      console.log('  实际条款数:', uniqueClauses.length);
      console.log('  缺失:', 54 - uniqueClauses.length, '条');
      console.log('\n  检测到的所有条款:');
      console.log('  ' + uniqueClauses.join(', '));

      const expected = ['第一条', '第二条', '第三条', '第四条', '第五条', '第六条', '第七条', '第八条', '第九条', '第十条',
        '第十一条', '第十二条', '第十三条', '第十四条', '第十五条', '第十六条', '第十七条', '第十八条', '第十九条', '第二十条',
        '第二十一条', '第二十二条', '第二十三条', '第二十四条', '第二十五条', '第二十六条', '第二十七条', '第二十八条', '第二十九条', '第三十条',
        '第三十一条', '第三十二条', '第三十三条', '第三十四条', '第三十五条', '第三十六条', '第三十七条', '第三十八条', '第三十九条', '第四十条',
        '第四十一条', '第四十二条', '第四十三条', '第四十四条', '第四十五条', '第四十六条', '第四十七条', '第四十八条', '第四十九条', '第五十条',
        '第五十一条', '第五十二条', '第五十三条', '第五十四条'];

      const missing = expected.filter(id => !uniqueClauses.includes(id));

      if (missing.length > 0) {
        console.log('\n  ❌ 缺失的条款:', missing.join(', '));

        console.log('\n  检查缺失条款是否在原始内容中:');
        missing.slice(0, 5).forEach(id => {
          const exists = content.includes(id);
          console.log('    ' + id + ':', exists ? '✅ 在content中存在' : '❌ 不在content中');
        });

        console.log('\n  检查第5-13条周围的内容:');
        const fifthMatch = content.match(/.{0,50}第五条.{0,100}/);
        if (fifthMatch) {
          console.log('    找到"第五条":', fifthMatch[0].substring(0, 150));
        } else {
          console.log('    ❌ 未找到"第五条"');
        }

        const thirteenthMatch = content.match(/.{0,50}第十三条.{0,100}/);
        if (thirteenthMatch) {
          console.log('    找到"第十三条":', thirteenthMatch[0].substring(0, 150));
        } else {
          console.log('    ❌ 未找到"第十三条"');
        }

        console.log('\n  文档开头 (300字符):');
        console.log('   ', content.substring(0, 300));
      }
    }
  }

  await client.end();
}

checkPBOCDocument().catch(console.error);
