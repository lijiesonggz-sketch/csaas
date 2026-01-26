const { Client } = require('pg');

async function checkFinishReason() {
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
    WHERE task_id = '${taskId}' AND model = 'domestic'
  `);

  if (events.rows.length > 0) {
    const event = events.rows[0];
    console.log('=== 通义千问API调用详情 ===\n');
    console.log('Model:', event.model);
    console.log('Finish Reason:', event.metadata?.finishReason || 'N/A');
    console.log('Execution Time:', (event.metadata?.executionTimeMs || 'N/A') + 'ms');
    console.log('Content Length:', (event.output?.content?.length || 0) + ' chars');

    const tokens = event.output?.tokens;
    if (tokens) {
      console.log('\n=== Token使用情况 ===');
      console.log('Prompt Tokens:', tokens.prompt);
      console.log('Completion Tokens:', tokens.completion);
      console.log('Total Tokens:', tokens.total);
    }
  }

  await client.end();
}

checkFinishReason().catch(console.error);
