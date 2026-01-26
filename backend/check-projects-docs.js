const { Client } = require('pg');

async function checkProjectsAndDocs() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查询最近的项目
  const projects = await client.query(`
    SELECT id, name, created_at
    FROM projects
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('=== 最近的项目 ===');
  projects.rows.forEach((p, i) => {
    console.log(`[${i + 1}] ${p.id.substring(0, 8)}... | ${p.name} | ${p.created_at}`);
  });

  // 如果有项目，查询第一个项目的文档
  if (projects.rows.length > 0) {
    const projectId = projects.rows[0].id;

    const documents = await client.query(`
      SELECT id, name, created_at
      FROM documents
      WHERE project_id = '${projectId}'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`\n=== 项目 ${projectId.substring(0, 8)}... 的文档 ===`);
    if (documents.rows.length === 0) {
      console.log('⚠️ 该项目没有文档');
    } else {
      documents.rows.forEach((d, i) => {
        console.log(`[${i + 1}] ${d.id.substring(0, 8)}... | ${d.name} | ${d.created_at}`);
      });

      // 返回第一个项目和文档，供后续使用
      console.log(`\n✅ 找到可用数据:`);
      console.log(`   projectId: ${projectId}`);
      console.log(`   documentId: ${documents.rows[0].id}`);
    }
  } else {
    console.log('⚠️ 数据库中没有项目');
  }

  await client.end();
}

checkProjectsAndDocs().catch(console.error);
