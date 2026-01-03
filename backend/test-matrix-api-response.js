// 测试前端获取矩阵任务的 API 响应
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/ai-tasks/d759603e-1d6a-4504-8498-e7fdcd3eb294',
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
    console.log('\n📦 API 返回数据:\n');

    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('原始数据:');
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
});

req.end();
