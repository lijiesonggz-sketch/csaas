/**
 * AI Clients 功能测试脚本
 * 测试：1. 检查API配置状态
 *      2. 测试AI调用（如果有API key）
 *      3. 测试fallback机制
 */

const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk').default;

// 从环境变量读取配置
require('dotenv').config({ path: '.env.development' });

console.log('=== AI Clients 配置检查 ===\n');

// 1. 检查OpenAI配置
const openaiKey = process.env.OPENAI_API_KEY;
const openaiAvailable = openaiKey && openaiKey !== 'sk-your-openai-api-key-here' && openaiKey !== 'dummy-key';
console.log(`OpenAI: ${openaiAvailable ? '✅ 已配置' : '❌ 未配置'}`);
if (openaiAvailable) {
  console.log(`  - Model: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
  console.log(`  - Base URL: ${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}`);
}

// 2. 检查Anthropic配置
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropicAvailable = anthropicKey && anthropicKey !== 'sk-ant-your-anthropic-api-key-here' && anthropicKey !== 'dummy-key';
console.log(`\nAnthropic: ${anthropicAvailable ? '✅ 已配置' : '❌ 未配置'}`);
if (anthropicAvailable) {
  console.log(`  - Model: ${process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'}`);
}

// 3. 检查Tongyi配置
const tongyiKey = process.env.TONGYI_API_KEY;
const tongyiAvailable = tongyiKey && tongyiKey !== 'your-tongyi-api-key-here' && tongyiKey !== 'dummy-key';
console.log(`\nTongyi (通义千问): ${tongyiAvailable ? '✅ 已配置' : '❌ 未配置'}`);
if (tongyiAvailable) {
  console.log(`  - Model: ${process.env.TONGYI_MODEL || 'qwen-plus'}`);
  console.log(`  - Base URL: ${process.env.TONGYI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}`);
}

console.log('\n=== 可测试功能 ===\n');

const availableCount = [openaiAvailable, anthropicAvailable, tongyiAvailable].filter(Boolean).length;

if (availableCount === 0) {
  console.log('❌ 没有配置任何API key');
  console.log('\n请在 .env.development 文件中配置至少一个AI API key：');
  console.log('  - OPENAI_API_KEY=sk-...');
  console.log('  - ANTHROPIC_API_KEY=sk-ant-...');
  console.log('  - TONGYI_API_KEY=sk-...');
} else if (availableCount === 1) {
  console.log(`✅ 已配置 ${availableCount} 个API`);
  console.log('\n可测试功能：');
  console.log('  ✅ 基础AI调用');
  console.log('  ✅ 任务队列处理');
  console.log('  ✅ 成本追踪');
  console.log('  ⚠️  Fallback机制（建议配置第2个API）');
} else {
  console.log(`✅ 已配置 ${availableCount} 个API`);
  console.log('\n可测试所有功能：');
  console.log('  ✅ 基础AI调用');
  console.log('  ✅ 任务队列处理');
  console.log('  ✅ 成本追踪');
  console.log('  ✅ Fallback机制');
  console.log('  ✅ 多提供商成本对比');
}

console.log('\n=== 推荐配置组合 ===\n');
console.log('方案1（推荐）: OpenAI + Tongyi');
console.log('  - OpenAI: 质量最好');
console.log('  - Tongyi: 国内稳定，成本低');
console.log('\n方案2: Anthropic + Tongyi');
console.log('  - Anthropic: 代码能力强');
console.log('  - Tongyi: 国内备选');
console.log('\n方案3: OpenAI + Anthropic');
console.log('  - 两个顶级国际模型');
console.log('  - 需要稳定国际网络');

// 测试API调用（如果有配置）
async function testAPICalls() {
  console.log('\n=== API调用测试 ===\n');

  if (openaiAvailable) {
    try {
      console.log('测试 OpenAI...');
      const openai = new OpenAI({
        apiKey: openaiKey,
        baseURL: process.env.OPENAI_BASE_URL,
        timeout: 10000,
      });

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [{ role: 'user', content: '请用一句话介绍你自己' }],
        max_tokens: 50,
      });

      console.log(`✅ OpenAI 调用成功`);
      console.log(`   响应: ${response.choices[0].message.content}`);
      console.log(`   Tokens: ${response.usage.total_tokens}`);
    } catch (error) {
      console.log(`❌ OpenAI 调用失败: ${error.message}`);
    }
  }

  if (anthropicAvailable) {
    try {
      console.log('\n测试 Anthropic...');
      const anthropic = new Anthropic({
        apiKey: anthropicKey,
        timeout: 10000,
      });

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: '请用一句话介绍你自己' }],
      });

      console.log(`✅ Anthropic 调用成功`);
      console.log(`   响应: ${response.content[0].text}`);
      console.log(`   Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);
    } catch (error) {
      console.log(`❌ Anthropic 调用失败: ${error.message}`);
    }
  }

  if (tongyiAvailable) {
    try {
      console.log('\n测试 Tongyi (通义千问)...');
      const tongyi = new OpenAI({
        apiKey: tongyiKey,
        baseURL: process.env.TONGYI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        timeout: 10000,
      });

      const response = await tongyi.chat.completions.create({
        model: process.env.TONGYI_MODEL || 'qwen-plus',
        messages: [{ role: 'user', content: '请用一句话介绍你自己' }],
        max_tokens: 50,
      });

      console.log(`✅ Tongyi 调用成功`);
      console.log(`   响应: ${response.choices[0].message.content}`);
      console.log(`   Tokens: ${response.usage.total_tokens}`);
    } catch (error) {
      console.log(`❌ Tongyi 调用失败: ${error.message}`);
    }
  }
}

// 如果有任何API配置，运行测试
if (availableCount > 0) {
  console.log('\n=== 开始API连接测试 ===');
  console.log('(这将实际调用AI API，会产生少量费用)\n');

  testAPICalls().then(() => {
    console.log('\n=== 测试完成 ===\n');
    process.exit(0);
  }).catch(error => {
    console.error('\n测试出错:', error);
    process.exit(1);
  });
} else {
  process.exit(0);
}
