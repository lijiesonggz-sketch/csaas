const { Client } = require('pg');
require('dotenv').config({ path: '.env.development' });

async function checkSchema() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'csaas',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'analyzed_contents'
      ORDER BY ordinal_position
    `);

    console.log('📋 analyzed_contents table schema:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

checkSchema();
