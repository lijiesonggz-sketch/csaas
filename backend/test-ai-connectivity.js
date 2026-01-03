/**
 * AI服务连通性测试脚本
 * 测试OpenAI、Anthropic、Tongyi三个AI服务的连接状态
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk').default;

// 从环境变量读取配置
require('dotenv').config({ path: '.env.development' });

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    embeddingModel: 'text-embedding-3-small'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  },
  tongyi: {
    apiKey: process.env.TONGYI_API_KEY || '',
    baseURL: process.env.TONGYI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.TONGYI_MODEL || 'qwen-long'
  }
};

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function success(message) {
  log(colors.green, '✓', message);
}

function error(message) {
  log(colors.red, '✗', message);
}

function warn(message) {
  log(colors.yellow, '⚠', message);
}

function info(message) {
  log(colors.blue, 'ℹ', message);
}

// 测试OpenAI Chat API
async function testOpenAIChat() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 OpenAI Chat API (GPT-4)');
  console.log('='.repeat(60));

  if (!config.openai.apiKey) {
    warn('OpenAI API Key 未设置 (OPENAI_API_KEY为空)');
    info('当前配置: OPENAI_API_KEY已被禁用');
    return false;
  }

  try {
    const client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
      timeout: 30000
    });

    info(`API Base URL: ${config.openai.baseURL}`);
    info(`模型: ${config.openai.model}`);
    info('正在测试连接...');

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'user', content: '测试连接，请回复"OK"' }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const elapsed = Date.now() - startTime;
    success(`连接成功！耗时: ${elapsed}ms`);
    success(`响应内容: ${response.choices[0].message.content}`);
    info(`Token使用: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`);
    return true;
  } catch (err) {
    error(`连接失败: ${err.message}`);
    if (err.status) {
      error(`HTTP状态码: ${err.status}`);
    }
    if (err.code) {
      error(`错误代码: ${err.code}`);
    }
    return false;
  }
}

// 测试OpenAI Embedding API
async function testOpenAIEmbedding() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 OpenAI Embedding API');
  console.log('='.repeat(60));

  if (!config.openai.apiKey) {
    warn('OpenAI API Key 未设置，跳过测试');
    return false;
  }

  try {
    const client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
      timeout: 30000
    });

    info(`API Base URL: ${config.openai.baseURL}`);
    info(`模型: ${config.openai.embeddingModel}`);
    info('正在测试连接...');

    const startTime = Date.now();
    const response = await client.embeddings.create({
      model: config.openai.embeddingModel,
      input: '测试文本相似度计算',
      encoding_format: 'float'
    });

    const elapsed = Date.now() - startTime;
    success(`连接成功！耗时: ${elapsed}ms`);
    success(`向量维度: ${response.data[0].embedding.length}`);
    info(`Token使用: ${response.usage.total_tokens}`);
    return true;
  } catch (err) {
    error(`连接失败: ${err.message}`);
    if (err.status) {
      error(`HTTP状态码: ${err.status}`);
    }
    return false;
  }
}

// 测试Anthropic (Claude) API
async function testAnthropicChat() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 Anthropic (Claude) API');
  console.log('='.repeat(60));

  if (!config.anthropic.apiKey) {
    warn('Anthropic API Key 未设置');
    return false;
  }

  try {
    const client = new Anthropic({
      apiKey: config.anthropic.apiKey,
      baseURL: config.anthropic.baseURL,
      timeout: 30000
    });

    info(`API Base URL: ${config.anthropic.baseURL || 'https://api.anthropic.com'}`);
    info(`模型: ${config.anthropic.model}`);
    info('正在测试连接...');

    const startTime = Date.now();
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 10,
      messages: [
        { role: 'user', content: '测试连接，请回复"OK"' }
      ]
    });

    const elapsed = Date.now() - startTime;
    success(`连接成功！耗时: ${elapsed}ms`);

    if (response.content && response.content[0]) {
      success(`响应内容: ${response.content[0].text}`);
    }

    info(`Token使用: ${response.usage.input_tokens + response.usage.output_tokens} (input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens})`);
    return true;
  } catch (err) {
    error(`连接失败: ${err.message}`);
    if (err.status) {
      error(`HTTP状态码: ${err.status}`);
    }
    return false;
  }
}

// 测试Tongyi (通义千问) API - 使用OpenAI兼容接口
async function testTongyiChat() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 Tongyi (通义千问) API');
  console.log('='.repeat(60));

  if (!config.tongyi.apiKey) {
    warn('Tongyi API Key 未设置');
    return false;
  }

  try {
    const client = new OpenAI({
      apiKey: config.tongyi.apiKey,
      baseURL: config.tongyi.baseURL,
      timeout: 30000
    });

    info(`API Base URL: ${config.tongyi.baseURL}`);
    info(`模型: ${config.tongyi.model}`);
    info('正在测试连接...');

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: config.tongyi.model,
      messages: [
        { role: 'user', content: '测试连接，请回复"OK"' }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const elapsed = Date.now() - startTime;
    success(`连接成功！耗时: ${elapsed}ms`);
    success(`响应内容: ${response.choices[0].message.content}`);

    if (response.usage) {
      info(`Token使用: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`);
    }
    return true;
  } catch (err) {
    error(`连接失败: ${err.message}`);
    if (err.status) {
      error(`HTTP状态码: ${err.status}`);
    }
    return false;
  }
}

// 主测试函数
async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('  AI 服务连通性测试');
  console.log('█'.repeat(60));

  const results = {
    openaiChat: await testOpenAIChat(),
    openaiEmbedding: await testOpenAIEmbedding(),
    anthropic: await testAnthropicChat(),
    tongyi: await testTongyiChat()
  };

  // 汇总报告
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));

  console.log(`OpenAI Chat API:      ${results.openaiChat ? colors.green + '✓ 可用' : colors.red + '✗ 不可用'}${colors.reset}`);
  console.log(`OpenAI Embedding API: ${results.openaiEmbedding ? colors.green + '✓ 可用' : colors.red + '✗ 不可用'}${colors.reset}`);
  console.log(`Anthropic (Claude):   ${results.anthropic ? colors.green + '✓ 可用' : colors.red + '✗ 不可用'}${colors.reset}`);
  console.log(`Tongyi (通义千问):      ${results.tongyi ? colors.green + '✓ 可用' : colors.red + '✗ 不可用'}${colors.reset}`);

  console.log('\n' + '='.repeat(60));

  // 诊断建议
  if (!results.openaiChat && !results.openaiEmbedding) {
    console.log('\n' + colors.yellow + '⚠ 诊断建议:' + colors.reset);
    console.log('  OpenAI API不可用。可能原因：');
    console.log('  1. OPENAI_API_KEY未设置或已禁用');
    console.log('  2. API Key无效或已过期');
    console.log('  3. 网络连接问题（国内需要代理）');
    console.log('  4. API Base URL配置错误');
    console.log('\n  当前影响：');
    console.log('  - 无法使用GPT-4进行文本生成（会回退到Claude或Tongyi）');
    console.log('  - Embedding相似度计算降级为文本相似度（准确性降低）');
  }

  if (results.anthropic && results.tongyi) {
    console.log('\n' + colors.green + '✓ 至少有2个AI服务可用，系统可正常运行' + colors.reset);
  } else if (results.anthropic || results.tongyi) {
    console.log('\n' + colors.yellow + '⚠ 仅有1个AI服务可用，建议检查其他服务配置' + colors.reset);
  } else {
    console.log('\n' + colors.red + '✗ 所有AI服务均不可用，系统无法正常工作！' + colors.reset);
  }

  console.log();
}

// 运行测试
runAllTests().catch(err => {
  console.error('测试过程中发生未捕获的错误:', err);
  process.exit(1);
});
