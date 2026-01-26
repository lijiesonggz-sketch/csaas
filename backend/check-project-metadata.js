const { Client } = require('pg');

async function checkProjectMetadata() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  // 查找包含这个任务的项目
  const result = await client.query(
    `SELECT id, name, metadata FROM projects WHERE id IN (
      SELECT DISTINCT project_id FROM ai_tasks WHERE id = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb'
    )`
  );

  if (result.rows.length > 0) {
    const project = result.rows[0];
    console.log('✅ 找到项目:');
    console.log('  ID:', project.id);
    console.log('  名称:', project.name);
    console.log('  Metadata:', JSON.stringify(project.metadata, null, 2));

    if (project.metadata && project.metadata.summaryTaskId) {
      console.log('\n✅ 项目的summaryTaskId:', project.metadata.summaryTaskId);

      if (project.metadata.summaryTaskId === '01b153b7-a93a-4d87-8b71-5b55a02ed1bb') {
        console.log('✅ summaryTaskId匹配！');
      } else {
        console.log('❌ summaryTaskId不匹配');
        console.log('   期望:', '01b153b7-a93a-4d87-8b71-5b55a02ed1bb');
        console.log('   实际:', project.metadata.summaryTaskId);
      }
    } else {
      console.log('\n❌ 项目的metadata中没有summaryTaskId');
    }
  } else {
    console.log('❌ 没有找到包含此任务的项目');
  }

  await client.end();
}

checkProjectMetadata();
