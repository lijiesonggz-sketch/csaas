const { Client } = require('pg');

async function extractTongyiCategories() {
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

    console.log('=== 通义千问聚类分析 ===\n');

    // 方法1: 尝试找到所有完整的category对象
    const categoryMatches = content.match(/\{\s*"id":\s*"category_\d+"[^{}]*"(?:\{[^{}]*"[^{}]*"[^{}]*\}[^{}]*)*\}/g);

    if (categoryMatches) {
      console.log(`找到 ${categoryMatches.length} 个category对象\n`);

      categoryMatches.forEach((match, idx) => {
        try {
          const cat = JSON.parse(match);
          const clusterCount = cat.clusters?.length || 0;

          console.log(`${idx + 1}. ${cat.name}`);
          console.log(`   子聚类: ${clusterCount}个`);

          // 统计条款数
          const clausesCount = cat.clusters?.reduce((sum, c) => sum + (c.clauses?.length || 0), 0) || 0;
          console.log(`   条款: ${clausesCount}条`);
          console.log('');
        } catch (err) {
          console.log(`${idx + 1}. 解析失败`);
        }
      });

      const totalClusters = categoryMatches.reduce((sum, match) => {
        try {
          const cat = JSON.parse(match);
          return sum + (cat.clusters?.length || 0);
        } catch {
          return sum;
        }
      }, 0);

      console.log(`=== 通义千问总计 ===`);
      console.log(`主类别: ${categoryMatches.length}个`);
      console.log(`子聚类: ${totalClusters}个`);
    } else {
      console.log('未找到完整的category对象');
      console.log('尝试手动提取...\n');

      // 方法2: 手动查找category名称
      const nameMatches = content.match(/"name":\s*"([^"]*数据[^"]*)"/g);
      if (nameMatches) {
        console.log(`找到 ${nameMatches.length} 个类别名称:\n`);
        nameMatches.forEach((match, idx) => {
          const name = match.match(/"([^"]*)"$/)[1];
          console.log(`${idx + 1}. ${name}`);
        });
      }
    }

    // 查找coverage信息
    const coverageIdx = content.indexOf('"coverage_summary"');
    if (coverageIdx > 0) {
      console.log('\n=== 覆盖度信息 ===');
      console.log(`coverage_summary在位置: ${coverageIdx}`);

      // 尝试提取coverage信息片段
      const coverageSnippet = content.substring(coverageIdx, coverageIdx + 500);
      console.log('\nCoverage片段预览:');
      console.log(coverageSnippet);
    }
  }

  await client.end();
}

extractTongyiCategories().catch(console.error);
