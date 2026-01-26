/**
 * 测试三个AI模型的连通性
 */

const https = require('https');

// 模型配置
const models = [
  {
    name: 'GLM-4.7 (智谱AI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
    apiKey: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
    modelName: 'glm-4.7',
    path: '/chat/completions'
  },
  {
    name: 'deepseek-v3.2 (深度求索)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
    modelName: 'deepseek-v3.2',
    path: '/chat/completions'
  },
  {
    name: 'qwen3-max (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
    modelName: 'qwen3-max',
    path: '/chat/completions'
  }
];

// 测试单个模型
function testModel(model) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 测试 ${model.name}...`);

    const testData = {
      model: model.modelName,
      messages: [
        {
          role: 'user',
          content: '你好，请回复"连通性测试成功"'
        }
      ],
      max_tokens: 50
    };

    const url = new URL(model.path, model.baseUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200) {
            const content = response.choices?.[0]?.message?.content || '无返回内容';
            const usage = response.usage || {};

            console.log(`✅ ${model.name} - 连通成功！`);
            console.log(`   响应: ${content.substring(0, 50)}`);
            console.log(`   Token使用: ${JSON.stringify(usage)}`);

            resolve({
              model: model.name,
              success: true,
              response: content.substring(0, 100),
              usage: usage
            });
          } else {
            console.log(`❌ ${model.name} - HTTP ${res.statusCode}`);
            console.log(`   错误: ${JSON.stringify(response)}`);

            reject({
              model: model.name,
              success: false,
              error: `HTTP ${res.statusCode}: ${JSON.stringify(response)}`
            });
          }
        } catch (error) {
          console.log(`❌ ${model.name} - 解析响应失败`);
          console.log(`   错误: ${error.message}`);
          console.log(`   响应内容: ${data.substring(0, 200)}`);

          reject({
            model: model.name,
            success: false,
            error: `解析失败: ${error.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${model.name} - 请求失败`);
      console.log(`   错误: ${error.message}`);

      reject({
        model: model.name,
        success: false,
        error: error.message
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      console.log(`❌ ${model.name} - 请求超时（30秒）`);

      reject({
        model: model.name,
        success: false,
        error: '请求超时'
      });
    });

    req.write(JSON.stringify(testData));
    req.end();
  });
}

// 主测试函数
async function testAllModels() {
  console.log('='.repeat(70));
  console.log('🧪 开始测试三个AI模型的连通性');
  console.log('='.repeat(70));

  const results = [];

  for (const model of models) {
    try {
      const result = await testModel(model);
      results.push(result);
    } catch (error) {
      results.push(error);
    }

    // 等待1秒再测试下一个，避免触发限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(70));

  results.forEach(result => {
    if (result.success) {
      console.log(`\n✅ ${result.model}`);
      console.log(`   状态: 连通成功`);
      console.log(`   响应: ${result.response}`);
      if (result.usage && Object.keys(result.usage).length > 0) {
        console.log(`   Token: ${JSON.stringify(result.usage)}`);
      }
    } else {
      console.log(`\n❌ ${result.model}`);
      console.log(`   状态: 连通失败`);
      console.log(`   错误: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  console.log('\n' + '='.repeat(70));
  console.log(`总计: ${results.length} 个模型`);
  console.log(`成功: ${successCount} 个 ✅`);
  console.log(`失败: ${failCount} 个 ❌`);
  console.log('='.repeat(70));

  if (failCount > 0) {
    console.log('\n⚠️ 部分模型无法连接，请检查API密钥和网络配置');
    process.exit(1);
  } else {
    console.log('\n🎉 所有模型连通性测试通过！');
    process.exit(0);
  }
}

// 运行测试
testAllModels().catch(error => {
  console.error('\n❌ 测试过程出错:', error.message);
  process.exit(1);
});
