const { Client } = require('pg');

async function checkTongyiEnding() {
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

    console.log('=== 通义千问输出末尾分析 ===\n');
    console.log('最后500个字符:');
    console.log(content.substring(content.length - 500));

    console.log('\n最后100个字符:');
    console.log(content.substring(content.length - 100));
  }

  await client.end();
}

checkTongyiEnding().catch(console.error);
