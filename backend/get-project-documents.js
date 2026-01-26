const { Client } = require('pg');

async function getProjectDocuments() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const projectId = '959f2186-fcba-4791-9b3d-b37e8a3444b1';

  const result = await client.query(`
    SELECT metadata
    FROM projects
    WHERE id = '${projectId}'
  `);

  if (result.rows.length > 0) {
    const metadata = result.rows[0].metadata;
    const documents = metadata?.uploadedDocuments || [];

    console.log('=== 项目文档列表 ===');
    console.log(`文档总数: ${documents.length}`);
    console.log('');

    documents.forEach((doc, i) => {
      console.log(`${i+1}. ID: ${doc.id}`);
      console.log(`   名称: ${doc.name}`);
      console.log('');
    });

    if (documents.length >= 2) {
      console.log('推荐使用前两个文档的ID进行测试:');
      console.log(`  - ${documents[0].id}`);
      console.log(`  - ${documents[1].id}`);
    }
  } else {
    console.log('❌ 项目不存在');
  }

  await client.end();
}

getProjectDocuments().catch(console.error);
