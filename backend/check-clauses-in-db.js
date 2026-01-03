const { Client } = require('pg');

async function checkClausesInDB() {
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
    SELECT metadata
    FROM projects
    WHERE id = $1
  `, [projectId]);

  if (res.rows.length === 0) {
    console.log('❌ 项目不存在');
    await client.end();
    return;
  }

  const metadata = typeof res.rows[0].metadata === 'string' ?
    JSON.parse(res.rows[0].metadata) : res.rows[0].metadata;

  const pbocDoc = metadata.uploadedDocuments.find(d => d.name.includes('人民银行'));

  if (!pbocDoc) {
    console.log('❌ 未找到人民银行文档');
    await client.end();
    return;
  }

  const content = pbocDoc.content;

  console.log('=== 检查缺失条款是否在数据库内容中 ===\n');
  console.log('文档:', pbocDoc.name);
  console.log('内容长度:', content.length, '字符\n');

  const missingClauses = ['第五条', '第六条', '第七条', '第八条', '第九条', '第十条',
    '第十一条', '第十二条', '第十三条'];

  console.log('检查缺失条款是否在content中:');
  missingClauses.forEach(id => {
    const exists = content.includes(id);
    console.log(`  ${id}: ${exists ? '✅ 在content中存在' : '❌ 不在content中'}`);

    if (exists) {
      // 找到该条款周围的上下文
      const idx = content.indexOf(id);
      const context = content.substring(Math.max(0, idx - 20), Math.min(content.length, idx + 100));
      console.log(`       上下文: ...${context}...`);
    }
  });

  // 检查第四条和第十四条之间的内容
  console.log('\n=== 检查第四条到第十四条之间的内容 ===\n');

  const fourthIdx = content.indexOf('第四条');
  const fourteenthIdx = content.indexOf('第十四条');

  console.log('第四条位置:', fourthIdx);
  console.log('第十四条位置:', fourteenthIdx);

  if (fourthIdx !== -1 && fourteenthIdx !== -1) {
    const betweenContent = content.substring(fourthIdx, fourteenthIdx + 50);
    console.log('\n第四条到第十四条之间的内容 (800字符):');
    console.log(betweenContent.substring(0, 800));

    // 统计这个区间内有多少个"第X条"
    const clausesInBetween = betweenContent.match(/第[一二三四五六七八九十百千]+条/g) || [];
    console.log('\n此区间检测到的条款:', clausesInBetween.length, '条');
    console.log('条款列表:', clausesInBetween.join(', '));
  }

  // 检查文档开头的1000字符
  console.log('\n=== 文档开头 (1000字符) ===\n');
  console.log(content.substring(0, 1000));

  // 检查是否有编号被转换成了其他格式
  console.log('\n=== 检查其他可能的编号格式 ===\n');

  const arabicNumerals = content.match(/第\d+条/g) || [];
  console.log('阿拉伯数字编号 (第5条, 第6条...):', arabicNumerals.length);
  if (arabicNumerals.length > 0) {
    console.log('示例:', arabicNumerals.slice(0, 10).join(', '));
  }

  const dotList = content.match(/^\s*\d+\./gm) || [];
  console.log('数字点列表 (5., 6., 7...):', dotList.length);
  if (dotList.length > 0) {
    console.log('示例:', dotList.slice(0, 10).join(', '));
  }

  const htmlOl = content.match(/<li[^>]*>/gi) || [];
  console.log('HTML列表项 (<li>):', htmlOl.length);

  await client.end();
}

checkClausesInDB().catch(console.error);
