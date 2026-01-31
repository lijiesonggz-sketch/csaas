const { Client } = require('pg');

async function queryRadarSources() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    const result = await client.query(`
      SELECT id, source, category, type, "isActive", "crawlSchedule", url
      FROM radar_sources
      ORDER BY category, source
    `);

    console.log('=== Radar Sources in Database ===\n');
    console.log(`Total: ${result.rows.length} sources\n`);

    let currentCategory = '';
    result.rows.forEach(row => {
      if (row.category !== currentCategory) {
        currentCategory = row.category;
        console.log(`\n--- ${currentCategory.toUpperCase()} RADAR ---\n`);
      }

      console.log(`✓ ${row.source}`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Type: ${row.type}`);
      console.log(`  URL: ${row.url}`);
      console.log(`  Active: ${row.isActive ? 'Yes' : 'No'}`);
      console.log(`  Schedule: ${row.crawlSchedule}`);
      console.log('');
    });

    // Statistics
    const stats = await client.query(`
      SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN "isActive" = true THEN 1 ELSE 0 END) as active
      FROM radar_sources
      GROUP BY category
      ORDER BY category
    `);

    console.log('\n=== Statistics ===\n');
    stats.rows.forEach(row => {
      console.log(`${row.category}: ${row.active}/${row.total} active`);
    });

    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

queryRadarSources();
