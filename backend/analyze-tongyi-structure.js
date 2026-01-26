const { Client } = require('pg');

async function analyzeTongyiStructure() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

  const events = await client.query(`
    SELECT output
    FROM ai_generation_events
    WHERE task_id = '${taskId}' AND model = 'domestic'
  `);

  if (events.rows.length > 0) {
    const content = events.rows[0].output.content;

    console.log('=== 通义千问聚类结构分析 ===\n');

    // 查找所有"id": "category_xxx"来确定主类别
    const categoryIds = content.match(/"id":\s*"category_\d+"/g);
    console.log(`找到 ${categoryIds?.length || 0} 个主类别ID\n`);

    // 提取主类别名称
    const categoryPattern = /{\s*"id":\s*"category_\d+",\s*"name":\s*"([^"]*)"/g;
    let match;
    const categories = [];

    while ((match = categoryPattern.exec(content)) !== null) {
      categories.push({
        id: match[0].match(/category_\d+/)[0],
        name: match[1]
      });
    }

    console.log(`=== 通义千问生成的聚类 (${categories.length}个主类别) ===\n`);
    categories.forEach((cat, idx) => {
      console.log(`${idx + 1}. ${cat.name}`);
    });

    // 查找所有cluster ID来统计子聚类
    const clusterIds = content.match(/"id":\s*"cluster_\d+_\d+"/g);
    console.log(`\n=== 统计信息 ===`);
    console.log(`主类别: ${categories.length}个`);
    console.log(`子聚类: ${clusterIds?.length || 0}个 (基于cluster ID)`);

    // 查找coverage信息
    const totalClausesMatch = content.match(/"total_clauses":\s*(\d+)/);
    const clusteredClausesMatch = content.match(/"clustered_clauses":\s*(\d+)/);

    if (totalClausesMatch || clusteredClausesMatch) {
      console.log(`\n=== 覆盖度统计 ===`);
      if (totalClausesMatch) {
        console.log(`总条款数: ${totalClausesMatch[1]}`);
      }
      if (clusteredClausesMatch) {
        console.log(`已聚类条款数: ${clusteredClausesMatch[1]}`);

        if (totalClausesMatch) {
          const total = parseInt(totalClausesMatch[1]);
          const clustered = parseInt(clusteredClausesMatch[1]);
          const rate = ((clustered / total) * 100).toFixed(2);
          console.log(`覆盖率: ${rate}%`);
        }
      }
    }

    // 尝试找最后一个完整的数据点
    const lastQuote = content.lastIndexOf('"');
    console.log(`\n=== 数据完整性 ===`);
    console.log(`Content总长度: ${content.length}字符`);
    console.log(`最后一个引号位置: ${lastQuote}`);
    console.log(`完整度: ${((lastQuote / content.length) * 100).toFixed(2)}%`);
  }

  await client.end();
}

analyzeTongyiStructure().catch(console.error);
