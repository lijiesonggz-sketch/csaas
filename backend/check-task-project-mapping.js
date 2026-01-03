const { Client } = require('pg');

async function checkTaskProjectMapping() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  console.log('=== 检查任务与项目的映射关系 ===\n');

  // 1. 检查最新的聚类任务及其project_id
  const latestTasks = await client.query(`
    SELECT id, project_id, type, status, input, created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('【最近5个聚类任务】\n');

  for (const task of latestTasks.rows) {
    console.log('Task ID:', task.id);
    console.log('Project ID:', task.project_id || '❌ NULL/UNDEFINED');
    console.log('时间:', task.created_at);

    // 如果有project_id，检查项目是否存在
    if (task.project_id) {
      const projectRes = await client.query(`
        SELECT id, name
        FROM projects
        WHERE id = $1
      `, [task.project_id]);

      if (projectRes.rows.length > 0) {
        console.log('项目名称:', projectRes.rows[0].name);
      } else {
        console.log('❌ 项目不存在！');
      }
    }

    // 检查任务使用的文档
    const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;
    if (input.documents && input.documents.length > 0) {
      console.log('使用的文档:');
      input.documents.forEach((doc, idx) => {
        console.log(`  [${idx + 1}] ${doc.name}`);
        console.log(`      文档ID: ${doc.id}`);
      });
    }

    console.log('');
  }

  // 2. 检查新项目的任务
  const newProjectId = 'ce5c613d-fce0-4ee8-bb0a-64a23e3793dc';

  console.log('【新项目的所有任务】');
  console.log('项目ID:', newProjectId);

  const newProjectTasks = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at DESC
  `, [newProjectId]);

  console.log('任务数量:', newProjectTasks.rows.length);
  if (newProjectTasks.rows.length === 0) {
    console.log('❌ 新项目没有任何任务！');
  } else {
    newProjectTasks.rows.forEach((task, idx) => {
      console.log(`  [${idx + 1}] ${task.type} - ${task.status} - ${task.created_at}`);
    });
  }

  console.log('');

  // 3. 检查新项目的文档
  const newProject = await client.query(`
    SELECT metadata
    FROM projects
    WHERE id = $1
  `, [newProjectId]);

  if (newProject.rows.length > 0) {
    const metadata = typeof newProject.rows[0].metadata === 'string' ?
      JSON.parse(newProject.rows[0].metadata) : newProject.rows[0].metadata;

    if (metadata.uploadedDocuments && metadata.uploadedDocuments.length > 0) {
      console.log('新项目的文档:');
      metadata.uploadedDocuments.forEach((doc, idx) => {
        console.log(`  [${idx + 1}] ${doc.name}`);
        console.log(`      文档ID: ${doc.id}`);
      });
    }
  }

  console.log('');

  // 4. 反向查询：找出所有使用新项目文档的任务
  const newProjectDocIds = ['doc_45a1a6ef-d420-4d65-8ff0-f72b24cfb553',
                             'doc_b6d53d7c-447e-43a5-96c4-0afd9cdc3b8e'];

  console.log('【使用新项目文档的任务】');
  for (const docId of newProjectDocIds) {
    const tasksRes = await client.query(`
      SELECT id, project_id, type, created_at
      FROM ai_tasks
      WHERE input::text LIKE $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [`%${docId}%`]);

    if (tasksRes.rows.length > 0) {
      console.log(`\n文档ID ${docId} 被以下任务使用:`);
      tasksRes.rows.forEach((task, idx) => {
        console.log(`  [${idx + 1}] Task ID: ${task.id}`);
        console.log(`      Project ID: ${task.project_id || 'NULL'}`);
        console.log(`      Type: ${task.type}`);
        console.log(`      时间: ${task.created_at}`);
      });
    }
  }

  await client.end();
}

checkTaskProjectMapping().catch(console.error);
