const http = require('http');

const taskId = '01b153b7-a93a-4d87-8b71-5b55a02ed1bb';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/ai-tasks/${taskId}/status`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '65fefcd7-3b4b-49d7-a56f-8db474314c62'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📡 /status API Response:');
      console.log('  success:', response.success);
      console.log('  status:', response.data?.status);
      console.log('  stage:', response.data?.stage);
      console.log('  message:', response.data?.message);
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      console.log('Raw:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.end();
