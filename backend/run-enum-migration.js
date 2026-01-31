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

    // Create enum type
    console.log('\nCreating enum type...');
    await client.query(`
      CREATE TYPE raw_content_contenttype_enum AS ENUM ('article', 'recruitment', 'conference')
    `);
    console.log('✓ Enum type created');

    // Change column type to enum
    console.log('\nChanging contentType column to enum...');
    await client.query(`
      ALTER TABLE raw_contents
      ALTER COLUMN "contentType" TYPE raw_content_contenttype_enum
      USING (CASE
        WHEN "contentType" IS NULL THEN NULL
        WHEN "contentType" IN ('article', 'recruitment', 'conference') THEN "contentType"::raw_content_contenttype_enum
        ELSE 'article'::raw_content_contenttype_enum
      END)
    `);
    console.log('✓ Column type changed to enum');

    // Verify the change
    const result = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'raw_contents'
      AND column_name = 'contentType';
    `);

    console.log('\n✓ Migration completed successfully!');
    console.log('\nColumn info:');
    console.log(result.rows[0]);

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
