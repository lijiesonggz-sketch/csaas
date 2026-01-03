const { Client } = require('pg');

async function fixProjectMetadata() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  try {
    await client.connect();

    const projectId = '8e815c62-f034-4497-8eab-a6f37d42b3d9';

    // 获取当前metadata
    const result = await client.query(
      'SELECT metadata FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      console.log('❌ 项目不存在');
      return;
    }

    const metadata = result.rows[0].metadata;

    console.log('📋 当前metadata:');
    console.log('  summaryTaskId:', metadata.summaryTaskId);
    console.log('  clusteringTaskId:', metadata.clusteringTaskId);
    console.log('  uploadedDocuments:', metadata.uploadedDocuments?.length || 0, '个');

    // 移除错误的summaryTaskId
    delete metadata.summaryTaskId;

    // 更新metadata
    await client.query(
      'UPDATE projects SET metadata = $1 WHERE id = $2',
      [JSON.stringify(metadata), projectId]
    );

    console.log('\n✅ 已移除错误的summaryTaskId');
    console.log('💡 请在前端界面重新创建综述任务');

  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

fixProjectMetadata();
