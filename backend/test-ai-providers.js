const { Client } = require('pg');
const OpenAI = require('openai');

async function testProviders() {
  // 从 .env 读取配置
  const config = {
    // OpenAI (智谱AI)
    OPENAI_API_KEY: 'c047b612d64c4663bdce563fdf05aec0.poaOCXh3RU3Yr6to',
    OPENAI_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
    OPENAI_MODEL: 'glm-4.7',

    // Anthropic
    ANTHROPIC_API_KEY: 'cr_b0d5e66bf37ee7f633b002ddca7f0a682734aaaf7dde83960833be107e21f3fd',
    ANTHROPIC_BASE_URL: 'https://as.imds.ai/api',
    ANTHROPIC_MODEL: 'claude-sonnet-4-5-20250929',

    // Tongyi
    TONGYI_API_KEY: 'sk-226e5b63d3884dbdb510b343a3ea7d7f',
    TONGYI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    TONGYI_MODEL: 'qwen-long',
  };

  const testPrompt = '请回答：1+1等于几？只需回答数字。';

  console.log('=== 测试 AI 提供商连接 ===\n');

  // 测试 OpenAI (智谱AI)
  console.log('1. 测试 OpenAI (智谱AI GLM)...');
  try {
    const openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      baseURL: config.OPENAI_BASE_URL,
      timeout: 30000,
    });

    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [{ role: 'user', content: testPrompt }],
      max_tokens: 50,
    });

    console.log('   ✅ 成功:', response.choices[0].message.content);
    console.log('   Model:', response.model);
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
  }

  console.log('');

  // 测试 Anthropic
  console.log('2. 测试 Anthropic (Claude)...');
  try {
    const anthropic = new OpenAI({
      apiKey: config.ANTHROPIC_API_KEY,
      baseURL: config.ANTHROPIC_BASE_URL,
      timeout: 30000,
    });

    const response = await anthropic.chat.completions.create({
      model: config.ANTHROPIC_MODEL,
      messages: [{ role: 'user', content: testPrompt }],
      max_tokens: 50,
    });

    console.log('   ✅ 成功:', response.choices[0].message.content);
    console.log('   Model:', response.model);
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
  }

  console.log('');

  // 测试 Tongyi
  console.log('3. 测试 Tongyi (通义千问)...');
  try {
    const tongyi = new OpenAI({
      apiKey: config.TONGYI_API_KEY,
      baseURL: config.TONGYI_BASE_URL,
      timeout: 30000,
    });

    const response = await tongyi.chat.completions.create({
      model: config.TONGYI_MODEL,
      messages: [{ role: 'user', content: testPrompt }],
      max_tokens: 50,
    });

    console.log('   ✅ 成功:', response.choices[0].message.content);
    console.log('   Model:', response.model);
  } catch (error) {
    console.log('   ❌ 失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
}

testProviders().catch(console.error);
