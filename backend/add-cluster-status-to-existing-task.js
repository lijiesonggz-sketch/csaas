const { createConnection } = require('typeorm');
const { AITask } = require('./dist/database/entities/ai-task.entity');

async function fixTask() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'csaas',
    entities: [AITask],
    synchronize: false,
  });

  const repo = connection.getRepository(AITask);
  
  // 获取最新的问卷任务
  const task = await repo.findOne({
    where: { type: 'questionnaire' },
    order: { createdAt: 'DESC' }
  });

  if (!task) {
    console.log('❌ 没有找到问卷任务');
    await connection.close();
    return;
  }

  console.log('✅ 找到问卷任务:', task.id);
  console.log('状态:', task.status);
  console.log('是否有 result:', !!task.result);
  console.log('是否有 clusterGenerationStatus:', !!task.clusterGenerationStatus);

  if (task.clusterGenerationStatus) {
    console.log('✅ 任务已有 clusterGenerationStatus，无需更新');
    await connection.close();
    return;
  }

  // 从 result 中推断聚类状态
  let clusterStatus = null;
  if (task.result && task.result.selectedResult && task.result.selectedResult.questionnaire) {
    const questionnaire = task.result.selectedResult.questionnaire;
    
    // 统计每个聚类的问题数
    const clusterStats = {};
    questionnaire.forEach(q => {
      const clusterId = q.cluster_id || 'unknown';
      if (!clusterStats[clusterId]) {
        clusterStats[clusterId] = {
          clusterId,
          clusterName: q.cluster_name || `聚类 ${clusterId}`,
          questions: 0,
        };
      }
      clusterStats[clusterId].questions++;
    });

    const totalClusters = Object.keys(clusterStats).length;
    const completedClusters = Object.keys(clusterStats);

    clusterStatus = {
      totalClusters,
      completedClusters,
      failedClusters: [],
      pendingClusters: [],
      clusterProgress: {}
    };

    Object.values(clusterStats).forEach(stat => {
      clusterStatus.clusterProgress[stat.clusterId] = {
        clusterId: stat.clusterId,
        clusterName: stat.clusterName,
        status: 'completed',
        questionsGenerated: stat.questions,
        questionsExpected: 5,
        completedAt: new Date(task.completedAt || task.updatedAt).toISOString(),
      };
    });

    console.log('📊 推断出的聚类状态:', JSON.stringify(clusterStatus, null, 2));

    // 更新数据库
    task.clusterGenerationStatus = clusterStatus;
    await repo.save(task);
    console.log('✅ 已更新任务的 clusterGenerationStatus');
  } else {
    console.log('⚠️ 任务没有 result 或 questionnaire，无法推断聚类状态');
    
    // 创建一个空的状态（用于测试）
    clusterStatus = {
      totalClusters: 0,
      completedClusters: [],
      failedClusters: [],
      pendingClusters: [],
      clusterProgress: {}
    };
    
    task.clusterGenerationStatus = clusterStatus;
    await repo.save(task);
    console.log('✅ 已创建空的 clusterGenerationStatus（用于测试）');
  }

  await connection.close();
}

fixTask().catch(console.error);
