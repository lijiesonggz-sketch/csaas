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

  // 检查ai_tasks表中的数据
  const result = await client.query(`
    SELECT
      id,
      project_id,
      type,
      status,
      created_at
    FROM ai_tasks
    ORDER BY created_at DESC
    LIMIT 20
  `);

  console.log('=== AI Tasks 表数据 ===');
  console.log('总数:', result.rowCount);
  result.rows.forEach(row => {
    console.log(`ID: ${row.id.substring(0,8)}... | Project: ${row.project_id || 'NULL'} | Type: ${row.type} | Status: ${row.status}`);
  });

  // 检查数据安全项目的ID
  const project = await client.query(`
    SELECT id, name, status
    FROM projects
    WHERE name = '数据安全测试项目'
  `);

  if (project.rowCount > 0) {
    console.log(`\n=== 数据安全测试项目 ===`);
    console.log('ID:', project.rows[0].id);
    console.log('状态:', project.rows[0].status);

    // 查询该项目的任务
    const tasks = await client.query(`
      SELECT type, status, COUNT(*)
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
    `, [project.rows[0].id]);

    console.log('\n该项目的任务统计:');
    if (tasks.rowCount === 0) {
      console.log('  没有找到关联的任务');
    } else {
      tasks.rows.forEach(row => {
        console.log(`  ${row.type}: ${row.status} = ${row.count}`);
      });
    }
  }

  // 查询没有project_id的任务
  const orphanTasks = await client.query(`
    SELECT type, status, COUNT(*)
    FROM ai_tasks
    WHERE project_id IS NULL
    GROUP BY type, status
  `);

  console.log('\n=== 孤立任务（没有项目） ===');
  if (orphanTasks.rowCount === 0) {
    console.log('  没有孤立任务');
  } else {
    orphanTasks.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.status} = ${row.count}`);
    });
  }

  await client.end();
}

check().catch(console.error);
