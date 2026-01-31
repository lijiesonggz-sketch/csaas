import { Client } from 'pg';

async function checkTableStructure() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    const result = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'analyzed_contents'
      ORDER BY ordinal_position;
    `);

    console.log('analyzed_contents table structure:');
    console.log('='.repeat(80));
    console.log('Column'.padEnd(25) + 'Type'.padEnd(20) + 'Default'.padEnd(30) + 'Nullable');
    console.log('='.repeat(80));

    result.rows.forEach(row => {
      console.log(
        row.column_name.padEnd(25) +
        row.data_type.padEnd(20) +
        (row.column_default || 'NULL').padEnd(30) +
        row.is_nullable
      );
    });

    console.log('='.repeat(80));

    const hasCategories = result.rows.some(row => row.column_name === 'categories');
    console.log(`\n${hasCategories ? '✅' : '❌'} categories column ${hasCategories ? 'EXISTS' : 'MISSING'}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTableStructure();
