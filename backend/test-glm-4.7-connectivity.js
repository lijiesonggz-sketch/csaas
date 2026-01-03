/**
 * 测试 glm-4.7 API 连接性
 */

require('dotenv').config({ path: '.env.development' });

const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const apiBase = process.env.OPENAI_BASE_URL;

console.log('=== 测试 glm-4.7 API 连接 ===\n');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 未设置');
console.log('API Base:', apiBase || '❌ 未设置');

if (!apiKey) {
  console.log('\n❌ OPENAI_API_KEY 未设置');
  process.exit(1);
}

if (!apiBase) {
  console.log('\n❌ OPENAI_BASE_URL 未设置');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: apiBase,
});

async function testConnection() {
  console.log('\n开始测试...\n');

  try {
    // 测试1: 简单的ping请求（短prompt）
    console.log('【测试1】发送简单测试请求...');
    const startTime1 = Date.now();

    const response1 = await openai.chat.completions.create({
      model: 'glm-4.7',
      messages: [
        { role: 'user', content: '你好，请回复"测试成功"' }
      ],
      max_tokens: 50,
    });

    const elapsed1 = Date.now() - startTime1;
    console.log('✅ 测试1成功！');
    console.log('   响应时间:', elapsed1, 'ms');
    console.log('   响应内容:', response1.choices[0].message.content);
    console.log('   Token使用:', JSON.stringify(response1.usage));

    // 测试2: 较长的请求（模拟聚类prompt长度）
    console.log('\n【测试2】发送较长请求（模拟聚类prompt长度）...');

    const longPrompt = `
      你是一名资深IT咨询师，专注于跨标准的条款聚类分析。
      请对以下多个标准文档进行三层结构的智能聚类分析。

      **文档1 - ISO 27001:2022**
      A.5.1.1 制定信息安全政策，由管理层批准并传达给员工和外部方
      A.5.1.2 按计划时间间隔或重大变更时评审信息安全政策
      A.6.1.1 定义并分配所有信息安全职责
      A.6.1.2 定义信息安全角色和职责
      A.8.1.1 确保雇员、承包方和用户理解其职责并承担责任

      **文档2 - 等保2.0**
      8.1.3.1 制定信息安全总体方针和策略
      8.1.4.1 设立安全职能部门、安全主管和负责人岗位
      8.2.1.1 对人员入职、离职、岗位变更进行安全管理
      8.2.1.2 定期对人员进行安全教育和培训

      请按照JSON格式输出聚类结果，包含categories、clusters和clauses三个层次。
    `.repeat(10); // 重复10次使其更长

    console.log('   Prompt长度:', longPrompt.length, '字符');

    const startTime2 = Date.now();

    const response2 = await openai.chat.completions.create({
      model: 'glm-4.7',
      messages: [
        { role: 'user', content: longPrompt + '\n\n请输出前100个字符的预览。' }
      ],
      max_tokens: 100,
    });

    const elapsed2 = Date.now() - startTime2;
    console.log('✅ 测试2成功！');
    console.log('   响应时间:', elapsed2, 'ms (', (elapsed2 / 1000).toFixed(2), '秒)');
    console.log('   Token使用:', JSON.stringify(response2.usage));
    console.log('   响应预览:', response2.choices[0].message.content.substring(0, 100));

    // 测试3: 检查maxTokens参数
    console.log('\n【测试3】测试大maxTokens参数...');

    const startTime3 = Date.now();

    const response3 = await openai.chat.completions.create({
      model: 'glm-4.7',
      messages: [
        { role: 'user', content: '请详细说明什么是信息安全，包括主要方面和最佳实践（200字左右）' }
      ],
      max_tokens: 60000, // 与聚类任务相同的maxTokens
    });

    const elapsed3 = Date.now() - startTime3;
    console.log('✅ 测试3成功！');
    console.log('   响应时间:', elapsed3, 'ms (', (elapsed3 / 1000).toFixed(2), '秒)');
    console.log('   Token使用:', JSON.stringify(response3.usage));
    console.log('   响应长度:', response3.choices[0].message.content.length, '字符');

    console.log('\n=== 所有测试通过 ✅ ===');
    console.log('\n建议配置:');
    console.log('- API响应正常');
    console.log('- 简单请求:', elapsed1, 'ms');
    console.log('- 长请求:', elapsed2, 'ms (', (elapsed2 / 1000).toFixed(2), '秒)');
    console.log('- 大token请求:', elapsed3, 'ms (', (elapsed3 / 1000).toFixed(2), '秒)');

    if (elapsed3 > 60000) {
      console.log('\n⚠️  警告: 大token请求超过60秒，建议：');
      console.log('   1. 增加后端timeout配置');
      console.log('   2. 或减少maxTokens参数');
      console.log('   3. 或使用其他provider作为backup');
    }

  } catch (error) {
    console.log('\n❌ 测试失败！');
    console.log('错误类型:', error.constructor.name);
    console.log('错误消息:', error.message);

    if (error.response) {
      console.log('HTTP状态码:', error.response.status);
      console.log('响应头:', JSON.stringify(error.response.headers, null, 2));
      console.log('响应体:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔍 可能原因:');
      console.log('   1. API Base URL错误');
      console.log('   2. 网络连接问题');
      console.log('   3. 防火墙阻止');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      console.log('\n🔍 可能原因:');
      console.log('   1. API响应太慢');
      console.log('   2. 网络不稳定');
      console.log('   3. Prompt太大导致处理时间长');
    } else if (error.response?.status === 401) {
      console.log('\n🔍 可能原因:');
      console.log('   1. API Key错误');
      console.log('   2. API Key已过期');
      console.log('   3. API Key权限不足');
    } else if (error.response?.status === 429) {
      console.log('\n🔍 可能原因:');
      console.log('   1. 请求频率限制');
      console.log('   2. 配额已用完');
    }

    process.exit(1);
  }
}

testConnection().catch(console.error);
