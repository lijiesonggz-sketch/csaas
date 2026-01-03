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

  // 查询历史任务关联的项目
  const project = await client.query(`
    SELECT id, name, status, created_at
    FROM projects
    WHERE id = $1
  `, ['16639558-c44d-41eb-a328-277182335f90']);

  if (project.rowCount > 0) {
    console.log('=== 历史任务关联的项目 ===');
    console.log('ID:', project.rows[0].id);
    console.log('名称:', project.rows[0].name);
    console.log('状态:', project.rows[0].status);
    console.log('创建时间:', project.rows[0].created_at);

    // 查询该项目的任务统计
    const tasks = await client.query(`
      SELECT type, status, COUNT(*)
      FROM ai_tasks
      WHERE project_id = $1
      GROUP BY type, status
      ORDER BY type, status
    `, [project.rows[0].id]);

    console.log('\n该项目的任务统计:');
    tasks.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.status} = ${row.count}`);
    });

    // 查询每种类型的最新完成任务
    const latestTasks = await client.query(`
      SELECT DISTINCT ON (type) type, id, status, created_at
      FROM ai_tasks
      WHERE project_id = $1 AND status = 'completed'
      ORDER BY type, created_at DESC
    `, [project.rows[0].id]);

    console.log('\n已完成的任务:');
    latestTasks.rows.forEach(row => {
      console.log(`  ${row.type}: ${row.id.substring(0,8)}... (${row.created_at})`);
    });
  } else {
    console.log('没有找到该项目');
  }

  // 查询所有项目
  const allProjects = await client.query(`
    SELECT id, name, status
    FROM projects
    ORDER BY created_at DESC
  `);

  console.log('\n=== 所有项目列表 ===');
  allProjects.rows.forEach(p => {
    console.log(`  ${p.name}: ${p.id.substring(0,8)}... (${p.status})`);
  });

  await client.end();
}

check().catch(console.error);
