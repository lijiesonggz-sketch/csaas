const http = require('http');

const taskId = '510233a2-e8d1-48b5-891b-ab244c0e4ffc';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/ai-tasks/${taskId}/status`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

console.log(`🔍 检查任务状态API: ${taskId}\n`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('API响应:');
      console.log(JSON.stringify(response, null, 2));
    } catch (err) {
      console.log('❌ 解析失败:', err.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
});

req.end();
