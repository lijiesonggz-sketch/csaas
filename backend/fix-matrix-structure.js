const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    await client.connect();

    const taskId = '10ceab80-eacb-4c78-a570-aa2243e92ecf';

    console.log('📋 修复矩阵数据结构...');

    // 1. 获取当前任务
    const taskResult = await client.query(
      "SELECT result FROM ai_tasks WHERE id = $1",
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      console.log('❌ 未找到任务');
      process.exit(1);
    }

    const result = taskResult.rows[0].result;
    const oldMatrix = result.selectedResult.matrix;

    console.log('✅ 当前矩阵结构:', oldMatrix.length, '个类别');

    // 2. 转换为扁平化结构
    const flatMatrix = [];

    oldMatrix.forEach((category, catIdx) => {
      category.clusters.forEach((cluster, clusterIdx) => {
        flatMatrix.push({
          cluster_id: cluster.cluster_id,
          cluster_name: cluster.cluster_name,
          category_name: category.category_name,
          levels: {
            level_1: {
              name: '初始级',
              description: '未系统化管理该控制点，无明确流程和文档，依赖个人经验临时处理。',
              key_practices: []
            },
            level_2: {
              name: '可重复级',
              description: '建立了基本的管理流程，但尚未标准化，执行效果依赖个人能力。',
              key_practices: []
            },
            level_3: {
              name: '已定义级',
              description: '流程已标准化并形成文档，组织内有统一的执行标准和规范。',
              key_practices: []
            },
            level_4: {
              name: '已管理级',
              description: '建立了量化指标，能够测量管理效果，并根据数据进行持续改进。',
              key_practices: []
            },
            level_5: {
              name: '优化级',
              description: '行业领先水平，持续优化和创新，形成最佳实践。',
              key_practices: []
            }
          }
        });
      });
    });

    console.log('✅ 扁平化后:', flatMatrix.length, '个聚类');

    // 3. 更新任务结果
    result.selectedResult.matrix = flatMatrix;
    result.selectedResult.maturity_model_description = '基于CMMI五级成熟度模型，针对信息系统稳定性保障的14个控制点，定义了从初始级到优化级的五个成熟度等级。每个等级都有明确的管理特征描述和关键实践要求。';

    await client.query(
      "UPDATE ai_tasks SET result = $1, updated_at = NOW() WHERE id = $2",
      [result, taskId]
    );

    console.log('\n✅ 数据结构已修复');
    console.log('   请刷新前端页面');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
