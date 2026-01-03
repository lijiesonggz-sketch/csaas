// 模拟前端逻辑测试
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
      const tasks = JSON.parse(data);

      // 模拟前端逻辑
      const actionPlanTasks = tasks
        .filter(t => t.type === 'action_plan')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (actionPlanTasks.length > 0) {
        const latestTask = actionPlanTasks[0];

        console.log('=== 前端逻辑测试 ===\n');
        console.log('1. 找到 action_plan 任务:', actionPlanTasks.length, '个');
        console.log('2. 最新任务 ID:', latestTask.id);
        console.log('3. 最新任务类型:', latestTask.type);
        console.log('4. 最新任务状态:', latestTask.status);
        console.log('5. 最新任务有 result:', !!latestTask.result);
        console.log('6. 最新任务 result 内容:', JSON.stringify(latestTask.result, null, 2));

        console.log('\n=== 前端检查逻辑 ===\n');
        console.log('task.type === "action_plan":', latestTask.type === 'action_plan');
        console.log('task.status === "completed":', latestTask.status === 'completed');
        console.log('task.result 存在:', latestTask.result !== null);
        console.log('task.result !== undefined:', latestTask.result !== undefined);

        console.log('\n=== 应该设置 result ===\n');
        const shouldSetResult = latestTask.status === 'completed' && latestTask.result;
        console.log('条件 (status === "completed" && result):', shouldSetResult);

        if (shouldSetResult) {
          console.log('✅ 前端应该显示结果！');
        } else {
          console.log('❌ 前端应该显示"待处理"');
        }
      } else {
        console.log('❌ 没有找到 action_plan 任务');
      }
    } catch (err) {
      console.error('解析失败:', err.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求失败: ${e.message}`);
});

req.end();
