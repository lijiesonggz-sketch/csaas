/**
 * 测试三个AI模型的连通性
 */

const OpenAI = require('openai');

async function testModel(name, apiKey, baseURL, modelName) {
  console.log(`\n测试 ${name}...`);
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

    console.log(`[成功] ${name}`);
    console.log(`   响应: ${content}`);
    console.log(`   用时: ${executionTime}ms`);
    console.log(`   Token: 输入=${usage.prompt_tokens || 0}, 输出=${usage.completion_tokens || 0}`);

    return { success: true, model: name, response: content };
  } catch (error) {
    console.log(`[失败] ${name}`);
    console.log(`   错误: ${error.message}`);
    return { success: false, model: name, error: error.message };
  }
}

async function testAll() {
  console.log('='.repeat(70));
  console.log('测试三个AI模型的连通性');
  console.log('='.repeat(70));

  const models = [
    {
      name: 'GPT-4 (GLM-4.7)',
      apiKey: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      modelName: 'glm-4.7'
    },
    {
      name: 'Claude (claude-sonnet-4-5-20250929)',
      apiKey: 'cr_b0d5e66bf37ee7f633b002ddca7f0a682734aaaf7dde83960833be107e21f3fd',
      baseURL: 'https://as.imds.ai/api',
      modelName: 'claude-sonnet-4-5-20250929'
    },
    {
      name: 'Qwen (qwen3-max)',
      apiKey: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelName: 'qwen3-max'
    }
  ];

  const results = [];
  for (const model of models) {
    const result = await testModel(model.name, model.apiKey, model.baseURL, model.modelName);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('测试结果汇总');
  console.log('='.repeat(70));

  results.forEach(r => {
    if (r.success) {
      console.log(`[OK] ${r.model}: 可用`);
    } else {
      console.log(`[FAIL] ${r.model}: 不可用 - ${r.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n总计: ${results.length} 个模型，成功: ${successCount} 个`);

  if (successCount === 3) {
    console.log('\n所有模型可用！');
  } else if (successCount === 0) {
    console.log('\n所有模型都不可用');
    process.exit(1);
  } else {
    console.log('\n部分模型不可用');
  }
}

testAll().catch(error => {
  console.error('测试出错:', error.message);
  process.exit(1);
});
