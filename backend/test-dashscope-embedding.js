/**
 * 测试通义千问 DashScope Embedding API 连接性（使用原生 fetch）
 */

require('dotenv').config({ path: '.env.development' });

// 使用 TONGYI_API_KEY（通义千问的 Embedding API 使用相同的 key）
const apiKey = process.env.TONGYI_API_KEY || process.env.DASHSCOPE_API_KEY;
const apiBase = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

console.log('=== 测试通义千问 DashScope Embedding API 连接 ===\n');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 未设置');
console.log('来源:', process.env.TONGYI_API_KEY ? 'TONGYI_API_KEY' : 'DASHSCOPE_API_KEY');

if (!apiKey) {
  console.log('\n❌ TONGYI_API_KEY 和 DASHSCOPE_API_KEY 都未设置');
  console.log('请在 .env.development 中添加: TONGYI_API_KEY=sk-xxx');
  console.log('\n💡 获取API Key:');
  console.log('   访问: https://dashscope.console.aliyun.com/apiKey');
  process.exit(1);
}

async function testEmbeddingAPI() {
  console.log('\n开始测试...\n');

  try {
    // 测试1: 简单的 embedding 请求
    console.log('【测试1】发送 Embedding 请求（text-embedding-v2）...');
    const startTime1 = Date.now();

    const response1 = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: {
          texts: ['这是一段测试文本，用于验证 Embedding API 是否可用。']
        }
      })
    });

    if (!response1.ok) {
      const errorText = await response1.text();
      throw new Error(`HTTP ${response1.status}: ${errorText}`);
    }

    const data1 = await response1.json();
    const elapsed1 = Date.now() - startTime1;
    console.log('✅ 测试1成功！');
    console.log('   响应时间:', elapsed1, 'ms (', (elapsed1 / 1000).toFixed(2), '秒)');
    console.log('   Embedding 维度:', data1.output.embeddings[0].embedding.length);
    console.log('   Token使用:', data1.usage.total_tokens);
    console.log('   前5个向量值:', data1.output.embeddings[0].embedding.slice(0, 5));

    // 测试2: 批量 embedding（模拟质量验证场景）
    console.log('\n【测试2】批量 Embedding 请求（模拟3个模型结果对比）...');

    const text1 = JSON.stringify({ categories: ['安全管理', '技术防护'], clusters: 2 });
    const text2 = JSON.stringify({ categories: ['安全策略', '访问控制'], clusters: 2 });
    const text3 = JSON.stringify({ categories: ['安全管理', '技术措施'], clusters: 2 });

    console.log('   Text1 长度:', text1.length, '字符');
    console.log('   Text2 长度:', text2.length, '字符');
    console.log('   Text3 长度:', text3.length, '字符');

    const startTime2 = Date.now();

    const response2 = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: {
          texts: [text1, text2, text3]
        }
      })
    });

    if (!response2.ok) {
      const errorText = await response2.text();
      throw new Error(`HTTP ${response2.status}: ${errorText}`);
    }

    const data2 = await response2.json();
    const elapsed2 = Date.now() - startTime2;
    console.log('✅ 测试2成功！');
    console.log('   总响应时间:', elapsed2, 'ms (', (elapsed2 / 1000).toFixed(2), '秒)');
    console.log('   Token使用:', data2.usage.total_tokens);

    // 提取embedding向量
    const embedding1 = data2.output.embeddings[0].embedding;
    const embedding2 = data2.output.embeddings[1].embedding;
    const embedding3 = data2.output.embeddings[2].embedding;

    // 计算余弦相似度
    function cosineSimilarity(vec1, vec2) {
      const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
      const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

      if (magnitude1 === 0 || magnitude2 === 0) return 0;
      return (dotProduct / (magnitude1 * magnitude2) + 1) / 2;
    }

    const sim12 = cosineSimilarity(embedding1, embedding2);
    const sim13 = cosineSimilarity(embedding1, embedding3);
    const sim23 = cosineSimilarity(embedding2, embedding3);

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
    `.repeat(5);

    console.log('   大文本长度:', largeText.length, '字符');

    const startTime3 = Date.now();

    const response3 = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: {
          texts: [largeText]
        }
      })
    });

    if (!response3.ok) {
      const errorText = await response3.text();
      throw new Error(`HTTP ${response3.status}: ${errorText}`);
    }

    const data3 = await response3.json();
    const elapsed3 = Date.now() - startTime3;
    console.log('✅ 测试3成功！');
    console.log('   响应时间:', elapsed3, 'ms (', (elapsed3 / 1000).toFixed(2), '秒)');
    console.log('   Token使用:', data3.usage.total_tokens);
    console.log('   Embedding 维度:', data3.output.embeddings[0].embedding.length);

    console.log('\n=== 所有测试通过 ✅ ===');
    console.log('\n📊 性能总结:');
    console.log('- ✅ DashScope Embedding API 响应正常');
    console.log('- 简单请求:', elapsed1, 'ms');
    console.log('- 批量请求:', elapsed2, 'ms (3个文本，平均', (elapsed2/3).toFixed(0), 'ms/个)');
    console.log('- 大文本请求:', elapsed3, 'ms');

    if (elapsed2 > 10000) {
      console.log('\n⚠️  警告: 批量 Embedding 请求超过10秒');
      console.log('   质量验证可能需要较长时间');
    }

    console.log('\n📋 接下来需要做的:');
    console.log('1. 确认 .env.development 中已设置 DASHSCOPE_API_KEY=sk-xxx');
    console.log('2. 修改 similarity.calculator.ts 使用 DashScope HTTP API');
    console.log('3. 重启后端服务');

  } catch (error) {
    console.log('\n❌ 测试失败！');
    console.log('错误类型:', error.constructor.name);
    console.log('错误消息:', error.message);

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n🔍 可能原因:');
      console.log('   1. DASHSCOPE_API_KEY 错误');
      console.log('   2. DASHSCOPE_API_KEY 已过期');
      console.log('   3. 需要申请 DashScope API Key');
      console.log('\n💡 获取API Key:');
      console.log('   访问: https://dashscope.console.aliyun.com/apiKey');
    } else if (error.message.includes('quota') || error.message.includes('429')) {
      console.log('\n🔍 可能原因:');
      console.log('   1. API 调用配额已用完');
      console.log('   2. 需要充值或提升配额');
    }

    process.exit(1);
  }
}

testEmbeddingAPI().catch(console.error);
