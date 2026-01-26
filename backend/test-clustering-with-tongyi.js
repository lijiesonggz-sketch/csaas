const { Client } = require('pg');
const http = require('http');
const crypto = require('crypto');

// 测试文档内容（简短版本，用于快速测试）
const testDocuments = [
  {
    id: 'doc-1',
    name: '网络安全法',
    content: '第一章 总则\n第一条 为了保障网络安全，维护网络空间主权和国家安全、社会公共利益，保护公民、法人和其他组织的合法权益，促进经济社会信息化健康发展，制定本法。\n\n第二条 在中华人民共和国境内建设、运营、维护和使用网络，以及网络安全的监督管理，适用本法。\n\n第三条 国家坚持网络安全与信息化发展并重，遵循积极利用、科学发展、依法管理、确保安全的方针，推进网络基础设施建设和技术创新，建立健全网络安全保障体系，提高网络安全保护能力。'
  },
  {
    id: 'doc-2',
    name: '数据安全法',
    content: '第一章 总则\n第一条 为了规范数据处理活动，保障数据安全，促进数据开发利用，保护个人、组织合法权益，维护国家主权、安全和发展利益，制定本法。\n\n第二条 在中华人民共和国境内开展数据处理活动及其安全监管，适用本法。在中华人民共和国境外处理中华人民共和国境内个人和组织数据的活动，适用本法。\n\n第三条 数据处理活动包括数据的收集、存储、使用、加工、传输、提供、公开等。数据处理应当遵循合法、正当、必要原则，不得通过误导、欺诈、胁迫等方式处理个人信息。'
  },
  {
    id: 'doc-3',
    name: '个人信息保护法',
    content: '第一章 总则\n第一条 为了保护个人信息权益，规范个人信息处理活动，促进个人信息合理利用，根据宪法，制定本法。\n\n第二条 自然人的个人信息受法律保护，任何组织、个人不得侵害自然人的个人信息权益。\n\n第三条 个人信息处理活动应当遵循合法、正当、必要原则，不得通过误导、欺诈、胁迫等方式处理个人信息。处理个人信息应当具有明确、合理的目的，并与处理目的直接相关，采取对个人权益影响最小的方式。'
  }
];

async function triggerClusteringTask() {
  console.log('=== 触发聚类任务测试 ===\n');

  // 生成taskId (valid UUID)
  const taskId = crypto.randomUUID();

  // 1. 获取项目ID
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const projectsResult = await client.query(`
    SELECT id, name
    FROM projects
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (projectsResult.rows.length === 0) {
    console.log('❌ 数据库中没有项目');
    await client.end();
    return;
  }

  const project = projectsResult.rows[0];
  const projectId = project.id;

  console.log(`✅ 使用项目: ${project.name} (${projectId.substring(0, 8)}...)`);
  console.log(`📝 生成任务ID: ${taskId}`);
  console.log(`📄 测试文档数量: ${testDocuments.length}个\n`);

  await client.end();

  // 2. 调用聚类API
  const postData = JSON.stringify({
    taskId: taskId,
    projectId: projectId,
    documents: testDocuments,
    temperature: 0.7,
    maxTokens: 8000
  });

  console.log('📤 发送聚类任务请求...');
  console.log(`   URL: http://localhost:3000/ai-generation/clustering`);
  console.log(`   文档数: ${testDocuments.length}`);
  console.log('');

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/ai-generation/clustering',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.success) {
            console.log('✅ 聚类任务已成功创建！');
            console.log(`   taskId: ${response.data.taskId}`);
            console.log(`   状态: ${response.data.status}`);
            console.log(`\n🔍 正在监控任务执行...\n`);

            // 开始监控任务
            monitorTask(response.data.taskId);
          } else {
            console.log('❌ 任务创建失败:', response.error);
            reject(response.error);
          }
        } catch (error) {
          console.log('❌ 解析响应失败:', error.message);
          console.log('   原始响应:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求失败:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function monitorTask(taskId) {
  const checkInterval = 5000; // 每5秒检查一次
  const maxChecks = 60; // 最多检查5分钟

  for (let i = 0; i < maxChecks; i++) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));

    try {
      const status = await checkTaskStatus(taskId);
      console.log(`[${i + 1}/${maxChecks}] 状态: ${status.status} | 进度: ${status.progress || 0}%`);

      if (status.status === 'completed') {
        console.log('\n✅ 任务完成！');
        console.log(`   耗时: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
        console.log('\n🔍 正在检查AI生成事件...\n');
        await checkAIGenerationEvents(taskId);
        return;
      } else if (status.status === 'failed') {
        console.log('\n❌ 任务失败！');
        console.log(`   错误: ${status.error || '未知错误'}`);
        return;
      }
    } catch (error) {
      console.log(`⚠️  检查状态失败: ${error.message}`);
    }
  }

  console.log('\n⏱️  监控超时，任务可能仍在执行中');
}

async function checkTaskStatus(taskId) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/ai-tasks/${taskId}/status`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.data);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function checkAIGenerationEvents(taskId) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'csaas'
  });

  await client.connect();

  const result = await client.query(`
    SELECT
      id,
      model,
      error_message,
      execution_time_ms,
      created_at
    FROM ai_generation_events
    WHERE task_id = $1
    ORDER BY created_at ASC
  `, [taskId]);

  console.log('=== AI生成事件记录 ===\n');

  if (result.rows.length === 0) {
    console.log('⚠️  未找到AI生成事件');
  } else {
    result.rows.forEach((event, i) => {
      console.log(`[${i + 1}] 模型: ${event.model}`);
      console.log(`    执行时间: ${event.execution_time_ms || 0}ms`);
      console.log(`    状态: ${event.error_message || '成功'}`);
      console.log(`    创建时间: ${event.created_at}`);
      console.log('');
    });

    // 统计
    const models = result.rows.map(r => r.model);
    console.log(`📊 总结:`);
    console.log(`   总事件数: ${result.rows.length}`);
    console.log(`   模型分布: ${models.join(', ')}`);

    const hasTongyi = models.includes('domestic');
    if (hasTongyi) {
      console.log(`   ✅ 通义千问已被调用！`);
    } else {
      console.log(`   ❌ 通义千问未被调用`);
    }
  }

  await client.end();
}

const startTime = Date.now();

// 开始测试
triggerClusteringTask()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ 测试失败:', error.message);
    process.exit(1);
  });
