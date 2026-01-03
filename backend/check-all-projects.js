const { Client } = require('pg');

async function checkProjects() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();

    // 查找所有项目
    const projects = await client.query(`
      SELECT id, name, metadata->>'clusteringTaskId' as clustering_task_id
      FROM projects
      ORDER BY created_at DESC
    `);

    console.log('All projects:');
    console.table(projects.rows);

    // 查找V4项目
    const v4Projects = projects.rows.filter(p => p.name.includes('V4'));
    console.log('\nV4 projects found:', v4Projects.length);
    if (v4Projects.length > 0) {
      console.table(v4Projects);
    }

  } finally {
    await client.end();
  }
}

checkProjects().catch(console.error);
