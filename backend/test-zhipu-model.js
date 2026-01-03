/**
 * 测试智谱AI GLM模型调用
 */

const OpenAI = require('openai');
require('dotenv').config({ path: './.env.development' });

async function testZhipuModel() {
  console.log('Testing Zhipu AI GLM model...');
  console.log(`API Key: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...`);
  console.log(`Base URL: ${process.env.OPENAI_BASE_URL}`);
  console.log(`Model: ${process.env.OPENAI_MODEL}`);

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [{ role: 'user', content: '请用一句话介绍什么是人工智能。' }],
      max_tokens: 100,
      response_format: { type: 'json_object' }, // 测试JSON格式支持
    });

    const duration = Date.now() - startTime;
    const result = response.choices[0].message.content;

    console.log('✓ 智谱GLM调用成功');
    console.log(`耗时: ${duration}ms`);
    console.log(`Tokens: ${response.usage.total_tokens}`);
    console.log(`响应: ${result}`);

    return { success: true };
  } catch (error) {
    console.log('✗ 智谱GLM调用失败');
    console.log(`错误类型: ${error.constructor.name}`);
    console.log(`错误信息: ${error.message}`);
    if (error.response) {
      console.log(`响应状态: ${error.response.status}`);
      console.log(`响应数据:`, error.response.data);
    }
    return { success: false, error: error.message };
  }
}

testZhipuModel().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
