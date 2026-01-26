const { Client } = require('pg');

async function compareTokenUsage() {
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
    SELECT model, output, metadata
    FROM ai_generation_events
    WHERE task_id = '${taskId}'
    ORDER BY created_at ASC
  `);

  console.log('=== GPT-4 vs 通义千问 Token使用对比 ===\n');

  events.rows.forEach((event, idx) => {
    const tokens = event.output?.tokens;
    const content = event.output?.content;

    console.log(`[${idx + 1}] ${event.model}`);
    console.log(`  Prompt Tokens: ${tokens?.prompt || 'N/A'}`);
    console.log(`  Completion Tokens: ${tokens?.completion || 'N/A'}`);
    console.log(`  Total Tokens: ${tokens?.total || 'N/A'}`);
    console.log(`  Content Length: ${content?.length || 0} chars`);
    console.log(`  Finish Reason: ${event.metadata?.finishReason || 'N/A'}`);

    // 计算字符/token比
    if (tokens?.completion && content?.length) {
      const charsPerToken = (content.length / tokens.completion).toFixed(2);
      console.log(`  Chars/Token: ${charsPerToken}`);
    }

    console.log('');
  });

  await client.end();
}

compareTokenUsage().catch(console.error);
