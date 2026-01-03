const { Client } = require('pg');

async function checkBothProjects() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const oldProjectId = 'a7b89bd6-aa1d-410d-83fe-edc831dd90fb';
  const newProjectId = 'ce5c613d-fce0-4ee8-bb0a-64a23e3793dc';

  console.log('=== 检查两个项目的文档情况 ===\n');

  // 1. 检查新项目
  console.log('【1. 新项目检查】');
  console.log('项目ID:', newProjectId);

  const newProject = await client.query(`
    SELECT id, name, metadata, created_at
    FROM projects
    WHERE id = $1
  `, [newProjectId]);

  if (newProject.rows.length === 0) {
    console.log('❌ 新项目不存在\n');
  } else {
    const project = newProject.rows[0];
    console.log('✅ 项目名称:', project.name);
    console.log('   创建时间:', project.created_at);

    const metadata = typeof project.metadata === 'string' ?
      JSON.parse(project.metadata) : project.metadata;

    if (metadata.uploadedDocuments && metadata.uploadedDocuments.length > 0) {
      console.log('   ✅ 已上传文档数:', metadata.uploadedDocuments.length);
      metadata.uploadedDocuments.forEach((doc, idx) => {
        console.log(`      [${idx + 1}] ${doc.name}`);
        console.log(`          ID: ${doc.id}`);
        console.log(`          内容长度: ${doc.content.length} 字符`);

        // 检测条款数
        const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
        const uniqueClauses = [...new Set(clauseMatches)];
        console.log(`          检测到条款数: ${uniqueClauses.length}`);

        if (doc.name.includes('人民银行')) {
          console.log(`          ⚠️ 这是人民银行文档`);
          if (uniqueClauses.length < 54) {
            console.log(`          ❌ 缺失 ${54 - uniqueClauses.length} 条条款`);
          } else {
            console.log(`          ✅ 条款完整`);
          }
        }
      });
    } else {
      console.log('   ❌ 没有上传任何文档');
    }

    console.log('');
  }

  // 2. 检查新项目的任务
  const newProjectTasks = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at DESC
  `, [newProjectId]);

  console.log('   任务数量:', newProjectTasks.rows.length);
  if (newProjectTasks.rows.length > 0) {
    console.log('   最新任务:');
    newProjectTasks.rows.slice(0, 3).forEach((task, idx) => {
      console.log(`      [${idx + 1}] ${task.type} - ${task.status} - ${task.created_at}`);
    });
  }
  console.log('');

  // 3. 检查旧项目
  console.log('【2. 旧项目检查】');
  console.log('项目ID:', oldProjectId);

  const oldProject = await client.query(`
    SELECT id, name, metadata, created_at
    FROM projects
    WHERE id = $1
  `, [oldProjectId]);

  if (oldProject.rows.length === 0) {
    console.log('❌ 旧项目不存在\n');
  } else {
    const project = oldProject.rows[0];
    console.log('✅ 项目名称:', project.name);
    console.log('   创建时间:', project.created_at);

    const metadata = typeof project.metadata === 'string' ?
      JSON.parse(project.metadata) : project.metadata;

    if (metadata.uploadedDocuments && metadata.uploadedDocuments.length > 0) {
      console.log('   ✅ 已上传文档数:', metadata.uploadedDocuments.length);
      metadata.uploadedDocuments.forEach((doc, idx) => {
        console.log(`      [${idx + 1}] ${doc.name}`);
        console.log(`          ID: ${doc.id}`);

        // 检测条款数
        const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
        const uniqueClauses = [...new Set(clauseMatches)];
        console.log(`          检测到条款数: ${uniqueClauses.length}`);

        if (doc.name.includes('人民银行')) {
          console.log(`          ⚠️ 这是人民银行文档`);
          console.log(`          ${uniqueClauses.length < 54 ? '❌' : '✅'} 条款数: ${uniqueClauses.length}/54`);
        }
      });
    } else {
      console.log('   ❌ 没有上传任何文档');
    }

    console.log('');
  }

  // 4. 检查旧项目的最近任务
  const oldProjectTasks = await client.query(`
    SELECT id, type, status, created_at
    FROM ai_tasks
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [oldProjectId]);

  console.log('   最近任务数 (前5):', oldProjectTasks.rows.length);
  if (oldProjectTasks.rows.length > 0) {
    console.log('   最新任务:');
    oldProjectTasks.rows.forEach((task, idx) => {
      console.log(`      [${idx + 1}] ${task.type} - ${task.status}`);
      console.log(`          Task ID: ${task.id}`);
      console.log(`          时间: ${task.created_at}`);
    });
  }
  console.log('');

  // 5. 检查最近聚类任务使用的文档
  console.log('【3. 最近聚类任务文档分析】');

  const latestClustering = await client.query(`
    SELECT id, input, created_at
    FROM ai_tasks
    WHERE type = 'clustering'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (latestClustering.rows.length === 0) {
    console.log('❌ 没有找到聚类任务\n');
  } else {
    const task = latestClustering.rows[0];
    console.log('✅ 最新聚类任务');
    console.log('   Task ID:', task.id);
    console.log('   Project ID:', task.project_id);
    console.log('   创建时间:', task.created_at);

    const input = typeof task.input === 'string' ? JSON.parse(task.input) : task.input;

    if (input.documents) {
      console.log('   使用的文档数:', input.documents.length);
      input.documents.forEach((doc, idx) => {
        console.log(`\n   [${idx + 1}] ${doc.name}`);
        console.log(`       文档ID: ${doc.id}`);
        console.log(`       内容长度: ${doc.content.length} 字符`);

        const clauseMatches = doc.content.match(/第[一二三四五六七八九十百千]+条/g) || [];
        const uniqueClauses = [...new Set(clauseMatches)];
        console.log(`       检测到条款数: ${uniqueClauses.length}`);

        if (doc.name.includes('人民银行')) {
          console.log(`       ⚠️ 人民银行文档: ${uniqueClauses.length}/54 条`);
          if (uniqueClauses.length < 54) {
            const missing = ['第五条', '第六条', '第七条', '第八条', '第九条', '第十条',
              '第十一条', '第十二条', '第十三条'];
            const foundMissing = missing.filter(m => !uniqueClauses.includes(m));
            console.log(`       ❌ 缺失条款: ${foundMissing.join(', ')}`);
          }
        }
      });
    }
  }

  await client.end();
}

checkBothProjects().catch(console.error);
