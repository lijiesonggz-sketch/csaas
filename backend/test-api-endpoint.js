// 测试API端点返回的数据
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/ai-tasks/project/16639558-c44d-41eb-a328-277182335f90',
  method: 'GET',
  headers: {
    'x-user-id': '65fefcd7-3b4b-49d7-a56f-8db474314c62',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const actionPlanTasks = json.data.filter(t => t.type === 'action_plan');

      if (actionPlanTasks.length > 0) {
        const latestTask = actionPlanTasks.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        )[0];

        console.log('=== API 返回的 Action Plan 任务 ===');
        console.log('ID:', latestTask.id);
        console.log('Type:', latestTask.type);
        console.log('Status:', latestTask.status);
        console.log('Has Result:', latestTask.result !== null);
        console.log('Result Type:', typeof latestTask.result);

        if (latestTask.result) {
          console.log('\n=== Result 数据 ===');
          console.log(JSON.stringify(latestTask.result, null, 2));
        } else {
          console.log('\n⚠️  API 返回的 result 为 null！');
        }

        // 前端检查逻辑
        console.log('\n=== 前端检查逻辑 ===');
        console.log('task.status === "completed":', latestTask.status === 'completed');
        console.log('task.result 存在:', !!latestTask.result);
        console.log('应该设置result:', latestTask.status === 'completed' && latestTask.result);
      } else {
        console.log('没有找到 action_plan 任务');
      }
    } catch (err) {
      console.error('解析失败:', err.message);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求失败: ${e.message}`);
});

req.end();
