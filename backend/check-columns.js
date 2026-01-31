const { Client } = require('pg');

async function checkColumns() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'raw_contents'
      AND column_name IN ('contentType', 'peerName')
      ORDER BY column_name;
    `);

    console.log('Columns found:', result.rows);

    if (result.rows.length === 0) {
      console.log('\nColumns do NOT exist. Migration needs to be run.');
    } else {
      console.log('\nColumns already exist:');
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkColumns();
