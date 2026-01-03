const { Client } = require('pg');

async function compareInputs() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const task1 = '2f1284ba-8b18-40a7-a787-ed05a9a14128'; // 12月29日 - 141条款
  const task2 = '51627820-d0d1-492c-ab05-d78371fe324f'; // 今天 - 13条款

  console.log('=== 详细对比两个任务的Input ===\n');

  for (const taskId of [task1, task2]) {
    console.log(`\n【任务】 ${taskId.substring(0, 8)}...`);
    const res = await client.query(
      "SELECT id, created_at, input FROM ai_tasks WHERE id = $1",
      [taskId]
    );

    if (res.rows.length > 0) {
      const task = res.rows[0];
      console.log(`创建时间: ${task.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

      if (task.input) {
        console.log(`\n文档数量: ${task.input.documents?.length || 0}`);

        if (task.input.documents) {
          task.input.documents.forEach((doc, i) => {
            console.log(`\n文档${i+1}: ${doc.name}`);
            console.log(`  ID: ${doc.id}`);
            console.log(`  长度: ${doc.content?.length || 0} 字符`);

            // 分析文档内容结构
            const content = doc.content || '';

            // 统计"第XX条"的数量
            const tiaoMatches = content.match(/第[一二三四五六七八九十百]+条/g);
            const tiaoCount = tiaoMatches ? tiaoMatches.length : 0;

            // 统计"章"的数量
            const zhangMatches = content.match(/第[一二三四五六七八九十百]+章/g);
            const zhangCount = zhangMatches ? zhangMatches.length : 0;

            console.log(`  包含"第XX条": ${tiaoCount}个`);
            console.log(`  包含"第XX章": ${zhangCount}个`);

            // 显示前1000字符
            console.log(`\n  前1000字符:\n${content.substring(0, 1000)}...\n`);

            // 显示最后500字符
            console.log(`  最后500字符:\n...${content.substring(content.length - 500)}`);
          });
        }
      }
    }
  }

  await client.end();
}

compareInputs().catch(console.error);
