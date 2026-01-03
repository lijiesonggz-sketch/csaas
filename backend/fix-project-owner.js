const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

async function fix() {
  await client.connect();

  const currentUserId = '65fefcd7-3b4b-49d7-a56f-8db474314c62';

  console.log('=== 修复项目所有者 ===\n');

  // 查找owner_id不是当前用户的项目
  const projects = await client.query(`
    SELECT id, name, owner_id
    FROM projects
    WHERE owner_id != $1
    AND deleted_at IS NULL
  `, [currentUserId]);

  if (projects.rowCount === 0) {
    console.log('所有项目的所有者都正确');
    await client.end();
    return;
  }

  console.log(`找到 ${projects.rowCount} 个所有者不正确的项目:\n`);

  for (const p of projects.rows) {
    console.log(`- ${p.name}: ${p.owner_id}`);

    // 更新owner_id
    await client.query(`
      UPDATE projects
      SET owner_id = $1
      WHERE id = $2
    `, [currentUserId, p.id]);

    console.log(`  ✓ 已更新所有者为: ${currentUserId}\n`);
  }

  console.log('\n=== 验证结果 ===\n');

  const verify = await client.query(`
    SELECT id, name, owner_id
    FROM projects
    WHERE deleted_at IS NULL
    ORDER BY name
  `);

  verify.rows.forEach(p => {
    const status = p.owner_id === currentUserId ? '✓' : '✗';
    console.log(`${status} ${p.name}: ${p.owner_id}`);
  });

  await client.end();
}

fix().catch(console.error);
