const http = require('http');

// 获取项目ID
const projectId = '959f2186-fcba-4791-9b3d-b37e8a3444b1';

// 创建聚类任务
const postData = JSON.stringify({
  projectId,
  type: 'clustering',
  input: {
    documentIds: [
      'doc_56f52577-58d7-4317-987c-af84a593316d',
      'doc_b75c339d-0b3c-46e2-87a5-f807aa7bcf7f',
    ],
    maxTokens: 60000,
  },
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/ai-tasks',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('🚀 正在创建聚类任务...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.id) {
        console.log('✅ 聚类任务已创建');
        console.log('Task ID:', response.id);
        console.log('');
        console.log('🔍 现在请查看后端日志，寻找以下日志：');
        console.log('  - "🚀 [ClusteringGenerator] 开始调用模型: gpt4"');
        console.log('  - "🚀 [ClusteringGenerator] 开始调用模型: domestic"');
        console.log('  - "✅ [ClusteringGenerator] 模型 gpt4 生成成功"');
        console.log('  - "✅ [ClusteringGenerator] 模型 domestic 生成成功"');
        console.log('');
        console.log('如果看到domestic模型的日志，说明通义千问被成功调用了！');
      } else {
        console.log('❌ 创建失败:', response);
      }
    } catch (err) {
      console.log('❌ 解析响应失败:', err.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
});

req.write(postData);
req.end();
