/**
 * 测试 OpenAI Embedding API 连接性
 */

require('dotenv').config({ path: '.env.development' });

const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const apiBase = process.env.OPENAI_BASE_URL;
// 测试智谱AI的embedding模型
const embeddingModel = 'embedding-2'; // process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

console.log('=== 测试 OpenAI Embedding API 连接 ===\n');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 未设置');
console.log('API Base:', apiBase || '❌ 未设置');
console.log('Embedding Model:', embeddingModel);

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

async function testEmbeddingAPI() {
  console.log('\n开始测试...\n');

  try {
    // 测试1: 简单的 embedding 请求
    console.log('【测试1】发送 Embedding 请求...');
    const startTime1 = Date.now();

    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: '这是一段测试文本，用于验证 Embedding API 是否可用。',
      encoding_format: 'float',
    });

    const elapsed1 = Date.now() - startTime1;
    console.log('✅ 测试1成功！');
    console.log('   响应时间:', elapsed1, 'ms (', (elapsed1 / 1000).toFixed(2), '秒)');
    console.log('   模型:', response.model);
    console.log('   Embedding 维度:', response.data[0].embedding.length);
    console.log('   Token使用:', JSON.stringify(response.usage));
    console.log('   前5个向量值:', response.data[0].embedding.slice(0, 5));

    // 测试2: 批量 embedding（模拟质量验证场景）
    console.log('\n【测试2】批量 Embedding 请求（模拟3个模型结果对比）...');

    const text1 = JSON.stringify({ categories: ['安全管理', '技术防护'], clusters: 2 });
    const text2 = JSON.stringify({ categories: ['安全策略', '访问控制'], clusters: 2 });
    const text3 = JSON.stringify({ categories: ['安全管理', '技术措施'], clusters: 2 });

    console.log('   Text1 长度:', text1.length, '字符');
    console.log('   Text2 长度:', text2.length, '字符');
    console.log('   Text3 长度:', text3.length, '字符');

    const startTime2 = Date.now();

    const [embedding1, embedding2, embedding3] = await Promise.all([
      openai.embeddings.create({
        model: embeddingModel,
        input: text1,
        encoding_format: 'float',
      }),
      openai.embeddings.create({
        model: embeddingModel,
        input: text2,
        encoding_format: 'float',
      }),
      openai.embeddings.create({
        model: embeddingModel,
        input: text3,
        encoding_format: 'float',
      }),
    ]);

    const elapsed2 = Date.now() - startTime2;
    console.log('✅ 测试2成功！');
    console.log('   总响应时间:', elapsed2, 'ms (', (elapsed2 / 1000).toFixed(2), '秒)');
    console.log('   平均每个:', (elapsed2 / 3).toFixed(0), 'ms');
    console.log('   总Token使用:', embedding1.usage.total_tokens + embedding2.usage.total_tokens + embedding3.usage.total_tokens);

    // 计算余弦相似度
    function cosineSimilarity(vec1, vec2) {
      const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
      const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

      if (magnitude1 === 0 || magnitude2 === 0) return 0;
      return (dotProduct / (magnitude1 * magnitude2) + 1) / 2;
    }

    const sim12 = cosineSimilarity(embedding1.data[0].embedding, embedding2.data[0].embedding);
    const sim13 = cosineSimilarity(embedding1.data[0].embedding, embedding3.data[0].embedding);
    const sim23 = cosineSimilarity(embedding2.data[0].embedding, embedding3.data[0].embedding);

    console.log('\n   余弦相似度:');
    console.log('   Text1 vs Text2:', sim12.toFixed(4));
    console.log('   Text1 vs Text3:', sim13.toFixed(4));
    console.log('   Text2 vs Text3:', sim23.toFixed(4));
    console.log('   平均相似度:', ((sim12 + sim13 + sim23) / 3).toFixed(4));

    // 测试3: 大文本 embedding（模拟聚类场景）
    console.log('\n【测试3】大文本 Embedding 请求（模拟聚类结果）...');

    const largeText = `
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
    `.repeat(5); // 重复5次使其更长

    console.log('   大文本长度:', largeText.length, '字符');

    const startTime3 = Date.now();

    const response3 = await openai.embeddings.create({
      model: embeddingModel,
      input: largeText,
      encoding_format: 'float',
    });

    const elapsed3 = Date.now() - startTime3;
    console.log('✅ 测试3成功！');
    console.log('   响应时间:', elapsed3, 'ms (', (elapsed3 / 1000).toFixed(2), '秒)');
    console.log('   Token使用:', JSON.stringify(response3.usage));
    console.log('   Embedding 维度:', response3.data[0].embedding.length);

    console.log('\n=== 所有测试通过 ✅ ===');
    console.log('\n建议配置:');
    console.log('- Embedding API 响应正常');
    console.log('- 简单请求:', elapsed1, 'ms');
    console.log('- 批量请求:', elapsed2, 'ms (3个)');
    console.log('- 大文本请求:', elapsed3, 'ms');

    if (elapsed2 > 10000) {
      console.log('\n⚠️  警告: 批量 Embedding 请求超过10秒');
      console.log('   质量验证可能需要较长时间');
      console.log('   建议: 增加质量验证的超时时间');
    }

  } catch (error) {
    console.log('\n❌ 测试失败！');
    console.log('错误类型:', error.constructor.name);
    console.log('错误消息:', error.message);

    if (error.response) {
      console.log('HTTP状态码:', error.response.status);
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
    } else if (error.response?.status === 401) {
      console.log('\n🔍 可能原因:');
      console.log('   1. API Key错误');
      console.log('   2. API Key已过期');
      console.log('   3. API Key权限不足');
    } else if (error.response?.status === 400) {
      console.log('\n🔍 可能原因:');
      console.log('   1. 模型名称错误（', embeddingModel, '）');
      console.log('   2. 该API提供商不支持此模型');
      console.log('   3. 需要使用其他 embedding 模型名称');
      console.log('\n💡 建议:');
      console.log('   检查 .env.development 中的 OPENAI_EMBEDDING_MODEL 配置');
      console.log('   如果使用智谱AI，可能需要改为: embedding-2 或 embedding-3');
    }

    process.exit(1);
  }
}

testEmbeddingAPI().catch(console.error);
