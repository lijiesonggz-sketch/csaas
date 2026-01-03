const http = require('http');

// 测试后端健康检查
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`\n状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}\n`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应内容:', data);
    if (res.statusCode === 200) {
      console.log('\n✅ 后端服务正常运行');
    } else {
      console.log('\n❌ 后端服务响应异常');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 无法连接到后端服务:', error.message);
});

req.end();

// 测试创建问卷填写记录
setTimeout(() => {
  console.log('\n\n=== 测试创建问卷填写记录 ===\n');

  const postData = JSON.stringify({
    questionnaireTaskId: 'c0724466-1abc-4895-8b08-37f460aada2e',
    respondentName: '测试用户',
    respondentEmail: 'test@example.com',
  });

  const postOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/survey',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const postReq = http.request(postOptions, (res) => {
    console.log(`状态码: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('响应内容:', data);
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          console.log('\n✅ 问卷填写记录创建成功');
          console.log('记录ID:', parsed.data.id);
        } else {
          console.log('\n❌ 创建失败:', parsed.message || parsed.error);
        }
      } catch (e) {
        console.log('\n❌ 响应解析失败');
      }
    });
  });

  postReq.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
  });

  postReq.write(postData);
  postReq.end();
}, 1000);
