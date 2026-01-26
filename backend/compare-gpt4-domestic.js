const { Client } = require('pg');

async function compareModels() {
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
    SELECT model, output, execution_time_ms
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('=== GPT-4 vs 通义千问对比 ===\n');

  events.rows.forEach((event, idx) => {
    const content = event.output.content;
    const hasCategories = content.includes('"categories"');
    const hasCoverage = content.includes('"coverage_summary"');

    console.log(`[${idx + 1}] ${event.model}`);
    console.log(`  执行时间: ${event.execution_time_ms}ms`);
    console.log(`  Content长度: ${content?.length || 0}字符`);
    console.log(`  包含categories: ${hasCategories ? '是' : '否'}`);
    console.log(`  包含coverage_summary: ${hasCoverage ? '是' : '否'}`);

    // 查找主类别数量
    if (hasCategories) {
      const categoryIds = content.match(/"id":\s*"category_\d+"/g);
      console.log(`  主类别数: ${categoryIds?.length || 0}个`);
    }

    console.log('');
  });

  await client.end();
}

compareModels().catch(console.error);
