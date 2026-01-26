/**
 * 诊断脚本：通过API查询任务状态
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';
const PROJECT_ID = 'f504ab5a-7347-4148-bffe-cc55d97752e6';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function diagnose() {
  console.log('='.repeat(80));
  console.log('诊断报告：项目 ' + PROJECT_ID);
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. 获取项目信息
    console.log('1️⃣  获取项目信息...');
    const project = await httpGet(`/api/projects/${PROJECT_ID}`);
    console.log('   项目名称:', project.name);
    console.log('   上传文档数:', project.metadata?.uploadedDocuments?.length || 0);
    console.log('');

    // 2. 获取最近的任务
    console.log('2️⃣  获取最近的任务...');
    const tasks = await httpGet(`/api/projects/${PROJECT_ID}/tasks?limit=5`);

    if (!tasks || tasks.length === 0) {
      console.log('   ⚠️  没有找到任务记录');
      return;
    }

    console.log(`   找到 ${tasks.length} 个任务:\n`);

    tasks.forEach((task, idx) => {
      console.log(`   [${idx + 1}] 任务ID: ${task.id}`);
      console.log(`       类型: ${task.type}`);
      console.log(`       状态: ${task.status}`);
      console.log(`       创建时间: ${task.created_at}`);

      if (task.status === 'FAILED' && task.error_message) {
        console.log(`       ❌ 错误: ${task.error_message}`);
      }

      if (task.status === 'COMPLETED' && task.result) {
        console.log(`       ✅ 已完成，有结果数据`);
      }

      console.log('');
    });

    // 3. 检查最新的失败任务
    const latestFailedTask = tasks.find(t => t.status === 'FAILED');

    if (latestFailedTask) {
      console.log('3️⃣  最新失败任务详情:');
      console.log('   ' + '='.repeat(76));
      console.log(`   任务ID: ${latestFailedTask.id}`);
      console.log(`   类型: ${latestFailedTask.type}`);
      console.log(`   状态: ${latestFailedTask.status}`);
      console.log(`   错误信息: ${latestFailedTask.error_message || '无错误信息'}`);
      console.log(`   生成阶段: ${latestFailedTask.generation_stage || 'N/A'}`);
      console.log(`   进度详情: ${JSON.stringify(latestFailedTask.progress_details) || 'N/A'}`);
      console.log('');

      // 4. 获取该任务的详细事件
      console.log('4️⃣  获取该任务的AI生成事件...');
      try {
        const events = await httpGet(`/api/tasks/${latestFailedTask.id}/events`);
        console.log(`   找到 ${events.length} 个AI生成事件:\n`);

        events.forEach((event, idx) => {
          console.log(`   [${idx + 1}] 模型: ${event.model}`);
          console.log(`       创建时间: ${event.created_at}`);
          console.log(`       执行时间: ${event.execution_time_ms || 'N/A'} ms`);

          if (event.error_message) {
            console.log(`       ❌ 错误: ${event.error_message}`);
          } else {
            console.log(`       ✅ 成功`);
          }

          if (event.output) {
            const output = JSON.parse(event.output);
            if (output.content) {
              const preview = JSON.stringify(output.content).substring(0, 100);
              console.log(`       输出预览: ${preview}...`);
            }
          }

          console.log('');
        });
      } catch (e) {
        console.log('   ⚠️  无法获取事件详情:', e.message);
      }
    } else {
      console.log('3️⃣  ✅ 没有失败的任务');
    }

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    console.error('');
    console.error('可能的原因:');
    console.error('1. 后端服务未启动');
    console.error('2. API端点不存在');
    console.error('3. 数据库连接失败');
  }

  console.log('');
  console.log('='.repeat(80));
}

diagnose();
