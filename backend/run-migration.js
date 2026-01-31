const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'csaas',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add contentType column
    console.log('\nAdding contentType column...');
    await client.query(`
      ALTER TABLE raw_contents
      ADD COLUMN IF NOT EXISTS "contentType" varchar(50) NULL
    `);
    console.log('✓ contentType column added');

    // Add comment to contentType
    await client.query(`
      COMMENT ON COLUMN raw_contents."contentType" IS 'Content type: article, recruitment, or conference'
    `);

    // Add peerName column
    console.log('\nAdding peerName column...');
    await client.query(`
      ALTER TABLE raw_contents
      ADD COLUMN IF NOT EXISTS "peerName" varchar(255) NULL
    `);
    console.log('✓ peerName column added');

    // Add comment to peerName
    await client.query(`
      COMMENT ON COLUMN raw_contents."peerName" IS 'Peer institution name for industry radar matching'
    `);

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'raw_contents'
      AND column_name IN ('contentType', 'peerName')
      ORDER BY column_name;
    `);

    console.log('\n✓ Migration completed successfully!');
    console.log('\nColumns added:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
    });

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
