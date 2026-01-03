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

    // 查找所有项目及其 clusteringTaskId
    const projects = await client.query(`
      SELECT id, name, metadata->>'clusteringTaskId' as clustering_task_id
      FROM projects
      WHERE metadata->>'clusteringTaskId' IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log('Projects with clusteringTaskId:');
    console.table(projects.rows);

  } finally {
    await client.end();
  }
}

checkProjects().catch(console.error);
