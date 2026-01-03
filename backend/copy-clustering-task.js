const { Client } = require('pg');

async function copyClusteringTask() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas',
  });

  try {
    await client.connect();

    // 更新 V4 项目,添加 clusteringTaskId
    const result = await client.query(`
      UPDATE projects
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{clusteringTaskId}',
        '"ef378fa9-3ac9-463d-84a0-c33d48f39255"'
      )
      WHERE id = '8e815c62-f034-4497-8eab-a6f37d42b3d9'
      RETURNING id, name, metadata->>'clusteringTaskId' as clustering_task_id
    `);

    console.log('✅ Successfully updated V4 project:');
    console.table(result.rows);

  } finally {
    await client.end();
  }
}

copyClusteringTask().catch(console.error);
