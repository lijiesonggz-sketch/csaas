/**
 * 测试矩阵生成API
 */
const axios = require('axios');

async function testMatrixGeneration() {
  try {
    console.log('📡 测试矩阵生成API...\n');

    // 第一步：获取聚类结果
    const clusteringTaskId = 'a785e8fd-1889-441d-b435-733ba93c4602';
    console.log(`1. 获取聚类结果: ${clusteringTaskId}`);

    const clusteringResponse = await axios.get(
      `http://localhost:3000/api/ai-generation/final-result/${clusteringTaskId}`
    );

    if (!clusteringResponse.data.success) {
      throw new Error('获取聚类结果失败');
    }

    console.log('   ✅ 聚类结果获取成功');
    const clusteringResult = clusteringResponse.data.data;
    console.log(`   聚类类别数: ${clusteringResult.categories?.length || 0}\n`);

    // 第二步：发起矩阵生成
    console.log('2. 发起矩阵生成请求...');
    const matrixTaskId = `test-${Date.now()}`;

    const matrixResponse = await axios.post(
      'http://localhost:3000/api/ai-generation/matrix',
      {
        taskId: matrixTaskId,
        clusteringResult: clusteringResult,
        temperature: 0.7,
        maxTokens: 8000,
      },
      {
        timeout: 300000, // 5分钟超时
      }
    );

    console.log('   ✅ 矩阵生成响应:');
    console.log(JSON.stringify(matrixResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ 错误:');
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.error('   请求发送失败，没有收到响应');
      console.error(`   错误: ${error.message}`);
    } else {
      console.error(`   错误: ${error.message}`);
      if (error.stack) {
        console.error(`   堆栈: ${error.stack}`);
      }
    }
    process.exit(1);
  }
}

testMatrixGeneration();
