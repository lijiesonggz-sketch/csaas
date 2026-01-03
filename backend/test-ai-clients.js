/**
 * AI 客户端测试脚本
 * 测试 OpenAI, Anthropic, 通义千问 三个模型的调用情况
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: './.env.development' });

// 测试提示词
const TEST_PROMPT = '请用一句话介绍什么是人工智能。';

// 颜色输出
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

// 测试 OpenAI
async function testOpenAI() {
  log(colors.cyan, '\n=== 测试 OpenAI ===');
  log(colors.blue, `API Key: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);
  log(colors.blue, `Base URL: ${process.env.OPENAI_BASE_URL}`);
  log(colors.blue, `Model: ${process.env.OPENAI_MODEL}`);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 100,
    });

    const duration = Date.now() - startTime;
    const result = response.choices[0].message.content;

    log(colors.green, '✓ OpenAI 调用成功');
    log(colors.blue, `耗时: ${duration}ms`);
    log(colors.blue, `Tokens: ${response.usage.total_tokens}`);
    log(colors.blue, `响应: ${result}`);

    return { success: true, duration, tokens: response.usage.total_tokens };
  } catch (error) {
    log(colors.red, '✗ OpenAI 调用失败');
    log(colors.red, `错误类型: ${error.constructor.name}`);
    log(colors.red, `错误信息: ${error.message}`);
    if (error.cause) {
      log(colors.red, `根本原因: ${error.cause.message}`);
    }
    return { success: false, error: error.message };
  }
}

// 测试 Anthropic (Claude)
async function testAnthropic() {
  log(colors.cyan, '\n=== 测试 Anthropic (Claude) ===');
  log(colors.blue, `API Key: ${process.env.ANTHROPIC_API_KEY?.substring(0, 20)}...`);
  log(colors.blue, `Base URL: ${process.env.ANTHROPIC_BASE_URL}`);
  log(colors.blue, `Model: ${process.env.ANTHROPIC_MODEL}`);

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    const startTime = Date.now();
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL,
      max_tokens: 100,
      messages: [{ role: 'user', content: TEST_PROMPT }],
    });

    const duration = Date.now() - startTime;
    const result = response.content[0].text;

    log(colors.green, '✓ Anthropic 调用成功');
    log(colors.blue, `耗时: ${duration}ms`);
    log(colors.blue, `Tokens: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);
    log(colors.blue, `响应: ${result}`);

    return {
      success: true,
      duration,
      tokens: response.usage.input_tokens + response.usage.output_tokens
    };
  } catch (error) {
    log(colors.red, '✗ Anthropic 调用失败');
    log(colors.red, `错误类型: ${error.constructor.name}`);
    log(colors.red, `错误信息: ${error.message}`);
    if (error.cause) {
      log(colors.red, `根本原因: ${error.cause.message}`);
    }
    return { success: false, error: error.message };
  }
}

// 测试通义千问
async function testTongyi() {
  log(colors.cyan, '\n=== 测试通义千问 ===');
  log(colors.blue, `API Key: ${process.env.TONGYI_API_KEY?.substring(0, 20)}...`);
  log(colors.blue, `Base URL: ${process.env.TONGYI_BASE_URL}`);
  log(colors.blue, `Model: ${process.env.TONGYI_MODEL}`);

  try {
    // 通义千问使用 OpenAI 兼容接口
    const client = new OpenAI({
      apiKey: process.env.TONGYI_API_KEY,
      baseURL: process.env.TONGYI_BASE_URL,
    });

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: process.env.TONGYI_MODEL,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 100,
    });

    const duration = Date.now() - startTime;
    const result = response.choices[0].message.content;

    log(colors.green, '✓ 通义千问 调用成功');
    log(colors.blue, `耗时: ${duration}ms`);
    log(colors.blue, `Tokens: ${response.usage.total_tokens}`);
    log(colors.blue, `响应: ${result}`);

    return { success: true, duration, tokens: response.usage.total_tokens };
  } catch (error) {
    log(colors.red, '✗ 通义千问 调用失败');
    log(colors.red, `错误类型: ${error.constructor.name}`);
    log(colors.red, `错误信息: ${error.message}`);
    if (error.cause) {
      log(colors.red, `根本原因: ${error.cause.message}`);
    }
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runTests() {
  log(colors.yellow, '╔═══════════════════════════════════════╗');
  log(colors.yellow, '║    AI 模型调用测试                    ║');
  log(colors.yellow, '╚═══════════════════════════════════════╝');

  const results = {
    openai: await testOpenAI(),
    anthropic: await testAnthropic(),
    tongyi: await testTongyi(),
  };

  // 汇总结果
  log(colors.cyan, '\n=== 测试结果汇总 ===');
  const successCount = Object.values(results).filter(r => r.success).length;
  const totalCount = Object.keys(results).length;

  log(colors.blue, `成功: ${successCount}/${totalCount}`);

  log(colors.blue, '\n详细结果:');
  log(results.openai.success ? colors.green : colors.red,
    `  OpenAI:     ${results.openai.success ? '✓ 成功' : '✗ 失败'} ${results.openai.success ? `(${results.openai.duration}ms, ${results.openai.tokens} tokens)` : `- ${results.openai.error}`}`);
  log(results.anthropic.success ? colors.green : colors.red,
    `  Anthropic:  ${results.anthropic.success ? '✓ 成功' : '✗ 失败'} ${results.anthropic.success ? `(${results.anthropic.duration}ms, ${results.anthropic.tokens} tokens)` : `- ${results.anthropic.error}`}`);
  log(results.tongyi.success ? colors.green : colors.red,
    `  通义千问:    ${results.tongyi.success ? '✓ 成功' : '✗ 失败'} ${results.tongyi.success ? `(${results.tongyi.duration}ms, ${results.tongyi.tokens} tokens)` : `- ${results.tongyi.error}`}`);

  log(colors.yellow, '\n测试完成！\n');
}

// 运行测试
runTests().catch(error => {
  log(colors.red, '测试执行出错:', error);
  process.exit(1);
});
