/**
 * 使用OpenAI SDK测试三个AI模型的连通性
 */

const OpenAI = require('openai');

// 模型配置
const models = [
  {
    name: 'GLM-4.7 (智谱AI)',
    apiKey: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    modelName: 'glm-4.7'
  },
  {
    name: 'deepseek-v3.2 (深度求索)',
    apiKey: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'deepseek-v3.2'
  },
  {
    name: 'qwen3-max (通义千问)',
    apiKey: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen3-max'
  }
];

// 测试单个模型
async function testModel(model) {
  console.log(`\n🔄 测试 ${model.name}...`);

  try {
    const client = new OpenAI({
      apiKey: model.apiKey,
      baseURL: model.baseURL,
      timeout: 60000, // 60秒超时
      maxRetries: 1
    });

    const startTime = Date.now();

    const completion = await client.chat.completions.create({
      model: model.modelName,
      messages: [
        {
          role: 'user',
          content: '你好，请简单回复"连通性测试成功"'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const executionTime = Date.now() - startTime;

    const content = completion.choices[0]?.message?.content || '无返回内容';
    const usage = completion.usage || {};

    console.log(`✅ ${model.name} - 连通成功！`);
    console.log(`   响应: ${content.substring(0, 80)}`);
    console.log(`   用时: ${executionTime}ms`);
    console.log(`   Token: 输入=${usage.prompt_tokens || 0}, 输出=${usage.completion_tokens || 0}, 总计=${usage.total_tokens || 0}`);

    return {
      model: model.name,
      success: true,
      response: content.substring(0, 100),
      usage: usage,
      time: executionTime
    };

  } catch (error) {
    console.log(`❌ ${model.name} - 连通失败`);
    console.log(`   错误类型: ${error.name}`);
    console.log(`   错误信息: ${error.message}`);

    // 检查是否是API密钥问题
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log(`   💡 可能是API密钥无效或过期`);
    }
    // 检查是否是模型不存在
    else if (error.message.includes('404') || error.message.includes('model')) {
      console.log(`   💡 可能是模型名称不正确`);
    }
    // 检查是否是网络问题
    else if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log(`   💡 可能是网络连接问题或API服务不可用`);
    }

    return {
      model: model.name,
      success: false,
      error: error.message,
      errorType: error.name
    };
  }
}

// 主测试函数
async function testAllModels() {
  console.log('='.repeat(70));
  console.log('🧪 使用OpenAI SDK测试三个AI模型的连通性');
  console.log('='.repeat(70));

  const results = [];

  for (const model of models) {
    const result = await testModel(model);
    results.push(result);

    // 等待1秒再测试下一个
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
      console.log(`   Token: 输入=${result.usage?.prompt_tokens || 0}, 输出=${result.usage?.completion_tokens || 0}`);
      console.log(`   用时: ${result.time}ms`);
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
    console.log('\n⚠️ 部分模型无法连接，建议：');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.model}: 请检查API密钥、模型名称和baseURL配置`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有模型连通性测试通过！可以正常使用。');
    process.exit(0);
  }
}

// 运行测试
testAllModels().catch(error => {
  console.error('\n❌ 测试过程出错:', error.message);
  console.error(error.stack);
  process.exit(1);
});
