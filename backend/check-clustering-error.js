const { Client } = require('pg');

async function checkClusteringError() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const res = await client.query(`
    SELECT id, status, error_message, created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('=== 最近的聚类任务 ===\n');
  res.rows.forEach((r, i) => {
    console.log(`[${i + 1}] Task ID: ${r.id}`);
    console.log(`    Status: ${r.status}`);
    console.log(`    Error: ${r.error_message || '无'}`);
    console.log(`    Created: ${r.created_at}`);
    console.log('');
  });

  await client.end();
}

checkClusteringError().catch(console.error);
