const { Client } = require('pg');

async function checkSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();

    // Check ai_generation_results schema
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ai_generation_results'
      ORDER BY ordinal_position
    `);

    console.log('ai_generation_results schema:');
    console.table(schema.rows);

    // Check for the specific task
    const result = await client.query(`
      SELECT * FROM ai_generation_results
      WHERE task_id = 'ef378fa9-3ac9-463d-84a0-c33d48f39255'
      LIMIT 1
    `);

    console.log('\nResult for task ef378fa9-3ac9-463d-84a0-c33d48f39255:');
    console.log('Rows found:', result.rows.length);
    if (result.rows.length > 0) {
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('No result found');
    }

    // Check all results to understand the structure
    const sample = await client.query(`
      SELECT id, task_id, created_at
      FROM ai_generation_results
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('\nRecent ai_generation_results:');
    console.table(sample.rows);

  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error);
