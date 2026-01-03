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

  console.log('=== 所有项目列表 ===\n');

  const projects = await client.query(`
    SELECT id, name, status, owner_id, deleted_at
    FROM projects
    ORDER BY created_at DESC
  `);

  console.log(`总数: ${projects.rowCount}\n`);

  projects.rows.forEach(p => {
    console.log(`名称: ${p.name}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  状态: ${p.status}`);
    console.log(`  所有者: ${p.owner_id}`);
    console.log(`  删除时间: ${p.deleted_at || '未删除'}`);
    console.log('');
  });

  // 检查数据安全测试项目
  console.log('\n=== 查找"数据安全测试项目" ===\n');

  const searchResult = await client.query(`
    SELECT id, name, status, owner_id, deleted_at
    FROM projects
    WHERE name LIKE '%数据安全%' OR name LIKE '%Default%'
  `);

  if (searchResult.rowCount > 0) {
    searchResult.rows.forEach(p => {
      console.log(`找到: ${p.name} (${p.id})`);
      console.log(`  所有者: ${p.owner_id}`);
      console.log(`  删除时间: ${p.deleted_at || '未删除'}`);
    });
  } else {
    console.log('未找到匹配的项目');
  }

  await client.end();
}

check().catch(console.error);
