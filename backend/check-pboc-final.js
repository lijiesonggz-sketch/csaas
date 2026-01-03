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
    SELECT id, type, status, input, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [projectId]);

  console.log('=== 项目文档分析 ===');
  console.log('项目ID:', projectId);

  if (res.rows.length === 0) {
    console.log('❌ 没有找到任务');
    await client.end();
    return;
  }

  const task = res.rows[0];
  console.log('\n最新任务:');
  console.log('  Task ID:', task.id);
  console.log('  Type:', task.type);
  console.log('  Status:', task.status);
  console.log('  Created At:', task.created_at);

  const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;

  if (input.documents) {
    console.log('\n任务中的文档数量:', input.documents.length);

    for (const doc of input.documents) {
      console.log('\n文档:', doc.name);
      console.log('  ID:', doc.id);
      console.log('  内容长度:', doc.content.length, '字符');

      const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
      const uniqueClauses = [...new Set(clauseMatches)];
      uniqueClauses.sort();

      console.log('  检测到的条款数:', uniqueClauses.length);

      if (doc.name.includes('人民银行')) {
        console.log('\n  ⚠️ 这是人民银行文档');
        console.log('  预期条款数: 54');
        console.log('  实际条款数:', uniqueClauses.length);
        console.log('  缺失:', 54 - uniqueClauses.length, '条');

        console.log('\n  检测到的所有条款:');
        console.log('   ' + uniqueClauses.join(', '));

        const expected = ['第一条', '第二条', '第三条', '第四条', '第五条', '第六条', '第七条', '第八条', '第九条', '第十条',
          '第十一条', '第十二条', '第十三条', '第十四条', '第十五条', '第十六条', '第十七条', '第十八条', '第十九条', '第二十条',
          '第二十一条', '第二十二条', '第二十三条', '第二十四条', '第二十五条', '第二十六条', '第二十七条', '第二十八条', '第二十九条', '第三十条',
          '第三十一条', '第三十二条', '第三十三条', '第三十四条', '第三十五条', '第三十六条', '第三十七条', '第三十八条', '第三十九条', '第四十条',
          '第四十一条', '第四十二条', '第四十三条', '第四十四条', '第四十五条', '第四十六条', '第四十七条', '第四十八条', '第四十九条', '第五十条',
          '第五十一条', '第五十二条', '第五十三条', '第五十四条'];

        const missing = expected.filter(id => !uniqueClauses.includes(id));

        if (missing.length > 0) {
          console.log('\n  ❌ 缺失的条款:', missing.join(', '));

          console.log('\n  检查缺失条款是否在原始content中:');
          missing.slice(0, 3).forEach(id => {
            const exists = doc.content.includes(id);
            console.log('    ' + id + ':', exists ? '✅ 存在' : '❌ 不存在');
          });

          // 检查第四条和第十四条之间的内容
          const fourthIndex = doc.content.indexOf('第四条');
          const fourteenthIndex = doc.content.indexOf('第十四条');

          if (fourthIndex !== -1 && fourteenthIndex !== -1) {
            const betweenContent = doc.content.substring(fourthIndex, fourteenthIndex + 50);
            console.log('\n  第四条到第十四条之间的内容 (500字符):');
            console.log('   ', betweenContent.substring(0, 500));
          }
        }
      }
    }
  }

  await client.end();
}

checkPBOCDocument().catch(console.error);
