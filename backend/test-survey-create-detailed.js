const http = require('http');

const postData = JSON.stringify({
  questionnaireTaskId: 'c0724466-1abc-4895-8b08-37f460aada2e',
  respondentName: '测试用户',
  respondentEmail: 'test@example.com',
  respondentDepartment: '技术部',
  respondentPosition: '工程师',
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/survey',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('发送请求...');
console.log('请求数据:', postData);
console.log('');

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头:`, res.headers);
  console.log('');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('完整响应:', data);
    console.log('');

    try {
      const parsed = JSON.parse(data);
      console.log('解析后的响应:', JSON.stringify(parsed, null, 2));

      if (res.statusCode === 500) {
        console.log('\n❌ 服务器内部错误');
        console.log('错误信息:', parsed.message);
        if (parsed.error) {
          console.log('详细错误:', parsed.error);
        }
      } else if (res.statusCode === 400) {
        console.log('\n❌ 请求错误');
        console.log('错误信息:', parsed.message);
      } else if (res.statusCode === 201 || res.statusCode === 200) {
        console.log('\n✅ 创建成功');
        console.log('问卷ID:', parsed.data?.id);
      }
    } catch (e) {
      console.log('\n❌ 响应解析失败:', e.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error);
});

req.write(postData);
req.end();
