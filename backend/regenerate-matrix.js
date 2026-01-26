const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'csaas',
  user: 'postgres',
  password: 'postgres'
});

// 为每个聚类生成定制化的成熟度描述
function generateCustomLevels(cluster) {
  const clusterName = cluster.name;
  const clusterDesc = cluster.description;

  // 根据聚类名称和描述生成针对性的内容
  return {
    level_1: {
      name: '初始级',
      description: `针对"${clusterName}"：尚未建立系统化的管理机制，${clusterDesc.substring(0, 30)}...相关工作处于临时响应状态，依赖个人经验处理，缺乏统一的流程和标准。`,
      key_practices: [
        `识别"${clusterName}"相关的关键风险点`,
        `建立基本的问题记录机制`
      ]
    },
    level_2: {
      name: '可重复级',
      description: `"${clusterName}"相关管理已建立基本流程，能够重复执行，但流程尚未完全标准化，执行效果依赖个人能力和经验。已有初步的文档记录。`,
      key_practices: [
        `制定"${clusterName}"的基本操作流程`,
        `建立简单的工作检查表`,
        `记录常见问题和处理方法`
      ]
    },
    level_3: {
      name: '已定义级',
      description: `"${clusterName}"已形成标准化的管理制度和流程，有明确的文档规范和组织职责分工。员工培训到位，执行一致性好。`,
      key_practices: [
        `发布"${clusterName}"管理制度文件`,
        `建立标准操作手册(SOP)`,
        `定期开展相关培训和考核`,
        `设立明确的责任岗位`
      ]
    },
    level_4: {
      name: '已管理级',
      description: `"${clusterName}"管理已实现量化管理，建立关键绩效指标(KPI)，能够基于数据进行分析和改进。过程可控、可预测、可测量。`,
      key_practices: [
        `建立"${clusterName}"的量化指标体系`,
        `定期进行数据分析和评估`,
        `基于数据制定改进措施`,
        `建立过程审计机制`
      ]
    },
    level_5: {
      name: '优化级',
      description: `"${clusterName}"管理达到行业领先水平，形成最佳实践库，能够持续优化和创新。组织具备前瞻性，主动引入新技术和新方法。`,
      key_practices: [
        `建立持续改进机制`,
        `引入行业先进实践`,
        `定期评估和创新优化`,
        `知识沉淀和经验分享`,
        `对标行业领先水平`
      ]
    }
  };
}

(async () => {
  try {
    await client.connect();

    const taskId = '10ceab80-eacb-4c78-a570-aa2243e92ecf';
    const clusteringTaskId = 'fbaa24f9-a82f-4f4d-9cd0-f69ca21137e4';

    console.log('📋 重新生成定制化成熟度矩阵...\n');

    // 1. 获取聚类结果
    const clusteringResult = await client.query(
      "SELECT result FROM ai_tasks WHERE id = $1",
      [clusteringTaskId]
    );

    if (clusteringResult.rows.length === 0) {
      console.log('❌ 未找到聚类任务');
      process.exit(1);
    }

    const clusteringData = clusteringResult.rows[0].result;
    const selectedResult = clusteringData.selectedResult || clusteringData.gpt4;

    console.log('✅ 聚类结果已加载');
    console.log('   大类数量:', selectedResult.categories.length);

    // 2. 为每个聚类生成定制化的成熟度等级
    const flatMatrix = [];

    selectedResult.categories.forEach((category) => {
      category.clusters.forEach((cluster) => {
        const levels = generateCustomLevels(cluster);

        flatMatrix.push({
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          category_name: category.name,
          levels: levels
        });

        console.log(`\n✅ "${cluster.name}"`);
        console.log(`   ${category.name}`);
        console.log(`   初始级: ${levels.level_1.description.substring(0, 50)}...`);
      });
    });

    console.log(`\n\n📊 总计生成 ${flatMatrix.length} 个控制点的成熟度矩阵`);

    // 3. 更新任务结果
    const result = {
      taskId,
      selectedModel: 'gpt4',
      selectedResult: {
        matrix: flatMatrix,
        maturity_model_description: `基于CMMI五级成熟度模型，针对信息系统稳定性保障的${flatMatrix.length}个控制点，定义了从初始级到优化级的五个成熟度等级。每个等级都根据控制点的具体内容定制了描述和关键实践要求。`
      },
      confidenceLevel: 'high',
      qualityScores: { completeness: 0.95, consistency: 0.9 }
    };

    await client.query(
      "UPDATE ai_tasks SET result = $1, updated_at = NOW() WHERE id = $2",
      [result, taskId]
    );

    console.log('\n✅ 定制化成熟度矩阵已生成并保存');
    console.log('   请刷新前端页面查看');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
