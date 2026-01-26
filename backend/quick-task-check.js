/**
 * 快速检查任务状态 - 不依赖数据库
 */

const http = require('http');

console.log('🔍 检查任务状态...\n');

// 查询最近的任务
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/ai-tasks',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('API响应:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('API响应（原始）:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
  console.log('\n💡 请直接查看后端终端的日志输出');
  console.log('后端应该运行在: http://localhost:3000');
});

req.end();
