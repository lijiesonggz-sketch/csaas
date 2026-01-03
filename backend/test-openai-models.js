/**
 * 测试 OpenAI 不同模型的可用性
 */

const OpenAI = require('openai');
require('dotenv').config({ path: './.env.development' });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// 常用的OpenAI模型列表
const MODELS_TO_TEST = [
  'gpt-4o',           // 最新多模态模型
  'gpt-4-turbo',      // GPT-4 Turbo
  'gpt-4',            // GPT-4 标准版
  'gpt-3.5-turbo',    // GPT-3.5 Turbo
];

const TEST_PROMPT = '请用一句话介绍什么是人工智能。';

async function testOpenAIModel(client, modelName) {
  try {
    log(colors.blue, `\n测试模型: ${modelName}`);

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 100,
    });

    const duration = Date.now() - startTime;
    const result = response.choices[0].message.content;

    log(colors.green, `✓ ${modelName} - 成功`);
    log(colors.blue, `  耗时: ${duration}ms`);
    log(colors.blue, `  Tokens: ${response.usage.total_tokens}`);
    log(colors.blue, `  响应: ${result.substring(0, 50)}...`);

    return {
      model: modelName,
      success: true,
      duration,
      tokens: response.usage.total_tokens
    };
  } catch (error) {
    log(colors.red, `✗ ${modelName} - 失败`);
    log(colors.red, `  错误: ${error.message}`);

    return {
      model: modelName,
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  log(colors.yellow, '╔═══════════════════════════════════════╗');
  log(colors.yellow, '║    OpenAI 模型可用性测试（VPN环境）   ║');
  log(colors.yellow, '╚═══════════════════════════════════════╝');

  log(colors.cyan, '\n配置信息:');
  log(colors.blue, `API Key: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);
  log(colors.blue, `Base URL: ${process.env.OPENAI_BASE_URL}`);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  log(colors.cyan, '\n开始测试各个模型...');

  const results = [];
  for (const model of MODELS_TO_TEST) {
    const result = await testOpenAIModel(client, model);
    results.push(result);
    // 稍微延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 汇总结果
  log(colors.cyan, '\n╔═══════════════════════════════════════╗');
  log(colors.cyan, '║          测试结果汇总                  ║');
  log(colors.cyan, '╚═══════════════════════════════════════╝');

  const successModels = results.filter(r => r.success);
  log(colors.blue, `\n成功: ${successModels.length}/${results.length}`);

  if (successModels.length > 0) {
    log(colors.green, '\n✓ 可用模型:');
    successModels.forEach(r => {
      log(colors.green, `  - ${r.model} (${r.duration}ms, ${r.tokens} tokens)`);
    });

    // 推荐最快的模型
    const fastest = successModels.sort((a, b) => a.duration - b.duration)[0];
    log(colors.yellow, `\n🚀 推荐使用: ${fastest.model} (响应最快)`);
  }

  const failedModels = results.filter(r => !r.success);
  if (failedModels.length > 0) {
    log(colors.red, '\n✗ 失败模型:');
    failedModels.forEach(r => {
      log(colors.red, `  - ${r.model}: ${r.error}`);
    });
  }

  log(colors.cyan, '\n测试完成！\n');

  return successModels.length > 0 ? successModels[0] : null;
}

// 运行测试
runTests()
  .then(recommendedModel => {
    if (recommendedModel) {
      log(colors.green, '✓ OpenAI API 连接正常！');
      log(colors.yellow, '\n建议更新 .env.development 中的配置:');
      log(colors.cyan, `OPENAI_MODEL=${recommendedModel.model}`);
      process.exit(0);
    } else {
      log(colors.red, '✗ 所有模型测试失败，请检查:');
      log(colors.yellow, '1. VPN 是否正常工作');
      log(colors.yellow, '2. API Key 是否有效');
      log(colors.yellow, '3. 网络连接是否稳定');
      process.exit(1);
    }
  })
  .catch(error => {
    log(colors.red, '测试执行出错:', error);
    process.exit(1);
  });
