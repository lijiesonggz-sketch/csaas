const { Client } = require('pg');

async function checkEvents() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const taskId = 'bdb7827f-dcb2-410b-8c0c-af025c026af4';

  const result = await client.query(`
    SELECT id, model, input, output, metadata, execution_time_ms, created_at
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('AI生成事件总数:', result.rows.length);
  console.log('');

  result.rows.forEach((e, i) => {
    console.log('[事件 ' + (i+1) + ']');
    console.log('  ID:', e.id);
    console.log('  模型:', e.model);
    console.log('  执行时间:', e.execution_time_ms + 'ms');
    console.log('  创建时间:', e.created_at);

    if (e.output) {
      const output = typeof e.output === 'string' ? JSON.parse(e.output) : e.output;
      console.log('  输出tokens:', output.tokens?.total || 'N/A');
    }
    console.log('');
  });

  await client.end();
}

checkEvents().catch(console.error);
