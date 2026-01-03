const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function check() {
  await client.connect();

  const userId = '65fefcd7-3b4b-49d7-a56f-8db474314c62';

  const result = await client.query(`
    SELECT id, name, status, deleted_at
    FROM projects
    WHERE owner_id = $1
    AND deleted_at IS NULL
    ORDER BY created_at DESC
  `, [userId]);

  console.log('数据库查询结果:');
  console.log(`总数: ${result.rowCount}\n`);

  result.rows.forEach(p => {
    console.log(`  - ${p.name} (${p.status})`);
    console.log(`    ID: ${p.id}`);
    console.log(`    DeletedAt: ${p.deleted_at || 'NULL'}\n`);
  });

  await client.end();
}

check().catch(console.error);
