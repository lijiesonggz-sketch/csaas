// 测试获取项目任务列表 API
const http = require('http');

const projectId = '8e815c62-f034-4497-8eab-a6f37d42b3d9';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/ai-tasks/project/${projectId}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '65fefcd7-3b4b-49d7-a56f-8db474314c62',
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📡 API 响应状态:', res.statusCode);
    console.log('\n📦 项目任务列表：\n');

    try {
      const parsed = JSON.parse(data);

      if (parsed.success && parsed.data) {
        const tasks = parsed.data;
        console.log(`✅ 获取到 ${tasks.length} 个任务\n`);

        // 筛选问卷任务
        const questionnaireTasks = tasks.filter(t => t.type === 'questionnaire');
        console.log(`📋 问卷任务数量: ${questionnaireTasks.length}\n`);

        // 按时间倒序排序
        questionnaireTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        console.log('问卷任务列表（按时间倒序）：');
        questionnaireTasks.forEach((task, idx) => {
          console.log(`${idx + 1}. ${task.id.substring(0, 8)}...`);
          console.log(`   状态: ${task.status}`);
          console.log(`   创建时间: ${task.createdAt}`);
          console.log(`   有 result: ${!!task.result}`);
          console.log(`   isCompleted: ${task.status === 'completed' && !!task.result}`);
          console.log('');
        });

        // 前端会选第一个
        if (questionnaireTasks.length > 0) {
          const selectedTask = questionnaireTasks[0];
          console.log('🎯 前端会选择这个任务：');
          console.log(`   任务ID: ${selectedTask.id}`);
          console.log(`   状态: ${selectedTask.status}`);
          console.log(`   有 result: ${!!selectedTask.result}`);
          console.log(`   会显示: ${selectedTask.status === 'completed' && !!selectedTask.result ? '✅ 是' : '❌ 否'}`);
        }
      } else {
        console.log('❌ API 返回格式异常');
        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log('❌ JSON 解析失败:', e.message);
      console.log('原始数据前500字符:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ 请求失败:', e.message);
});

req.end();
