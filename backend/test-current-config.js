/**
 * 测试当前.env.development配置的三个AI模型
 */

const OpenAI = require('openai');

async function testModel(name, apiKey, baseURL, modelName) {
  console.log(`\n🔄 测试 ${name}...`);
  console.log(`   Base URL: ${baseURL}`);
  console.log(`   Model: ${modelName}`);

  try {
    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30000,
      maxRetries: 1
    });

    const startTime = Date.now();

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: '你好，请简单回复"连通性测试成功"'
        }
      ],
      max_tokens: 50,
      temperature: 0.7
    });

    const executionTime = Date.now() - startTime;

    const content = completion.choices[0]?.message?.content || '无返回内容';
    const usage = completion.usage || {};

    console.log(`✅ ${name} - 连通成功！`);
    console.log(`   响应: ${content}`);
    console.log(`   用时: ${executionTime}ms`);
    console.log(`   Token: 输入=${usage.prompt_tokens || 0}, 输出=${usage.completion_tokens || 0}`);

    return {
      model: name,
      success: true,
      response: content,
      usage: usage,
      time: executionTime
    };

  } catch (error) {
    console.log(`❌ ${name} - 连通失败`);
    console.log(`   错误类型: ${error.name}`);
    console.log(`   错误信息: ${error.message}`);

    // 详细分析错误
    if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('invalid_api_key')) {
      console.log(`   💡 API密钥无效或过期`);
    } else if (error.message.includes('404') || error.message.includes('model') || error.message.includes('not found')) {
      console.log(`   💡 模型名称不存在或不可用`);
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.log(`   💡 网络连接失败 - Base URL可能错误`);
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.log(`   💡 请求超时 - 服务响应慢`);
    }

    return {
      model: name,
      success: false,
      error: error.message,
      errorType: error.name
    };
  }
}

async function testAllModels() {
  console.log('='.repeat(70));
  console.log('🧪 测试当前配置的三个AI模型');
  console.log('='.repeat(70));

  // 从.env.development读取配置
  const models = [
    {
      name: 'GPT-4 (GLM-4.7)',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      modelName: process.env.OPENAI_MODEL
    },
    {
      name: 'Claude (claude-sonnet-4-5-20250929)',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
      modelName: process.env.ANTHROPIC_MODEL
    },
    {
      name: 'Qwen (qwen3-max)',
      apiKey: process.env.TONGYI_API_KEY,
      baseURL: process.env.TONGYI_BASE_URL,
      modelName: process.env.TONGYI_MODEL
    }
  ];

  const results = [];

  for (const model of models) {
    const result = await testModel(model.name, model.apiKey, model.baseURL, model.modelName);
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
    console.log('\n⚠️ 发现问题：部分模型无法连接');
    console.log('建议：');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.model}: 需要检查配置`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有模型连通性测试通过！');
    process.exit(0);
  }
}

// 加载环境变量
require('dotenv').config({ path: '.env.development' });

testAllModels().catch(error => {
  console.error('\n❌ 测试过程出错:', error.message);
  console.error(error.stack);
  process.exit(1);
});
